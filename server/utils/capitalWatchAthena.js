'use strict'

// Athena for Capital Watch: the funding assistant (adapted from MarketGenius's Inanna), scoped to one business.
// It reads that business's profile, its ranked matches and its decisions, answers in
// context, and suggests actions. It never changes anything itself: each action comes
// back as a button the member clicks, which goes through the normal routes.

const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const Decision = require('../models/CapitalWatch/capitalWatch.Decision')
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail')
const { aiChat } = require('./aiChat')
const { GRANT_FIELDS, getOpenGrants, matchesFor, businessProfileText } = require('./capitalWatchData')
const { checkFit } = require('./capitalWatchMatching')
const { PERSONA, CRAFT, WRITING, RUBRIC, CHAT_VOICE } = require('../config/capitalWatchPersona')

const TOP_MATCHES = 35
const SEARCH_EXTRA = 8
const MAX_HISTORY = 12
const ACTION_TYPES = new Set(['open', 'approve', 'archive', 'reject', 'draft_email'])

// House style: no em dashes in anything a person reads or sends.
const EM_DASH_RE = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, 'g')
const noEmDash = (s) => String(s || '').replace(EM_DASH_RE, ', ')

// Same date reading as the daily deadline email, so "due in 5 days" agrees with it.
function daysUntil(dueDate) {
  if (!dueDate) return null
  const due = new Date(`${dueDate}T00:00:00Z`)
  if (isNaN(due.getTime())) return null
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Math.round((due - todayUtc) / 86400000)
}

const clip = (text, n) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

function deadlineLabel(grant) {
  if (grant.rolling) return 'rolling'
  const days = daysUntil(grant.dueDate)
  if (days === null) return grant.dueDate || 'none stated'
  if (days < 0) return `${grant.dueDate} (passed)`
  return `${grant.dueDate} (${days} day${days === 1 ? '' : 's'} left)`
}

const STATUS_WORD = { approved: 'applied', archived: 'saved for later', rejected: 'dismissed', drafting: 'drafting' }

// One compact line per opportunity: enough for the model to reason and cite the id.
function grantLine(g, decision) {
  const parts = [
    `id=${g._id}`,
    `"${clip(g.title, 120)}"`,
    g.agency && `agency: ${clip(g.agency, 60)}`,
    `type: ${g.category || g.fundingType || 'other'}`,
    `amount: ${g.amountUsd ? `$${g.amountUsd.toLocaleString('en-US')}` : 'not stated'}`,
    `deadline: ${deadlineLabel(g)}`,
    g.location && `location: ${clip(g.location, 40)}`,
    g.targetDemographics?.length && `only for founders who are: ${g.targetDemographics.join(', ')}`,
    g.applicantTypes?.length && `applicants: ${g.applicantTypes.join(', ')}`,
    decision && `status: ${STATUS_WORD[decision.status] || decision.status}`,
    g.fit === false && `NOT A FIT: ${g.unfitReason}`,
    typeof g.score === 'number' && `fit score: ${g.score}`,
    g.summary && `summary: ${clip(g.summary, 200)}`,
    g.requirements && `requirements: ${clip(g.requirements, 200)}`,
  ]
  const missing = (decision?.requirementsChecklist || []).filter((r) => r.status === 'needs_input')
  if (missing.length) parts.push(`still needs from founder: ${missing.map((r) => clip(r.requirement, 60)).join('; ')}`)
  return `- ${parts.filter(Boolean).join(' | ')}`
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const STOP = new Set(['what', 'which', 'when', 'where', 'grant', 'grants', 'this', 'that', 'with', 'should', 'apply', 'about', 'have', 'there', 'their', 'more', 'than', 'from', 'into', 'week', 'today', 'need', 'does', 'they', 'them', 'would', 'could', 'funding', 'business'])

// Opportunities the question names that aren't in the top list (e.g. "the SBIR one").
async function searchForQuestion(question, excludeIds, business) {
  const terms = [...new Set((String(question || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter((w) => !STOP.has(w)))].slice(0, 6)
  if (!terms.length) return []
  const re = new RegExp(terms.map(escapeRegex).join('|'), 'i')
  const exclude = new Set(excludeIds.map(String))
  const grants = await getOpenGrants()
  return grants
    .filter((g) => !exclude.has(String(g._id)) && (re.test(g.title || '') || re.test(g.agency || '') || re.test(g.summary || '')))
    .slice(0, SEARCH_EXTRA)
    .map((g) => {
      const fit = checkFit(g, business)
      return { ...g, fit: fit.fits, unfitReason: fit.reason }
    })
}

async function loadContext(business, question) {
  const [matches, decisions] = await Promise.all([
    matchesFor(business),
    Decision.find({ business: business._id, status: { $in: ['approved', 'archived'] } }).sort({ updatedAt: -1 }).limit(25).select('grant status requirementsChecklist').lean(),
  ])
  const decidedGrants = await Grant.find({ _id: { $in: decisions.map((d) => d.grant) } }).select(GRANT_FIELDS).lean()
  const byId = new Map(decidedGrants.map((g) => [String(g._id), g]))
  const decided = decisions.map((d) => ({ grant: byId.get(String(d.grant)), decision: d })).filter((x) => x.grant)
  const top = matches.slice(0, TOP_MATCHES)
  const extra = await searchForQuestion(question, [...top, ...decided.map((x) => x.grant)].map((g) => g._id), business)
  return { matchCount: matches.length, top, decided, extra, focus: await focusApplication(question, decided) }
}

const REVIEW_RE = /\b(review|score|critique|feedback|grade|rate|improve|strengthen|weak|strong|ready|rewrite|edit)\b/i

// The drafted application the question is about, so Athena can review or rework the
// actual text. Named by title words, or the latest one when asked to review "my application".
async function focusApplication(question, decided) {
  const applied = decided.filter((x) => x.decision.status === 'approved')
  if (!applied.length) return null
  const words = (String(question || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter((w) => !STOP.has(w))
  const named = applied.find((x) => words.some((w) => String(x.grant.title || '').toLowerCase().includes(w)))
  const pick = named || (REVIEW_RE.test(question) ? applied[0] : null)
  if (!pick) return null
  const d = await Decision.findById(pick.decision._id).select('applicationNarrative outreachEmail').lean()
  if (!d?.applicationNarrative) return null
  return { grant: pick.grant, narrative: d.applicationNarrative.slice(0, 6000), outreach: (d.outreachEmail || '').slice(0, 1500) }
}

// Cheap, no-AI summary for the "Today" tab and the orb's badge.
async function buildBriefing(business) {
  const [matches, decisions, outboxDrafts] = await Promise.all([
    matchesFor(business),
    Decision.find({ business: business._id, status: { $in: ['approved', 'archived'] } }).select('grant status requirementsChecklist').lean(),
    OutboundEmail.countDocuments({ business: business._id, status: 'draft' }),
  ])
  const decidedGrants = await Grant.find({ _id: { $in: decisions.map((d) => d.grant) }, status: { $ne: 'expired' } }).select('title amountUsd dueDate rolling link').lean()
  const byId = new Map(decidedGrants.map((g) => [String(g._id), g]))

  const dueSoon = [
    ...decisions.map((d) => ({ g: byId.get(String(d.grant)), status: d.status })),
    ...matches.slice(0, 60).map((g) => ({ g, status: 'match' })),
  ]
    .filter((x) => x.g && !x.g.rolling)
    .map((x) => ({ ...x, days: daysUntil(x.g.dueDate) }))
    .filter((x) => x.days !== null && x.days >= 0 && x.days <= 14)
    .sort((a, b) => a.days - b.days)
    .slice(0, 10)
    .map(({ g, status, days }) => ({ id: String(g._id), title: g.title, status, days, amountUsd: g.amountUsd || null, link: g.link }))

  const needsInput = decisions
    .filter((d) => d.status === 'approved')
    .map((d) => ({ g: byId.get(String(d.grant)), missing: (d.requirementsChecklist || []).filter((r) => r.status === 'needs_input') }))
    .filter((x) => x.g && x.missing.length)
    .slice(0, 8)
    .map(({ g, missing }) => ({ id: String(g._id), title: g.title, missing: missing.map((r) => r.requirement) }))

  return {
    matchCount: matches.length,
    urgentCount: dueSoon.filter((d) => d.days <= 7).length,
    outboxDrafts,
    dueSoon,
    topMatches: matches.slice(0, 5).map((g) => ({ id: String(g._id), title: g.title, amountUsd: g.amountUsd || null, category: g.category, deadline: deadlineLabel(g), reasons: g.reasons, link: g.link })),
    needsInput,
  }
}

function systemPrompt(business, ctx) {
  const today = new Date().toISOString().slice(0, 10)
  const section = (title, rows) => `${title}\n${rows.length ? rows.join('\n') : '- none'}`

  return `${PERSONA}

${CRAFT}

${WRITING}

${RUBRIC}

${CHAT_VOICE}

Where you work: Capital Watch finds grants, loans, investors, competitions, accelerators and fellowships, and ranks them for a business. Today is ${today}. You are helping the business below. Each opportunity is a "match" until the business applies (which drafts an application package), saves it for later, or dismisses it. "Fit score" is the tool's own ranking against the profile; higher is better. Opportunities marked NOT A FIT fail a hard rule from the profile.

Your job: help this business decide what to pursue and win it. Switch roles to fit the question: funding strategist (the strongest argument and positioning), compliance checker (eligibility, disqualifiers, required attachments, limits), grant writer (actual text, not advice, when asked to write), reviewer (score with the rubric and give specific fixes), editor, impact specialist (measurable outcomes), or coach (encouragement after a setback). Compare opportunities, explain fit, flag deadlines, and say what is still missing on applications in progress. If the profile is missing something that would change the answer (location, founder backgrounds, stage, revenue, traction), say what to add to the profile.

Rules:
- Use only the data below. Never invent an opportunity, amount, deadline, requirement, or fact about the business. If something is not in the data, say so, and suggest opening the source link to check.
- Refer to opportunities by their title, never by id.
- The fit score is a rough ranking, not a verdict. Before recommending anything, read its summary and confirm this business could actually be the applicant and use the money for its own work. Do not recommend opportunities meant for a different kind of organization.
- The scrape sometimes picks up news about awards already given rather than open calls. If an entry reads like that, say it is probably not open and suggest dismissing it.
- Keep answers short: a few sentences or a short list. A review or a requested piece of writing can be longer. Plain text with simple "- " bullets; no markdown bold, no tables, no headings.
- Never promise to do something later. If asked to draft something, include the draft in this same reply.
- Do not use em dashes.

Actions: you may suggest up to 3 one-click actions the member can confirm. Types:
- "open": open the opportunity's source page.
- "approve": apply to it (drafts an application package for this business).
- "archive": save it for later.
- "reject": dismiss it.
- "draft_email": write an email to someone outside the business (a program contact, investor, or partner) about this opportunity. Include "to" (the opportunity's contact email when listed, otherwise omit it), "subject", and "body", signed by a founder named in the profile when one is given. Drafts go to the Outbox for the member to review and send.
Only suggest an action when it clearly follows from the conversation, and only for ids listed below. Suggest approve/archive/reject only for matches (no status yet). When asked to write an email, put it only in a draft_email action, and in "reply" say in one sentence what you drafted. Never put placeholders like [Name] in a draft.

Reply with ONLY valid JSON in this shape:
{"reply": "string", "actions": [{"type": "open|approve|archive|reject|draft_email", "grantId": "string", "label": "short button text", "to": "draft_email only", "subject": "draft_email only", "body": "draft_email only"}]}

## Business profile
${businessProfileText(business)}

${section(`## Top matches (${ctx.matchCount} total; best ${ctx.top.length} shown)`, ctx.top.map((g) => grantLine(g)))}

${section('## Applied and saved', ctx.decided.map((x) => grantLine(x.grant, x.decision)))}

${ctx.extra.length ? section('## Other opportunities matching the question', ctx.extra.map((g) => grantLine(g))) : ''}

${ctx.focus ? `## Drafted application for "${ctx.focus.grant.title}" (the one under discussion)\n${ctx.focus.narrative}${ctx.focus.outreach ? `\n\nIts outreach note:\n${ctx.focus.outreach}` : ''}` : ''}`.trim()
}

const VALID_EMAIL_RE = /^[^\s@<>[\]]+@[^\s@<>[\]]+\.[^\s@<>[\]]+$/

// Keeps only actions that point at a real opportunity in a state where they make sense.
function cleanActions(rawActions, grantsById, decidedIds) {
  if (!Array.isArray(rawActions)) return []
  const out = []
  for (const a of rawActions) {
    if (!a || !ACTION_TYPES.has(a.type)) continue
    const grant = grantsById.get(String(a.grantId))
    if (!grant) continue
    if (['approve', 'archive', 'reject'].includes(a.type) && decidedIds.has(String(grant._id))) continue
    if (a.type === 'draft_email' && !(String(a.subject || '').trim() && String(a.body || '').trim())) continue
    if (a.type === 'open' && !grant.link) continue
    out.push({
      type: a.type,
      grantId: String(grant._id),
      grantTitle: grant.title,
      link: grant.link || null,
      ...(a.type === 'draft_email' ? {
        // Only a real address; a placeholder becomes blank for the member to fill.
        to: [a.to, grant.contactEmail].map((v) => String(v || '').trim()).find((v) => VALID_EMAIL_RE.test(v)) || '',
        subject: clip(noEmDash(a.subject), 200),
        body: noEmDash(a.body).slice(0, 8000),
      } : {}),
      label: clip(a.label || '', 40) || null,
    })
    if (out.length >= 3) break
  }
  return out
}

// The model often pastes the drafted email into its chat reply as well. The draft is
// already shown on its own card, so cut the reply where the copy starts.
function withoutRepeatedDrafts(reply, actions) {
  let cut = reply.length
  for (const a of actions) {
    if (a.type !== 'draft_email') continue
    const markers = [`Subject: ${a.subject}`, a.subject, a.body.slice(0, 60)].filter((m) => m && m.length >= 12)
    for (const m of markers) {
      const i = reply.indexOf(m)
      if (i !== -1 && i < cut) cut = i
    }
  }
  if (cut === reply.length) return reply
  const kept = reply.slice(0, cut).replace(/\n[^\n]*:\s*$/, '').replace(/[^\n]*:\s*$/, '').trimEnd()
  return `${kept}\n\nI drafted the email below. Save it to the Outbox to review and send it.`.trim()
}

// messages: [{ role: 'user' | 'assistant', content: string }], newest last.
async function askAthena(business, messages) {
  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: clip(m.content, 4000) }))
  const question = [...history].reverse().find((m) => m.role === 'user')?.content
  if (!question) throw Object.assign(new Error('Ask a question first.'), { status: 400 })

  const ctx = await loadContext(business, question)
  const response = await aiChat.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1600,
    messages: [{ role: 'system', content: systemPrompt(business, ctx) }, ...history],
  }, { timeout: 45000 })

  let parsed
  try {
    parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}')
  } catch {
    parsed = { reply: String(response.choices?.[0]?.message?.content || '').trim(), actions: [] }
  }

  const all = [...ctx.top, ...ctx.decided.map((x) => x.grant), ...ctx.extra]
  const grantsById = new Map(all.map((g) => [String(g._id), g]))
  const decidedIds = new Set(ctx.decided.map((x) => String(x.grant._id)))
  const actions = cleanActions(parsed.actions, grantsById, decidedIds)
  // The chat shows plain text, so drop markdown emphasis and heading marks.
  const plain = noEmDash(parsed.reply).replace(/\*\*|__/g, '').replace(/^#{1,6}\s+/gm, '')
  const reply = withoutRepeatedDrafts(plain, actions).trim()
  return {
    reply: reply || "I couldn't put an answer together for that. Try asking it another way.",
    actions,
  }
}

module.exports = { askAthena, buildBriefing, daysUntil, cleanActions, withoutRepeatedDrafts, noEmDash }

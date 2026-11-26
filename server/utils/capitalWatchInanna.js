'use strict'

// Inanna for Capital Watch: the same idea as Inanna in MarketGenius (an assistant
// that reads the real dashboard data, answers in context, and suggests actions),
// scoped to funding opportunities. It reads grants, deadlines, and company
// profiles; it never changes anything itself. Actions it suggests come back as
// buttons the team clicks, which go through the normal /grants/:id route.

const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail')
const { COMPANIES } = require('../config/capitalWatchCompanies')
const { scoreGrant } = require('./capitalWatchScoring')
const { aiChat } = require('./aiChat')

const TOP_PENDING = 40
const SEARCH_EXTRA = 10
const MAX_HISTORY = 12
const ACTION_TYPES = new Set(['open', 'approve', 'archive', 'reject', 'draft_email'])

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

// One compact line per grant: enough for the model to reason and cite the id.
function grantLine(grant) {
  const parts = [
    `id=${grant._id}`,
    `"${clip(grant.title, 120)}"`,
    grant.agency && `agency: ${clip(grant.agency, 60)}`,
    `type: ${grant.fundingType || 'other'}`,
    `amount: ${grant.amountUsd ? `$${grant.amountUsd.toLocaleString('en-US')}` : 'not stated'}`,
    `deadline: ${deadlineLabel(grant)}`,
    grant.location && `location: ${clip(grant.location, 40)}`,
    grant.targetDemographics?.length && `eligible groups: ${grant.targetDemographics.join(', ')}`,
    `status: ${grant.status}${grant.company ? ` (applied as ${grant.company})` : ''}`,
    `fit score: ${scoreGrant(grant)}`,
    grant.summary && `summary: ${clip(grant.summary, 220)}`,
    grant.requirements && `requirements: ${clip(grant.requirements, 220)}`,
  ]
  const missing = (grant.requirementsChecklist || []).filter((r) => r.status === 'needs_input')
  if (missing.length) parts.push(`still needs from founder: ${missing.map((r) => clip(r.requirement, 60)).join('; ')}`)
  return `- ${parts.filter(Boolean).join(' | ')}`
}

// House style: no em dashes in anything the team reads or sends.
const EM_DASH_RE = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, 'g')
const noEmDash = (s) => s.replace(EM_DASH_RE, ', ')

const escapeRegex =(s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Grants outside the top list that the question names (e.g. "the SBIR one").
async function searchForQuestion(question, excludeIds) {
  const words = String(question || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []
  const stop = new Set(['what', 'which', 'when', 'where', 'grant', 'grants', 'this', 'that', 'with', 'should', 'apply', 'about', 'have', 'there', 'their', 'more', 'than', 'from', 'into', 'week', 'today', 'need', 'does', 'they', 'them', 'would', 'could'])
  const terms = [...new Set(words.filter((w) => !stop.has(w)))].slice(0, 6)
  if (!terms.length) return []
  const re = new RegExp(terms.map(escapeRegex).join('|'), 'i')
  return Grant.find({
    _id: { $nin: excludeIds },
    $or: [{ title: re }, { agency: re }, { summary: re }],
  }).limit(SEARCH_EXTRA).lean()
}

async function loadContext(question) {
  const [pending, approved, archived] = await Promise.all([
    Grant.find({ status: 'pending' }).lean(),
    Grant.find({ status: 'approved' }).sort({ updatedAt: -1 }).limit(15).lean(),
    Grant.find({ status: 'archived' }).sort({ updatedAt: -1 }).limit(10).lean(),
  ])
  pending.sort((a, b) => scoreGrant(b) - scoreGrant(a))
  const topPending = pending.slice(0, TOP_PENDING)
  const shownIds = [...topPending, ...approved, ...archived].map((g) => g._id)
  const extra = await searchForQuestion(question, shownIds)
  return { pendingCount: pending.length, topPending, approved, archived, extra }
}

// Cheap, no-AI summary for the "Today" tab and the badge on the orb.
async function buildBriefing() {
  const [grants, outboxDrafts] = await Promise.all([
    Grant.find({ status: { $in: ['pending', 'approved'] } }).lean(),
    OutboundEmail.countDocuments({ status: 'draft' }),
  ])
  const dueSoon = grants
    .map((g) => ({ g, days: g.rolling ? null : daysUntil(g.dueDate) }))
    .filter(({ days }) => days !== null && days >= 0 && days <= 14)
    .sort((a, b) => a.days - b.days)
    .map(({ g, days }) => ({ id: String(g._id), title: g.title, status: g.status, days, amountUsd: g.amountUsd || null, link: g.link }))

  const topMatches = grants
    .filter((g) => g.status === 'pending')
    .sort((a, b) => scoreGrant(b) - scoreGrant(a))
    .slice(0, 5)
    .map((g) => ({ id: String(g._id), title: g.title, amountUsd: g.amountUsd || null, fundingType: g.fundingType, deadline: deadlineLabel(g), link: g.link }))

  const needsInput = grants
    .filter((g) => g.status === 'approved')
    .map((g) => ({ g, missing: (g.requirementsChecklist || []).filter((r) => r.status === 'needs_input') }))
    .filter(({ missing }) => missing.length)
    .slice(0, 8)
    .map(({ g, missing }) => ({ id: String(g._id), title: g.title, company: g.company || null, missing: missing.map((r) => r.requirement) }))

  return {
    pendingCount: grants.filter((g) => g.status === 'pending').length,
    urgentCount: dueSoon.filter((d) => d.days <= 7).length,
    outboxDrafts,
    dueSoon,
    topMatches,
    needsInput,
  }
}

function systemPrompt(ctx) {
  const today = new Date().toISOString().slice(0, 10)
  const companies = COMPANIES.map((c) => `### ${c.name} (companyId: ${c.id})\n${c.profile}`).join('\n\n')
  const section = (title, list) => `${title}\n${list.length ? list.map(grantLine).join('\n') : '- none'}`

  return `You are Inanna, the funding assistant inside Capital Watch, a dashboard where a small founding team reviews grants, loans, prizes, fellowships, and investor opportunities found by a weekly web scrape. Today is ${today}.

How the dashboard works: each opportunity is pending until the team approves it for one company (which drafts an application package and emails it to the team), rejects it, or archives it for later. "Fit score" is the dashboard's own ranking (demographic fit, location, amount, effort); higher is better.

Your job: help the team decide what to pursue and get applications done. Be direct and specific. Compare opportunities, explain fit and eligibility, flag deadlines, say what is still missing for applications in progress, and draft short pieces of text when asked.

Rules:
- Use only the data below and the company profiles. Never invent an opportunity, amount, deadline, or requirement. If something is not in the data, say so, and suggest opening the source link to check.
- Refer to opportunities by their title, never by id.
- Eligibility matters: check stated eligible groups, location, and requirements against the company profiles before recommending.
- The fit score is a rough keyword ranking, not a verdict. Before recommending anything, read its summary and confirm one of the companies could actually be the applicant and use the money for its own work. Do not recommend opportunities meant for a different kind of organization (for example a shelter's capital campaign, a city's own program, or a specific nonprofit's fundraiser), even with a high score.
- The scrape sometimes picks up news articles about awards already given (for example "Foundation awards $200,000 to..."), not open calls anyone can apply to. If an entry reads like that, say it is probably not open and suggest archiving or rejecting it instead of recommending it.
- Keep answers short: a few sentences or a short list. Use plain text with simple "- " bullets; no markdown bold, no tables, no headings.
- Never promise to do something later. If you are asked to draft something, include the draft in this same reply.
- Do not use em dashes.

Actions: you may suggest up to 3 one-click actions the team can confirm. Types:
- "open": open the opportunity's source page.
- "approve": approve it for a company (needs companyId); this drafts and emails an application.
- "archive": save it for later.
- "reject": remove it from the pending list.
- "draft_email": write an email to someone outside the team (a program contact, investor, or partner) about this opportunity. Include "to" (use the opportunity's contact email when one is listed, otherwise omit it), "subject", "body", and companyId for the company sending it. Drafts go to the Outbox, where a person reviews, edits, and sends them; you never send anything. Write the full email in "body", signed by the founder named in the company profile.
Only suggest an action when it clearly follows from the conversation, and only for ids listed below. Suggest approve/archive/reject only for pending opportunities. When asked to write an email, put the email only in a draft_email action, and in "reply" say in one sentence what you drafted; do not repeat the email text in "reply". Never put placeholders like [Contact Name] or [Contact Email] in a draft: omit "to" when no contact is listed and use a neutral greeting such as "Hello,".

Reply with ONLY valid JSON in this shape:
{"reply": "string", "actions": [{"type": "open|approve|archive|reject|draft_email", "grantId": "string", "companyId": "string or omitted", "label": "short button text", "to": "draft_email only", "subject": "draft_email only", "body": "draft_email only"}]}

## Companies
${companies}

## Pending opportunities (${ctx.pendingCount} total; top ${ctx.topPending.length} by fit score shown)
${section('', ctx.topPending).trim()}

${section('## Applied (approved) opportunities', ctx.approved)}

${section('## Archived for later', ctx.archived)}

${ctx.extra.length ? section('## Other opportunities matching the question', ctx.extra) : ''}`.trim()
}

// Keeps only actions that point at a real grant in a state where the action makes sense.
function cleanActions(rawActions, grantsById) {
  if (!Array.isArray(rawActions)) return []
  const companyIds = new Set(COMPANIES.map((c) => c.id))
  const out = []
  for (const a of rawActions) {
    if (!a || !ACTION_TYPES.has(a.type)) continue
    const grant = grantsById.get(String(a.grantId))
    if (!grant) continue
    if (['approve', 'archive', 'reject'].includes(a.type) && grant.status !== 'pending') continue
    if (a.type === 'draft_email' && !(String(a.subject || '').trim() && String(a.body || '').trim())) continue
    if (a.type === 'approve' && !companyIds.has(a.companyId)) continue
    if (a.type === 'open' && !grant.link) continue
    out.push({
      type: a.type,
      grantId: String(grant._id),
      grantTitle: grant.title,
      link: grant.link || null,
      ...(a.type === 'approve' || (a.type === 'draft_email' && companyIds.has(a.companyId)) ? { companyId: a.companyId } : {}),
      ...(a.type === 'draft_email' ? {
        // Only a real address; a placeholder like "[Contact Email]" becomes blank for the reviewer to fill.
        to: [a.to, grant.contactEmail].map((v) => String(v || '').trim()).find((v) => /^[^\s@<>[\]]+@[^\s@<>[\]]+\.[^\s@<>[\]]+$/.test(v)) || '',
        subject: clip(a.subject, 200),
        body: noEmDash(String(a.body)).slice(0, 8000),
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
  // Drop a lead-in line like "Here's a draft for the intro email:".
  const kept = reply.slice(0, cut).replace(/\n[^\n]*:\s*$/, '').replace(/[^\n]*:\s*$/, '').trimEnd()
  return `${kept}\n\nI drafted the email below. Save it to the Outbox to review and send it.`.trim()
}

// messages: [{ role: 'user' | 'assistant', content: string }], newest last.
async function askInanna(messages) {
  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: clip(m.content, 4000) }))
  const question = [...history].reverse().find((m) => m.role === 'user')?.content
  if (!question) throw Object.assign(new Error('Ask a question first.'), { status: 400 })

  const ctx = await loadContext(question)
  const response = await aiChat.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1600,
    messages: [{ role: 'system', content: systemPrompt(ctx) }, ...history],
  }, { timeout: 45000 })

  let parsed
  try {
    parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}')
  } catch {
    parsed = { reply: String(response.choices?.[0]?.message?.content || '').trim(), actions: [] }
  }

  const grantsById = new Map(
    [...ctx.topPending, ...ctx.approved, ...ctx.archived, ...ctx.extra].map((g) => [String(g._id), g]),
  )
  const actions = cleanActions(parsed.actions, grantsById)
  const reply = withoutRepeatedDrafts(noEmDash(String(parsed.reply || '')), actions).trim()
  return {
    reply: reply || "I couldn't put an answer together for that. Try asking it another way.",
    actions,
  }
}

module.exports = { askInanna, buildBriefing, daysUntil, cleanActions, withoutRepeatedDrafts }

const express = require('express')
const mongoose = require('mongoose')
const rateLimit = require('express-rate-limit')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const Member = require('../models/CapitalWatch/capitalWatch.Member')
const LoginToken = require('../models/CapitalWatch/capitalWatch.LoginToken')
const Business = require('../models/CapitalWatch/capitalWatch.Business')
const Decision = require('../models/CapitalWatch/capitalWatch.Decision')
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail')
const OPTIONS = require('../config/capitalWatchOptions')
const { hasSendGrid } = require('../config/capitalWatchTeam')
const { applicationDraftEmail, signInEmail, FROM_EMAIL } = require('../utils/capitalWatchEmail')
const { askInanna, buildBriefing, noEmDash } = require('../utils/capitalWatchInanna')
const { GRANT_FIELDS, getOpenGrants, businessForMember, matchesFor, businessProfileText } = require('../utils/capitalWatchData')
const { categoryOf } = require('../utils/capitalWatchMatching')
const auth = require('../utils/capitalWatchAuth')
const { subscribe } = require('../utils/newsletter')
const { getCapitalWatchUrl } = require('../utils/publicUrls')
const { aiChat: openai } = require('../utils/aiChat')

const router = express.Router()

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
const normalizeEmail = (v) => String(v || '').trim().toLowerCase().slice(0, 254)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fail = (res, status, message) => res.status(status).json({ message })

const limiter = (windowMs, limit, message, keyGenerator) => rateLimit({
  windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { message }, ...(keyGenerator ? { keyGenerator } : {}),
})
router.use(limiter(60 * 1000, 150, 'Too many requests. Try again shortly.'))
const signInIpLimiter = limiter(15 * 60 * 1000, 10, 'Too many sign-in attempts. Try again in a few minutes.')
const signInEmailLimiter = limiter(60 * 60 * 1000, 5, 'Too many sign-in emails for this address. Check your inbox or try again later.',
  (req) => `cw-email:${normalizeEmail(req.body?.email)}`)
const sendLimiter = limiter(60 * 60 * 1000, 20, 'Too many emails sent this hour. Try again later.')

function sendMail(msg) {
  if (!hasSendGrid()) return Promise.resolve(false)
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  return sgMail.send(msg)
}

const publicMember = (m) => ({
  id: String(m._id), email: m.email, name: m.name, role: m.role,
  digestOptOut: m.digestOptOut, limits: auth.limitsFor(m),
  usage: m.usage?.dayKey === auth.todayKey() ? { questions: m.usage.questions, drafts: m.usage.drafts } : { questions: 0, drafts: 0 },
})

// ─── Public ──────────────────────────────────────────────────────────────────

router.get('/options', (req, res) => {
  const { FUNDING_CATEGORIES, DEMOGRAPHICS, ENTITY_TYPES, STAGES, INDUSTRIES } = OPTIONS
  res.set('Cache-Control', 'public, max-age=3600')
  res.json({ fundingCategories: FUNDING_CATEGORIES, demographics: DEMOGRAPHICS, entityTypes: ENTITY_TYPES, stages: STAGES, industries: INDUSTRIES })
})

// Sign in or sign up. A new account requires joining the marketing list (that's the
// deal for free access). Always answers the same way, so it can't be used to find
// out who has an account.
router.post('/auth/request', signInIpLimiter, signInEmailLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    if (!EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address.')
    const consent = req.body?.consent === true
    const name = String(req.body?.name || '').trim().slice(0, 80)

    let member = await Member.findOne({ email })
    const isNew = !member
    if (isNew && !consent) return fail(res, 400, 'To create a free account, agree to receive our emails.')
    if (isNew) {
      member = await Member.create({
        email, name, role: auth.isAdminEmail(email) ? 'admin' : 'member',
        marketingConsent: true, marketingConsentAt: new Date(),
      }).catch(async (err) => {
        if (err.code === 11000) return Member.findOne({ email }) // two requests at once
        throw err
      })
    } else if (consent && !member.marketingConsent) {
      await Member.updateOne({ _id: member._id }, { $set: { marketingConsent: true, marketingConsentAt: new Date() } })
    }
    if (consent) subscribe(email, 'capitalwatch').catch((err) => console.error('[CapitalWatch] Newsletter add failed:', err.message))

    const token = auth.newLoginToken()
    await LoginToken.create({ tokenHash: auth.hashToken(token), email })
    const link = `${getCapitalWatchUrl()}?signin=${encodeURIComponent(token)}`
    if (!hasSendGrid()) {
      console.warn('[CapitalWatch] SendGrid not configured; sign-in link not emailed.')
      return fail(res, 503, 'Email is not configured on this server.')
    }
    await sendMail({ ...signInEmail(link, { isNew }), to: email })
    res.json({ message: 'Check your email for a sign-in link.' })
  } catch (err) {
    console.error('[CapitalWatch] Sign-in request failed:', err.message)
    fail(res, 500, 'Could not send the sign-in email. Try again.')
  }
})

router.post('/auth/verify', signInIpLimiter, async (req, res) => {
  try {
    const token = String(req.body?.token || '')
    if (!token) return fail(res, 400, 'Missing sign-in link.')
    // Deleted as it's used, so each link works once.
    const login = await LoginToken.findOneAndDelete({ tokenHash: auth.hashToken(token) })
    if (!login) return fail(res, 400, 'This sign-in link has expired or was already used. Request a new one.')

    const member = await Member.findOneAndUpdate(
      { email: login.email },
      { $set: { lastLoginAt: new Date(), ...(auth.isAdminEmail(login.email) ? { role: 'admin' } : {}) } },
      { new: true },
    )
    if (!member) return fail(res, 400, 'Account not found. Sign up again.')

    // Businesses a teammate invited this address to.
    await Business.updateMany(
      { pendingInvites: member.email },
      { $addToSet: { memberIds: member._id }, $pull: { pendingInvites: member.email } },
    )
    res.json({ token: auth.signSession(member), member: publicMember(member) })
  } catch (err) {
    console.error('[CapitalWatch] Sign-in verify failed:', err.message)
    fail(res, 500, 'Could not sign you in. Try again.')
  }
})

// One-click unsubscribe from digests and deadline alerts (link in those emails).
router.get('/unsubscribe', async (req, res) => {
  const page = (msg) => res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Capital Watch</title><body style="font-family:Menlo,Consolas,monospace;max-width:480px;margin:60px auto;padding:0 16px;color:#111"><h1 style="font-size:18px">Capital Watch</h1><p>${msg}</p><p><a href="${getCapitalWatchUrl()}" style="color:#000">Open the dashboard</a></p></body>`)
  const id = String(req.query.m || '')
  if (!mongoose.isValidObjectId(id) || !auth.verifyUnsubscribe(id, req.query.s)) return page('This unsubscribe link is not valid.')
  await Member.updateOne({ _id: id }, { $set: { digestOptOut: true } }).catch(() => {})
  page('Done. You will no longer get match digests or deadline alerts. You can turn them back on from the dashboard.')
})

// ─── Everything below needs a signed-in member ───────────────────────────────

router.use(auth.requireMember)

router.get('/me', async (req, res) => {
  const businesses = await Business.find({ memberIds: req.member._id }).sort({ createdAt: 1 }).lean()
  res.json({ member: publicMember(req.member), businesses })
})

router.patch('/me', async (req, res) => {
  const set = {}
  if (typeof req.body?.name === 'string') set.name = req.body.name.trim().slice(0, 80)
  if (typeof req.body?.digestOptOut === 'boolean') set.digestOptOut = req.body.digestOptOut
  const member = await Member.findByIdAndUpdate(req.member._id, { $set: set }, { new: true })
  res.json({ member: publicMember(member) })
})

// Deletes the account and every business that no one else shares.
router.delete('/me', async (req, res) => {
  try {
    const mine = await Business.find({ memberIds: req.member._id }).select('memberIds').lean()
    const solo = mine.filter((b) => b.memberIds.length <= 1).map((b) => b._id)
    await Promise.all([
      Decision.deleteMany({ business: { $in: solo } }),
      OutboundEmail.deleteMany({ business: { $in: solo } }),
      Business.deleteMany({ _id: { $in: solo } }),
      Business.updateMany({ memberIds: req.member._id }, { $pull: { memberIds: req.member._id } }),
    ])
    await Member.deleteOne({ _id: req.member._id })
    res.json({ message: 'Account deleted.' })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

// ─── Business profiles ───────────────────────────────────────────────────────

const pickIds = (value, allowed, max = 20) => (Array.isArray(value) ? [...new Set(value.filter((v) => allowed.includes(v)))].slice(0, max) : undefined)
const text = (v, max) => (typeof v === 'string' ? noEmDash(v).trim().slice(0, max) : undefined)
const num = (v, min, max) => {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined
}
const keywordList = (v) => (Array.isArray(v) ? [...new Set(v.map((k) => String(k).trim().toLowerCase()).filter((k) => k.length >= 2 && k.length <= 40))].slice(0, 30) : undefined)

// Only known fields, trimmed and bounded. Undefined = not sent = left as is.
function profileFromBody(body = {}) {
  const fields = {
    name: text(body.name, 120),
    website: text(body.website, 200),
    description: text(body.description, 2000),
    founders: text(body.founders, 1500),
    highlights: text(body.highlights, 1500),
    useOfFunds: text(body.useOfFunds, 600),
    country: text(body.country, 60),
    state: text(body.state, 60),
    city: text(body.city, 60),
    industries: pickIds(body.industries, OPTIONS.INDUSTRY_IDS),
    founderDemographics: pickIds(body.founderDemographics, OPTIONS.DEMOGRAPHIC_IDS),
    seeking: pickIds(body.seeking, OPTIONS.FUNDING_CATEGORY_IDS),
    ignoreCategories: pickIds(body.ignoreCategories, OPTIONS.FUNDING_CATEGORY_IDS),
    ignoreKeywords: keywordList(body.ignoreKeywords),
    stage: OPTIONS.STAGE_IDS.includes(body.stage) ? body.stage : (body.stage === '' ? '' : undefined),
    entityType: OPTIONS.ENTITY_TYPE_IDS.includes(body.entityType) ? body.entityType : undefined,
    foundedYear: num(body.foundedYear, 1800, 2100),
    teamSize: num(body.teamSize, 1, 1000000),
    amountMin: num(body.amountMin, 0, 1e10),
    amountMax: num(body.amountMax, 0, 1e10),
  }
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
}

router.get('/businesses', async (req, res) => {
  res.json(await Business.find({ memberIds: req.member._id }).sort({ createdAt: 1 }).lean())
})

router.post('/businesses', async (req, res) => {
  try {
    const count = await Business.countDocuments({ memberIds: req.member._id })
    if (count >= auth.limitsFor(req.member).businesses) return fail(res, 400, 'You have reached the limit of business profiles.')
    const fields = profileFromBody(req.body)
    if (!fields.name) return fail(res, 400, 'Give the business a name.')
    const business = await Business.create({ ...fields, memberIds: [req.member._id] })
    res.status(201).json(business)
  } catch (err) {
    fail(res, 500, err.message)
  }
})

router.patch('/businesses/:id', async (req, res) => {
  const fields = profileFromBody(req.body)
  if (fields.name === '') return fail(res, 400, 'The business needs a name.')
  const business = await Business.findOneAndUpdate(
    { _id: req.params.id, memberIds: req.member._id },
    { $set: fields },
    { new: true },
  ).lean().catch(() => null)
  if (!business) return fail(res, 404, 'Business not found.')
  res.json(business)
})

// Leaves a shared business; deletes it (with its decisions and drafts) if no one else is on it.
router.delete('/businesses/:id', async (req, res) => {
  const business = await businessForMember(req.member, req.params.id)
  if (!business) return fail(res, 404, 'Business not found.')
  if (business.memberIds.length > 1) {
    await Business.updateOne({ _id: business._id }, { $pull: { memberIds: req.member._id } })
    return res.json({ message: 'You left this business.' })
  }
  await Promise.all([
    Decision.deleteMany({ business: business._id }),
    OutboundEmail.deleteMany({ business: business._id }),
    Business.deleteOne({ _id: business._id }),
  ])
  res.json({ message: 'Business deleted.' })
})

router.get('/businesses/:id/members', async (req, res) => {
  const business = await businessForMember(req.member, req.params.id)
  if (!business) return fail(res, 404, 'Business not found.')
  const members = await Member.find({ _id: { $in: business.memberIds } }).select('email name').lean()
  res.json({ members: members.map((m) => ({ id: String(m._id), email: m.email, name: m.name })), pendingInvites: business.pendingInvites || [] })
})

// Share a business with a teammate. They get an email; the business shows up for
// them once they sign in (signing up joins the list like anyone else).
router.post('/businesses/:id/members', signInIpLimiter, async (req, res) => {
  const business = await businessForMember(req.member, req.params.id)
  if (!business) return fail(res, 404, 'Business not found.')
  const email = normalizeEmail(req.body?.email)
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address.')
  if ((business.memberIds.length + (business.pendingInvites || []).length) >= 10) return fail(res, 400, 'A business can have up to 10 people.')
  const existing = await Member.findOne({ email }).select('_id').lean()
  if (existing) {
    await Business.updateOne({ _id: business._id }, { $addToSet: { memberIds: existing._id } })
  } else {
    await Business.updateOne({ _id: business._id }, { $addToSet: { pendingInvites: email } })
  }
  const inviter = req.member.name || req.member.email
  sendMail({
    from: FROM_EMAIL,
    to: email,
    subject: `${inviter} shared ${business.name} with you on Capital Watch`,
    text: `${inviter} added you to ${business.name} on Capital Watch, a free tool that finds grants, loans and investors and ranks them for your business.\n\nOpen it here: ${getCapitalWatchUrl()}\n\nSign in with this email address (${email}) to see it.`,
  }).catch((err) => console.error('[CapitalWatch] Invite email failed:', err.message))
  res.json({ message: existing ? 'Added.' : 'Invite sent.' })
})

router.delete('/businesses/:id/members/:who', async (req, res) => {
  const business = await businessForMember(req.member, req.params.id)
  if (!business) return fail(res, 404, 'Business not found.')
  const who = req.params.who
  if (mongoose.isValidObjectId(who)) {
    if (business.memberIds.length <= 1) return fail(res, 400, 'A business needs at least one person. Delete it instead.')
    await Business.updateOne({ _id: business._id }, { $pull: { memberIds: new mongoose.Types.ObjectId(who) } })
  } else {
    await Business.updateOne({ _id: business._id }, { $pull: { pendingInvites: normalizeEmail(who) } })
  }
  res.json({ message: 'Removed.' })
})

// Every route below works on one business the member belongs to.
async function withBusiness(req, res, next) {
  const id = req.query.businessId || req.body?.businessId
  const business = await businessForMember(req.member, id)
  if (!business) return fail(res, 404, 'Choose one of your businesses first.')
  req.business = business
  next()
}

// ─── Opportunities ───────────────────────────────────────────────────────────

const VIEW_STATUS = { applied: 'approved', saved: 'archived', dismissed: 'rejected' }
const LIST_LIMIT = 300

function searchFilter(q) {
  const s = String(q || '').trim().slice(0, 100)
  if (!s) return () => true
  const re = new RegExp(escapeRegex(s), 'i')
  return (g) => re.test(g.title || '') || re.test(g.agency || '') || re.test(g.summary || '')
}

// view: matches (default) | all (matches including ones that aren't a fit) | applied | saved | dismissed
router.get('/grants', withBusiness, async (req, res) => {
  try {
    const view = String(req.query.view || 'matches')
    const category = String(req.query.category || 'all')
    const matchesSearch = searchFilter(req.query.q)
    const inCategory = (g) => category === 'all' || (g.category || categoryOf(g)) === category

    if (view === 'matches' || view === 'all') {
      const ranked = await matchesFor(req.business, { includeUnfit: view === 'all' })
      return res.json(ranked.filter((g) => matchesSearch(g) && inCategory(g)).slice(0, LIST_LIMIT))
    }

    const status = VIEW_STATUS[view]
    if (!status) return fail(res, 400, 'Unknown view.')
    const decisions = await Decision.find({ business: req.business._id, status }).sort({ updatedAt: -1 }).select('grant status updatedAt requirementsChecklist').lean()
    const grants = await Grant.find({ _id: { $in: decisions.map((d) => d.grant) } }).select(GRANT_FIELDS).lean()
    const byId = new Map(grants.map((g) => [String(g._id), g]))
    const rows = decisions
      .map((d) => {
        const g = byId.get(String(d.grant))
        if (!g) return null
        return {
          ...g,
          category: categoryOf(g),
          decidedAt: d.updatedAt,
          needsInput: (d.requirementsChecklist || []).filter((r) => r.status === 'needs_input').map((r) => r.requirement),
        }
      })
      .filter((g) => g && matchesSearch(g) && inCategory(g))
    res.json(rows.slice(0, LIST_LIMIT))
  } catch (err) {
    fail(res, 500, err.message)
  }
})

router.get('/stats', withBusiness, async (req, res) => {
  try {
    const [matches, counts] = await Promise.all([
      matchesFor(req.business),
      Decision.aggregate([{ $match: { business: req.business._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ])
    const byCategory = Object.fromEntries(OPTIONS.FUNDING_CATEGORY_IDS.map((id) => [id, 0]))
    for (const g of matches) byCategory[g.category] = (byCategory[g.category] || 0) + 1
    const n = Object.fromEntries(counts.map((c) => [c._id, c.n]))
    res.json({ matches: matches.length, byCategory, applied: n.approved || 0, saved: n.archived || 0, dismissed: n.rejected || 0 })
  } catch (err) {
    fail(res, 500, err.message)
  }
})

// The drafted application package for one applied opportunity.
router.get('/grants/:id/draft', withBusiness, async (req, res) => {
  const decision = await Decision.findOne({ business: req.business._id, grant: req.params.id, status: 'approved' })
    .select('outreachEmail applicationNarrative requirementsChecklist updatedAt').lean().catch(() => null)
  if (!decision) return fail(res, 404, 'No application draft for this opportunity.')
  res.json(decision)
})

async function generateApplicationDraft(grant, business) {
  const systemPrompt = `You are a founder preparing a complete, near submission-ready application package for a funding opportunity. Do as much of the actual work as possible so the founder only has to review and submit, not write from scratch.

Business profile (the only facts you may use about the business):
${businessProfileText(business)}

No generic template. Every opportunity is different; adapt tone and structure to what this one actually is:
- Government/agency grant or compliance-heavy program: formal, precise, fact-based. Emphasize eligibility, compliance, measurable impact.
- Angel investor / VC / accelerator: warmer, founder-to-founder hook plus signal. No hype, no invented metrics, no valuation language unless explicitly appropriate.
- Pitch competition / contest: punchy, differentiated, written to be judged quickly.
- Loan / lending program: conservative, financially grounded, emphasizing repayment ability and track record.
- Scholarship / fellowship: personal narrative grounded in the founders' background and this program's mission.
- If the opportunity is for a founder group or place the business genuinely belongs to, reference it specifically, never as a bolted-on statement.

Outreach email: write outreach_email as a real email from a founder. If a contact email is given, address that contact or agency. If none is given, write a short, polite inquiry to the program team (greeting "Hello,") that the founder can send once they find the right address. Never use placeholders like [Name] or [Email]. Give it a specific subject line in outreach_subject.

Never invent facts, numbers, customers, or results that are not in the profile. Where the application needs a fact the profile doesn't have, mark that requirement "needs_input" instead of making it up. Do not use em dashes anywhere.

Requirements handling:
1. Read the stated submission requirements line by line. Every required document, question, format rule, length limit, or audience instruction is binding.
2. Break them into a checklist, one entry per distinct requirement. For each:
   - Something you can fully draft from the profile: write it in full inside application_narrative under a heading matching the requirement; status "drafted", detail "Drafted in application narrative below."
   - Something only the founder can supply (signature, document, third-party letter, financials, video, a fact not in the profile): status "needs_input", and say specifically what to gather.
   - Not applicable: status "not_applicable", and say why.
3. If no requirements are stated, return one entry: { "requirement": "None explicitly stated", "status": "not_applicable", "detail": "Used standard professional submission practice." }
4. application_narrative has one heading per drafted requirement, ready to paste into the portal section by section.

Return ONLY valid JSON with this exact shape:
{
  "outreach_subject": "string",
  "outreach_email": "string",
  "application_narrative": "string",
  "requirements_checklist": [ { "requirement": "string", "status": "drafted" | "needs_input" | "not_applicable", "detail": "string" } ]
}`

  const userPrompt = `Write a complete application package for this funding opportunity:

Title: ${grant.title}
Organization: ${grant.agency || 'N/A'}
Type: ${categoryOf(grant)} (${grant.fundingType})
Amount: ${grant.amountUsd || 'N/A'}
Deadline: ${grant.rolling ? 'Rolling' : (grant.dueDate || 'N/A')}
Location: ${grant.location || 'N/A'}
Link: ${grant.link}
Contact email: ${grant.contactEmail || 'None found on the page'}
Founder groups stated as eligible: ${(grant.targetDemographics || []).join(', ') || 'None stated, open to all founders'}
Summary: ${grant.summary || 'N/A'}
Purpose: ${grant.why || 'N/A'}
Stated submission requirements (break these into the checklist and follow them exactly): ${grant.requirements || 'None explicitly stated, use standard professional submission practice.'}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: 0.4,
  }, { timeout: 90000 })
  return JSON.parse(response.choices[0].message.content)
}

const CHECK_STATUSES = new Set(['drafted', 'needs_input', 'not_applicable'])

// status: approved (apply: drafts an application) | archived (save) | rejected (dismiss)
// | pending (move back to matches).
router.patch('/grants/:id', withBusiness, async (req, res) => {
  try {
    const { status } = req.body || {}
    if (!['approved', 'archived', 'rejected', 'pending'].includes(status)) return fail(res, 400, 'Unknown status.')
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Opportunity not found.')
    const grant = await Grant.findById(req.params.id).select(GRANT_FIELDS).lean()
    if (!grant) return fail(res, 404, 'Opportunity not found.')
    const key = { business: req.business._id, grant: grant._id }

    if (status === 'pending') {
      await Decision.deleteOne({ ...key, status: { $ne: 'drafting' } })
      return res.json({ ok: true })
    }
    if (status !== 'approved') {
      const updated = await Decision.findOneAndUpdate(
        { ...key, status: { $nin: ['drafting', 'approved'] } },
        { $set: { status, decidedBy: req.member._id } },
        { upsert: true, new: true },
      ).catch((err) => (err.code === 11000 ? null : Promise.reject(err)))
      if (!updated) return fail(res, 409, 'This opportunity was already applied to. Move it back to matches first.')
      return res.json({ ok: true })
    }

    // Apply: claim first so two clicks (or two teammates) can't draft it twice.
    const previous = await Decision.findOne(key).lean()
    if (previous && ['approved', 'drafting'].includes(previous.status)) return fail(res, 409, 'Already applied to this one.')
    if (!(await auth.useAllowance(req.member, 'drafts'))) {
      return fail(res, 429, `You've used today's ${auth.limitsFor(req.member).drafts} application drafts. More tomorrow.`)
    }
    const claimed = previous
      ? await Decision.updateOne({ _id: previous._id, status: previous.status }, { $set: { status: 'drafting', decidedBy: req.member._id } }).then((r) => r.modifiedCount === 1)
      : await Decision.create({ ...key, status: 'drafting', decidedBy: req.member._id }).then(() => true, (err) => (err.code === 11000 ? false : Promise.reject(err)))
    if (!claimed) { await auth.refundAllowance(req.member, 'drafts'); return fail(res, 409, 'Already being drafted.') }

    let draft
    try {
      draft = await generateApplicationDraft(grant, req.business)
    } catch (err) {
      // Put it back and give the allowance back, so they can try again.
      if (previous) await Decision.updateOne(key, { $set: { status: previous.status } })
      else await Decision.deleteOne(key)
      await auth.refundAllowance(req.member, 'drafts')
      throw err
    }

    const checklist = (Array.isArray(draft.requirements_checklist) ? draft.requirements_checklist : [])
      .filter((c) => c && c.requirement)
      .map((c) => ({ requirement: noEmDash(c.requirement), status: CHECK_STATUSES.has(c.status) ? c.status : 'needs_input', detail: noEmDash(c.detail) }))
    const decision = await Decision.findOneAndUpdate(key, {
      $set: {
        status: 'approved',
        outreachEmail: noEmDash(draft.outreach_email),
        applicationNarrative: noEmDash(draft.application_narrative),
        requirementsChecklist: checklist,
      },
    }, { new: true }).lean()

    // The outreach email waits in the Outbox to be reviewed, addressed and sent.
    if (decision.outreachEmail) {
      await OutboundEmail.create({
        business: req.business._id,
        createdBy: req.member._id,
        grant: grant._id,
        grantTitle: grant.title,
        to: grant.contactEmail || '',
        subject: noEmDash(String(draft.outreach_subject || '').trim()).slice(0, 300) || `${req.business.name}: ${grant.title}`,
        body: decision.outreachEmail,
        source: 'approval',
      }).catch((err) => console.error('[CapitalWatch] Outbox draft failed:', err.message))
    }

    // The full package goes to everyone on the business, so it's easy to work from.
    const people = await Member.find({ _id: { $in: req.business.memberIds } }).select('email').lean()
    sendMail({ ...applicationDraftEmail({ ...grant, ...decision }, req.business.name), to: people.map((p) => p.email) })
      .catch((err) => console.error('[CapitalWatch] Draft email failed:', err.message))

    res.json({ ok: true, needsInput: checklist.filter((c) => c.status === 'needs_input').length })
  } catch (err) {
    console.error('[CapitalWatch] Decision failed:', err.message)
    fail(res, 500, 'Could not update this opportunity. Try again.')
  }
})

// ─── Inanna ──────────────────────────────────────────────────────────────────

router.get('/inanna/briefing', withBusiness, async (req, res) => {
  try {
    res.json(await buildBriefing(req.business))
  } catch (err) {
    fail(res, 500, err.message)
  }
})

router.post('/inanna/ask', withBusiness, async (req, res) => {
  if (!(await auth.useAllowance(req.member, 'questions'))) {
    return fail(res, 429, `You've asked Inanna ${auth.limitsFor(req.member).questions} questions today. More tomorrow.`)
  }
  try {
    res.json(await askInanna(req.business, req.body?.messages))
  } catch (err) {
    await auth.refundAllowance(req.member, 'questions')
    console.error('[CapitalWatch] Inanna ask failed:', err.message)
    fail(res, err.status || 500, err.status ? err.message : 'Inanna could not answer right now. Try again in a moment.')
  }
})

// ─── Outbox: outgoing emails wait here for a person to review ───────────────

const MAX_BODY = 20000

async function outboxEmailForMember(member, id) {
  if (!mongoose.isValidObjectId(id)) return null
  const email = await OutboundEmail.findById(id)
  if (!email?.business) return null
  const ok = await Business.exists({ _id: email.business, memberIds: member._id })
  return ok ? email : null
}

router.get('/outbox', withBusiness, async (req, res) => {
  const status = ['draft', 'sent', 'discarded'].includes(req.query.status) ? req.query.status : 'draft'
  res.json(await OutboundEmail.find({ business: req.business._id, status }).sort({ updatedAt: -1 }).limit(100).lean())
})

// Saves a new draft (from an Inanna suggestion or written by hand). Never sends.
router.post('/outbox', withBusiness, async (req, res) => {
  const { grantId, to, subject, body, source } = req.body || {}
  const grant = mongoose.isValidObjectId(grantId) ? await Grant.findById(grantId).select('title contactEmail').lean() : null
  const count = await OutboundEmail.countDocuments({ business: req.business._id, status: 'draft' })
  if (count >= 100) return fail(res, 400, 'The Outbox is full. Send or discard some drafts first.')
  const email = await OutboundEmail.create({
    business: req.business._id,
    createdBy: req.member._id,
    grant: grant?._id,
    grantTitle: grant?.title,
    to: String(to || grant?.contactEmail || '').trim().slice(0, 320),
    subject: noEmDash(String(subject || '')).trim().slice(0, 300),
    body: noEmDash(String(body || '')).slice(0, MAX_BODY),
    source: source === 'inanna' ? 'inanna' : 'manual',
  })
  res.status(201).json(email)
})

router.patch('/outbox/:id', async (req, res) => {
  const email = await outboxEmailForMember(req.member, req.params.id)
  if (!email) return fail(res, 404, 'Draft not found.')
  if (email.status !== 'draft') return fail(res, 409, `This email is already ${email.status}.`)
  if (req.body?.status === 'discarded') email.status = 'discarded'
  for (const f of ['to', 'subject', 'body']) {
    if (typeof req.body?.[f] === 'string') email[f] = f === 'body' ? req.body[f].slice(0, MAX_BODY) : req.body[f].trim().slice(0, 320)
  }
  await email.save()
  res.json(email)
})

// A member sent it from their own email app (the dashboard opened it there).
router.post('/outbox/:id/mark-sent', async (req, res) => {
  const email = await outboxEmailForMember(req.member, req.params.id)
  if (!email) return fail(res, 404, 'Draft not found.')
  await OutboundEmail.updateOne({ _id: email._id, status: 'draft' }, { $set: { status: 'sent', sentVia: 'own_email', sentAt: new Date() } })
  res.json({ ok: true })
})

// Admins only: send from our domain. Everyone else sends from their own email app,
// so free accounts can't use our domain to send mail.
router.post('/outbox/:id/send', auth.requireAdmin, sendLimiter, async (req, res) => {
  try {
    if (!hasSendGrid()) return fail(res, 503, 'Email sending is not configured on this server.')
    const found = await outboxEmailForMember(req.member, req.params.id)
    if (!found) return fail(res, 404, 'Draft not found.')
    // Claim atomically so a double click cannot send it twice.
    const email = await OutboundEmail.findOneAndUpdate(
      { _id: found._id, status: 'draft' },
      { $set: { status: 'sent', sentVia: 'server', sentAt: new Date() }, $unset: { sendError: 1 } },
      { new: true },
    )
    if (!email) return fail(res, 409, 'This draft was already sent or discarded.')

    const to = email.to.trim()
    const problem = !EMAIL_RE.test(to) ? 'Add a valid recipient address before sending.'
      : !email.subject.trim() ? 'Add a subject before sending.'
      : !email.body.trim() ? 'The email body is empty.'
      : null
    if (problem) {
      await OutboundEmail.updateOne({ _id: email._id }, { $set: { status: 'draft' }, $unset: { sentAt: 1, sentVia: 1 } })
      return fail(res, 400, problem)
    }

    const team = await Member.find({ _id: { $in: (await Business.findById(email.business).select('memberIds').lean())?.memberIds || [] } }).select('email').lean()
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    try {
      await sendMail({
        from: FROM_EMAIL,
        to,
        bcc: team.map((t) => t.email).filter((e) => e !== to.toLowerCase()),
        replyTo: req.member.email,
        subject: email.subject.trim(),
        text: email.body,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escape(email.body)}</div>`,
      })
    } catch (err) {
      const message = err.response?.body?.errors?.[0]?.message || err.message
      await OutboundEmail.updateOne({ _id: email._id }, { $set: { status: 'draft', sendError: message }, $unset: { sentAt: 1, sentVia: 1 } })
      return fail(res, 502, `Send failed: ${message}`)
    }
    res.json(email)
  } catch (err) {
    fail(res, 500, err.message)
  }
})

// ─── Admin ───────────────────────────────────────────────────────────────────

router.get('/admin/summary', auth.requireAdmin, async (req, res) => {
  const day = 86400000
  const since = (days) => new Date(Date.now() - days * day)
  const [members, week, month, businesses, open, state] = await Promise.all([
    Member.countDocuments(),
    Member.countDocuments({ createdAt: { $gte: since(7) } }),
    Member.countDocuments({ createdAt: { $gte: since(30) } }),
    Business.countDocuments(),
    getOpenGrants().then((g) => g.length),
    mongoose.connection.collection('capitalwatch.state').findOne({ _id: 'rotation' }),
  ])
  res.json({ members, signupsLast7Days: week, signupsLast30Days: month, businesses, openOpportunities: open, lastScrapeAt: state?.lastRunAt || null })
})

module.exports = router

const crypto = require('crypto')
const express = require('express')
const rateLimit = require('express-rate-limit')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail')
const { getCompanies, getCompanyProfile } = require('../config/capitalWatchCompanies')
const { RECIPIENTS, hasSendGrid } = require('../config/capitalWatchTeam')
const { applicationDraftEmail, FROM_EMAIL } = require('../utils/capitalWatchEmail')
const { scoreGrant } = require('../utils/capitalWatchScoring')
const { askInanna, buildBriefing, noEmDash } = require('../utils/capitalWatchInanna')
const { aiChat: openai } = require('../utils/aiChat')

const router = express.Router()

// ─── Access ──────────────────────────────────────────────────────────────────
// The dashboard is an internal tool on a public site. The key is typed in by the
// team (never built into the site's code) and only accepted in a header, so it
// doesn't end up in server or proxy logs the way a ?key= query string does.

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest()

function keyMatches(given) {
  const expected = process.env.CAPITAL_WATCH_KEY
  if (!expected || !given) return false
  // Compare fixed-length hashes so the check takes the same time for every guess.
  return crypto.timingSafeEqual(sha256(given), sha256(expected))
}

// This key was shipped inside aoncreative.io's JavaScript before 2026-11-26, so
// anyone could have copied it. Until CAPITAL_WATCH_KEY is changed on the server,
// sending email from the Outbox stays off (it would otherwise let anyone send mail
// from our domain). Only the hash is kept here, never the key.
const LEAKED_KEY_SHA256 = '81f2720b81af4ee56058f1146d6de0c78718538b81b9888f500641388a7f89e3' // gitleaks:allow (SHA-256 of a revoked key, not a secret)
const keyIsLeaked = () => sha256(process.env.CAPITAL_WATCH_KEY || '').toString('hex') === LEAKED_KEY_SHA256

// Wrong-key attempts: counts only failed requests, so normal use is unaffected.
const failedKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again in a few minutes.' },
})

const limiter = (windowMs, limit, message) => rateLimit({
  windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { message },
})
// Caps on the endpoints that cost money (AI) or send mail, in case the key leaks again.
const generalLimiter = limiter(60 * 1000, 120, 'Too many requests. Try again shortly.')
const askLimiter = limiter(60 * 60 * 1000, 60, 'Inanna has answered a lot this hour. Try again later.')
const approveLimiter = limiter(60 * 60 * 1000, 30, 'Too many approvals this hour. Try again later.')
const sendLimiter = limiter(60 * 60 * 1000, 20, 'Too many emails sent this hour. Try again later.')

router.use(failedKeyLimiter, generalLimiter, (req, res, next) => {
  if (!keyMatches(req.get('x-capitalwatch-key'))) return res.status(401).json({ message: 'Unauthorized' })
  next()
})

router.get('/companies', (req, res) => {
  res.json(getCompanies())
})

// ─── Opportunities ───────────────────────────────────────────────────────────

const ANGEL_RE = /angel/i
const VENTURE_RE = /venture|\bvc\b/i

// One definition of each bucket, used by both the stat counts and the stat filters,
// so a number on the dashboard always equals the rows its filter shows. Each grant
// lands in exactly one bucket (loan, then venture, then angel, then grant).
function categoryOf(grant) {
  const text = `${grant.title || ''} ${grant.agency || ''}`
  if (grant.fundingType === 'loan') return 'loans'
  if (VENTURE_RE.test(text)) return 'venture'
  if (ANGEL_RE.test(text)) return 'angels'
  return 'grants'
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The list only needs these fields; drafts and checklists are large and stay on the server.
const LIST_FIELDS = 'title agency fundingType amountUsd dueDate rolling location link summary requirements targetDemographics status company dateFound hotLead contactEmail'
const LIST_LIMIT = 300

router.get('/grants', async (req, res) => {
  try {
    const { status = 'pending', q, category } = req.query
    const filter = {}
    if (status && status !== 'all') filter.status = String(status)
    const search = String(q || '').trim().slice(0, 100)
    if (search) {
      // Escaped: a search like "(" or "a+" must not crash the query or run a costly pattern.
      const re = new RegExp(escapeRegex(search), 'i')
      filter.$or = [{ title: re }, { agency: re }, { summary: re }]
    }

    let grants = await Grant.find(filter).select(LIST_FIELDS).lean()
    if (category && category !== 'all') grants = grants.filter((g) => categoryOf(g) === category)
    // Most promising first: best demographic fit + highest payout + least work to apply.
    grants.sort((a, b) => scoreGrant(b) - scoreGrant(a))
    res.json(grants.slice(0, LIST_LIMIT))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const pending = await Grant.find({ status: 'pending' }).select('title agency fundingType').lean()
    const stats = { grants: 0, angels: 0, venture: 0, loans: 0 }
    for (const g of pending) stats[categoryOf(g)]++
    res.json(stats)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

async function generateApplicationDraft(grant, company) {
  const systemPrompt = `You are a founder preparing a complete, near submission-ready application package for a funding opportunity. Your job is to do as much of the actual work as possible so the founder only has to review and submit, not write from scratch.

Company context (must preserve):
${company.profile}

CRITICAL: no generic template. Every opportunity below is different; do not reuse the same tone, structure, or framing across opportunities. Before writing, work out from the details given what kind of opportunity this actually is, and adapt:
- Government/agency grant or compliance-heavy program: formal, precise, fact-based. No pitch-deck energy. Emphasize eligibility, compliance, measurable impact.
- Angel investor / VC / accelerator: warmer, founder-to-founder hook plus signal. Light pitch energy, but no hype, no invented metrics, no valuation language unless explicitly appropriate.
- Pitch competition / contest: punchy, differentiated, written to be read or judged quickly; assume a panel or public audience.
- Loan / lending program: conservative, financially grounded, emphasizing repayment ability and track record, not vision.
- Scholarship / fellowship: personal narrative grounded in the founder's specific background and this program's stated mission, not generic company boilerplate.
- If a specific demographic this company genuinely qualifies under (veteran, Black-owned, etc.) is named as relevant, weave it in naturally and specifically, never as a bolted-on generic diversity statement.
- If a specific location (e.g. Atlanta/Georgia) is named as relevant, reference the company's actual ties to that location rather than a generic mention.

Outreach email: write outreach_email as a real email from the founder. If a contact email is given below, address it to that contact or agency. If none is given, write it as a short, polite inquiry to the program team (greeting "Hello,") that the founder can send once they find the right address; never use placeholders like [Name] or [Email]. Give it a specific subject line in outreach_subject.

Never invent facts, numbers, customers, or results that are not in the company context. Do not use em dashes anywhere.

CRITICAL: requirements handling.
1. Read the stated submission requirements/standards below line by line. Treat every required document, question, format rule, length limit, or audience instruction as binding; it overrides the default tone/structure above.
2. Break the requirements into a checklist, one entry per distinct requirement (e.g. "2 letters of recommendation", "budget breakdown", "500-word answer to X", "EIN/Tax ID", "video pitch"). For each one:
   - If it's something you can fully draft from the company context (a written answer, narrative, statement, budget summary, etc.), write it out in full inside application_narrative under a clear heading matching that requirement, and mark its checklist status "drafted" with detail "Drafted in application narrative below."
   - If it's something only the founder can supply (a signature, a specific document/file, a third-party letter, financial statements, a video, an in-person component), mark its checklist status "needs_input" and write specifically what they need to gather or do in detail.
   - If a requirement doesn't apply (e.g. asks for something the company context already shows isn't relevant), mark "not_applicable" and say why in detail.
3. If no requirements are stated, return a single checklist entry: { "requirement": "None explicitly stated", "status": "not_applicable", "detail": "Used standard professional submission practice." }
4. application_narrative should be structured with one heading per drafted requirement (not a generic three-paragraph blob) so it's ready to copy into the application portal section by section.

Return ONLY valid JSON with this exact shape, no markdown, no extra text:
{
  "outreach_subject": "string",
  "outreach_email": "string",
  "application_narrative": "string",
  "requirements_checklist": [ { "requirement": "string", "status": "drafted" | "needs_input" | "not_applicable", "detail": "string" } ]
}`

  const userPrompt = `Write a complete application package for this funding opportunity:

Title: ${grant.title}
Agency: ${grant.agency || 'N/A'}
Funding Type: ${grant.fundingType}
Amount: ${grant.amountUsd || 'N/A'}
Deadline: ${grant.rolling ? 'Rolling' : (grant.dueDate || 'N/A')}
Location: ${grant.location || 'N/A'}
Link: ${grant.link}
Contact Email: ${grant.contactEmail || 'None found on the page'}
Target Demographics Stated As Eligible: ${(grant.targetDemographics || []).join(', ') || 'None stated, open to all founders'}
Summary: ${grant.summary || 'N/A'}
Why this matters / fit for this company: ${grant.why || 'N/A'}
Stated submission requirements/standards (break these into the checklist and follow them exactly): ${grant.requirements || 'None explicitly stated, use standard professional submission practice.'}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
  }, { timeout: 90000 })

  return JSON.parse(response.choices[0].message.content)
}

const STATUS_CHANGES = ['approved', 'rejected', 'archived']
// Only these can be approved; re-approving an applied opportunity would draft and email again.
const APPROVABLE = ['pending', 'archived']

router.patch('/grants/:id', async (req, res, next) => {
  if (req.body?.status === 'approved') return approveLimiter(req, res, next)
  next()
}, async (req, res) => {
  try {
    const { status, companyId } = req.body || {}
    if (!STATUS_CHANGES.includes(status)) {
      return res.status(400).json({ message: 'status must be approved, rejected, or archived' })
    }

    if (status === 'rejected' || status === 'archived') {
      const grant = await Grant.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).select(LIST_FIELDS).lean()
      if (!grant) return res.status(404).json({ message: 'Grant not found' })
      return res.json(grant)
    }

    const company = getCompanyProfile(companyId)
    if (!company) return res.status(400).json({ message: 'Valid companyId is required to approve' })

    // Claim the grant first, so two clicks (or two teammates) can't both draft and email it.
    const previous = await Grant.findOneAndUpdate(
      { _id: req.params.id, status: { $in: APPROVABLE } },
      { $set: { status: 'approved', company: company.id } },
    )
    if (!previous) {
      const exists = await Grant.exists({ _id: req.params.id })
      return res.status(exists ? 409 : 404).json({ message: exists ? 'This opportunity was already approved or removed.' : 'Grant not found' })
    }

    let draft
    try {
      draft = await generateApplicationDraft(previous, company)
    } catch (err) {
      // Put it back so the team can try again.
      await Grant.updateOne({ _id: previous._id }, { $set: { status: previous.status }, $unset: { company: 1 } })
      throw err
    }

    const grant = await Grant.findById(previous._id)
    grant.outreachEmail = noEmDash(String(draft.outreach_email || ''))
    grant.applicationNarrative = noEmDash(String(draft.application_narrative || ''))
    grant.requirementsChecklist = Array.isArray(draft.requirements_checklist)
      ? draft.requirements_checklist.map((c) => ({ ...c, detail: noEmDash(String(c?.detail || '')) }))
      : []
    await grant.save()

    // The outreach email always waits in the Outbox for a person to review, address
    // (when no contact was found) and send. It is never sent from here.
    if (grant.outreachEmail) {
      await OutboundEmail.create({
        grant: grant._id,
        grantTitle: grant.title,
        company: company.id,
        to: grant.contactEmail || '',
        subject: noEmDash(String(draft.outreach_subject || '').trim()) || `${company.name}: ${grant.title}`,
        body: grant.outreachEmail,
        source: 'approval',
      }).catch((err) => console.error('[CapitalWatch] Outbox draft failed:', err.message))
    }

    if (hasSendGrid()) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      const msg = { ...applicationDraftEmail(grant, company.name), to: RECIPIENTS }
      sgMail.send(msg).catch((err) => console.error('[CapitalWatch] Draft email failed:', err.message))
    }

    const out = grant.toObject()
    res.json(out)
  } catch (err) {
    console.error('[CapitalWatch] Status change failed:', err.message)
    res.status(500).json({ message: 'Could not update this opportunity. Try again.' })
  }
})

// ─── Inanna (assistant orb on the dashboard) ─────────────────────────────────

router.get('/inanna/briefing', async (req, res) => {
  try {
    res.json(await buildBriefing())
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/inanna/ask', askLimiter, async (req, res) => {
  try {
    res.json(await askInanna(req.body?.messages))
  } catch (err) {
    console.error('[CapitalWatch] Inanna ask failed:', err.message)
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Inanna could not answer right now. Try again in a moment.' })
  }
})

// ─── Outbox: outgoing emails wait here for a person to review and send ──────

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
const OUTBOX_FIELDS = ['to', 'subject', 'body']
const MAX_BODY = 20000

router.get('/outbox', async (req, res) => {
  try {
    const status = ['draft', 'sent', 'discarded'].includes(req.query.status) ? req.query.status : 'draft'
    res.json(await OutboundEmail.find({ status }).sort({ updatedAt: -1 }).limit(100).lean())
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Saves a new draft (from an Inanna suggestion or written by hand). Never sends.
router.post('/outbox', async (req, res) => {
  try {
    const { grantId, companyId, to, subject, body, source } = req.body || {}
    const grant = grantId ? await Grant.findById(grantId).select('title company contactEmail').lean().catch(() => null) : null
    const email = await OutboundEmail.create({
      grant: grant?._id,
      grantTitle: grant?.title,
      company: getCompanyProfile(companyId)?.id || grant?.company,
      to: String(to || grant?.contactEmail || '').trim().slice(0, 320),
      subject: String(subject || '').trim().slice(0, 300),
      body: String(body || '').slice(0, MAX_BODY),
      source: source === 'inanna' ? 'inanna' : 'manual',
    })
    res.status(201).json(email)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.patch('/outbox/:id', async (req, res) => {
  try {
    const email = await OutboundEmail.findById(req.params.id)
    if (!email) return res.status(404).json({ message: 'Draft not found' })
    if (email.status !== 'draft') return res.status(409).json({ message: `This email is already ${email.status}.` })
    if (req.body?.status === 'discarded') email.status = 'discarded'
    for (const f of OUTBOX_FIELDS) {
      if (typeof req.body?.[f] === 'string') email[f] = f === 'body' ? req.body[f].slice(0, MAX_BODY) : req.body[f].trim().slice(0, 320)
    }
    await email.save()
    res.json(email)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// The only place an outside email is sent: a person clicked Send on a reviewed draft.
// The team gets a blind copy, and replies go to the founder, not the no-reply sender.
router.post('/outbox/:id/send', sendLimiter, async (req, res) => {
  try {
    if (keyIsLeaked()) {
      return res.status(403).json({ message: 'Sending is paused until the Capital Watch key is changed on the server (the old key was exposed).' })
    }
    if (!hasSendGrid()) return res.status(503).json({ message: 'Email sending is not configured on this server.' })

    // Claim the draft atomically so a double click cannot send it twice.
    const email = await OutboundEmail.findOneAndUpdate(
      { _id: req.params.id, status: 'draft' },
      { $set: { status: 'sent', sentAt: new Date() }, $unset: { sendError: 1 } },
      { new: true },
    )
    if (!email) return res.status(409).json({ message: 'This draft was already sent or discarded.' })

    const to = email.to.trim()
    const problem = !EMAIL_RE.test(to) ? 'Add a valid recipient address before sending.'
      : !email.subject.trim() ? 'Add a subject before sending.'
      : !email.body.trim() ? 'The email body is empty.'
      : null
    if (problem) {
      await OutboundEmail.updateOne({ _id: email._id }, { $set: { status: 'draft' }, $unset: { sentAt: 1 } })
      return res.status(400).json({ message: problem })
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    try {
      await sgMail.send({
        from: FROM_EMAIL,
        to,
        bcc: RECIPIENTS.filter((r) => r.toLowerCase() !== to.toLowerCase()),
        replyTo: RECIPIENTS[0],
        subject: email.subject.trim(),
        text: email.body,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escape(email.body)}</div>`,
      })
    } catch (err) {
      const message = err.response?.body?.errors?.[0]?.message || err.message
      await OutboundEmail.updateOne({ _id: email._id }, { $set: { status: 'draft', sendError: message }, $unset: { sentAt: 1 } })
      return res.status(502).json({ message: `Send failed: ${message}` })
    }
    res.json(email)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

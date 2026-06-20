const express = require('express')
const OpenAI = require('openai')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const { getCompanies, getCompanyProfile } = require('../config/capitalWatchCompanies')
const { applicationDraftEmail } = require('../utils/capitalWatchEmail')
const { scoreGrant } = require('../utils/capitalWatchScoring')

const router = express.Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const RECIPIENTS = ['darrienccarter@gmail.com', 'Mercedes.anthony20@gmail.com', 'dsdavisjr3@gmail.com']

function requireCapitalWatchKey(req, res, next) {
  const key = req.headers['x-capitalwatch-key'] || req.query.key
  if (!process.env.CAPITAL_WATCH_KEY || key !== process.env.CAPITAL_WATCH_KEY) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  next()
}

router.use(requireCapitalWatchKey)

router.get('/companies', (req, res) => {
  res.json(getCompanies())
})

const ANGEL_RE = /angel/i
const VENTURE_RE = /venture|\bvc\b/i

// Same bucket definitions /stats counts with, so clicking a stat number filters to
// exactly what that number represents. Done in JS (not a Mongo query) so it composes
// cleanly with the free-text search filter instead of fighting over $or.
function matchesCategory(grant, category) {
  const isAngel = ANGEL_RE.test(grant.title || '') || ANGEL_RE.test(grant.agency || '')
  const isVenture = VENTURE_RE.test(grant.title || '') || VENTURE_RE.test(grant.agency || '')
  const isLoan = grant.fundingType === 'loan'
  if (category === 'angels') return isAngel
  if (category === 'venture') return isVenture
  if (category === 'loans') return isLoan
  if (category === 'grants') return !isAngel && !isVenture && !isLoan
  return true
}

router.get('/grants', async (req, res) => {
  try {
    const { status = 'pending', q, category } = req.query
    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (q) {
      const re = new RegExp(String(q).trim(), 'i')
      filter.$or = [{ title: re }, { agency: re }]
    }

    let grants = await Grant.find(filter).lean()
    if (category && category !== 'all') grants = grants.filter((g) => matchesCategory(g, category))
    // Most promising first: best demographic fit + highest payout + least work to apply.
    grants.sort((a, b) => scoreGrant(b) - scoreGrant(a))
    res.json(grants)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const [total, angels, venture, loans] = await Promise.all([
      Grant.countDocuments({ status: 'pending' }),
      Grant.countDocuments({ status: 'pending', $or: [{ title: /angel/i }, { agency: /angel/i }] }),
      Grant.countDocuments({ status: 'pending', $or: [{ title: /venture|\bvc\b/i }, { agency: /venture|\bvc\b/i }] }),
      Grant.countDocuments({ status: 'pending', fundingType: 'loan' }),
    ])
    res.json({ grants: total - angels - venture - loans, angels, venture, loans })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

async function generateApplicationDraft(grant, company) {
  const systemPrompt = `You are a founder preparing a complete, near submission-ready application package for a funding opportunity. Your job is to do as much of the actual work as possible so the founder only has to review and submit — not write from scratch.

Company context (must preserve):
${company.profile}

CRITICAL — no generic template. Every opportunity below is different; do not reuse the same tone, structure, or framing across opportunities. Before writing, work out from the details given what kind of opportunity this actually is, and adapt:
- Government/agency grant or compliance-heavy program → formal, precise, fact-based. No pitch-deck energy. Emphasize eligibility, compliance, measurable impact.
- Angel investor / VC / accelerator → warmer, founder-to-founder hook plus signal. Light pitch energy, but no hype, no invented metrics, no valuation language unless explicitly appropriate.
- Pitch competition / contest → punchy, differentiated, written to be read or judged quickly; assume a panel or public audience.
- Loan / lending program → conservative, financially grounded, emphasizing repayment ability and track record, not vision.
- Scholarship / fellowship → personal narrative grounded in the founder's specific background and this program's stated mission, not generic company boilerplate.
- If a specific demographic this company genuinely qualifies under (veteran, Black-owned, etc.) is named as relevant, weave it in naturally and specifically — never a bolted-on generic diversity statement.
- If a specific location (e.g. Atlanta/Georgia) is named as relevant, reference the company's actual ties to that location rather than a generic mention.

Outreach channel: if a contact email is given below, write outreach_email as a real cold email to that named contact/agency. If no contact email is given, this is most likely a direct portal/form submission with no email outreach step — write outreach_email instead as a short cover note meant to accompany the submission, and say explicitly that there's no separate outreach email needed for this one.

CRITICAL — requirements handling:
1. Read the stated submission requirements/standards below line by line. Treat every required document, question, format rule, length limit, or audience instruction as binding — it overrides the default tone/structure above.
2. Break the requirements into a checklist, one entry per distinct requirement (e.g. "2 letters of recommendation", "budget breakdown", "500-word answer to X", "EIN/Tax ID", "video pitch"). For each one:
   - If it's something you can fully draft from the company context (a written answer, narrative, statement, budget summary, etc.), write it out in full inside application_narrative under a clear heading matching that requirement, and mark its checklist status "drafted" with detail "Drafted in application narrative below."
   - If it's something only the founder can supply (a signature, a specific document/file, a third-party letter, financial statements, a video, an in-person component), mark its checklist status "needs_input" and write specifically what they need to gather or do in detail.
   - If a requirement doesn't apply (e.g. asks for something the company context already shows isn't relevant), mark "not_applicable" and say why in detail.
3. If no requirements are stated, return a single checklist entry: { "requirement": "None explicitly stated", "status": "not_applicable", "detail": "Used standard professional submission practice." }
4. application_narrative should be structured with one heading per drafted requirement (not a generic three-paragraph blob) so it's ready to copy into the application portal section by section.

Return ONLY valid JSON with this exact shape, no markdown, no extra text:
{
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
Contact Email: ${grant.contactEmail || 'None given — most likely a direct portal/form submission, not email outreach'}
Target Demographics Stated As Eligible: ${(grant.targetDemographics || []).join(', ') || 'None stated — open to all founders'}
Summary: ${grant.summary || 'N/A'}
Why this matters / fit for this company: ${grant.why || 'N/A'}
Stated submission requirements/standards (break these into the checklist and follow them exactly): ${grant.requirements || 'None explicitly stated — use standard professional submission practice.'}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
  })

  return JSON.parse(response.choices[0].message.content)
}

router.patch('/grants/:id', async (req, res) => {
  try {
    const { status, companyId } = req.body
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' })
    }

    const grant = await Grant.findById(req.params.id)
    if (!grant) return res.status(404).json({ message: 'Grant not found' })

    if (status === 'rejected') {
      grant.status = 'rejected'
      await grant.save()
      return res.json(grant)
    }

    // approved
    const company = getCompanyProfile(companyId)
    if (!company) return res.status(400).json({ message: 'Valid companyId is required to approve' })

    const draft = await generateApplicationDraft(grant, company)
    grant.status = 'approved'
    grant.company = company.id
    grant.outreachEmail = draft.outreach_email || ''
    grant.applicationNarrative = draft.application_narrative || ''
    grant.requirementsChecklist = Array.isArray(draft.requirements_checklist) ? draft.requirements_checklist : []
    await grant.save()

    const apiKey = process.env.SENDGRID_API_KEY
    if (apiKey && apiKey !== 'SG.placeholder') {
      sgMail.setApiKey(apiKey)
      const msg = { ...applicationDraftEmail(grant, company.name), to: RECIPIENTS }
      sgMail.send(msg).catch(err => console.error('[CapitalWatch] Draft email failed:', err.message))
    }

    res.json(grant)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

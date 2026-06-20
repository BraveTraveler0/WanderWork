const express = require('express')
const OpenAI = require('openai')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const { getCompanies, getCompanyProfile } = require('../config/capitalWatchCompanies')
const { applicationDraftEmail } = require('../utils/capitalWatchEmail')

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

router.get('/grants', async (req, res) => {
  try {
    const { status = 'pending', q } = req.query
    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (q) {
      const re = new RegExp(String(q).trim(), 'i')
      filter.$or = [{ title: re }, { agency: re }]
    }
    const grants = await Grant.find(filter).sort({ dateFound: -1 }).lean()
    res.json(grants)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const [total, angels, venture] = await Promise.all([
      Grant.countDocuments({ status: 'pending' }),
      Grant.countDocuments({ status: 'pending', $or: [{ title: /angel/i }, { agency: /angel/i }] }),
      Grant.countDocuments({ status: 'pending', $or: [{ title: /venture|\bvc\b/i }, { agency: /venture|\bvc\b/i }] }),
    ])
    res.json({ grants: total - angels - venture, angels, venture })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

async function generateApplicationDraft(grant, company) {
  const systemPrompt = `You are a founder writing a short, thoughtful outreach email and a concise three-paragraph application narrative for a funding opportunity.

Company context (must preserve):
${company.profile}

This is not a generic pitch. It is a hook plus a signal. Calm, grounded, founder-to-founder tone. No hype, no exaggerated market sizing, no valuation language unless explicitly appropriate.

CRITICAL: The opportunity below has stated submission requirements/standards. You MUST follow them exactly — if it specifies a format, required sections, length, documents, or a particular tone/audience, honor that over the default style described above.

Return ONLY valid JSON with this exact shape, no markdown, no extra text:
{ "outreach_email": "string", "application_narrative": "string" }`

  const userPrompt = `Write application materials for this funding opportunity:

Title: ${grant.title}
Agency: ${grant.agency || 'N/A'}
Funding Type: ${grant.fundingType}
Amount: ${grant.amountUsd || 'N/A'}
Deadline: ${grant.rolling ? 'Rolling' : (grant.dueDate || 'N/A')}
Location: ${grant.location || 'N/A'}
Link: ${grant.link}
Why this matters: ${grant.why || 'N/A'}
Stated submission requirements/standards (follow these exactly): ${grant.requirements || 'None explicitly stated — use standard professional submission practice.'}`

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

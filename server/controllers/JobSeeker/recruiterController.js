const asyncHandler = require('express-async-handler')
const mongoose = require('mongoose')
const nodemailer = require('nodemailer')
const axios = require('axios')
const Recruiter = require('../../models/JobSeeker/jobSeeker.Recruiter')
const RecruiterContact = require('../../models/JobSeeker/jobSeeker.RecruiterContact')
const CandidateModel = require('../../models/JobSeeker/jobSeeker.Candidate')
const {
  getRecruitersForCompany,
  pairRecruitersToCompanies,
} = require('../../services/recruiterCompanyPairingService')

// ── Daily recruiter contact limits ───────────────────────────────────────────
const PLAN_MAX = { free: 10, upgraded: 20, premium: 30 }

// Computes effective recruiterContactsLeft without touching the DB — use for reads.
function computeRecruiterContacts(candidate) {
  const max = PLAN_MAX[candidate.plan || 'free'] || 10
  const left = candidate.recruiterContactsLeft ?? max
  const updatedAt = candidate.recruiterContactsUpdatedAt ?? new Date(0)
  const daysElapsed = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
  return { left: Math.min(left + daysElapsed, max), max }
}

// Applies any earned refills to the DB then returns the refreshed count.
async function refillRecruiterContacts(candidateId) {
  const candidate = await CandidateModel.findById(candidateId).lean()
  if (!candidate) return null
  const max = PLAN_MAX[candidate.plan || 'free'] || 10
  const left = candidate.recruiterContactsLeft ?? max
  const updatedAt = candidate.recruiterContactsUpdatedAt ?? new Date(0)
  const daysElapsed = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
  if (daysElapsed <= 0) return left
  const newLeft = Math.min(left + daysElapsed, max)
  const newUpdatedAt = new Date(new Date(updatedAt).getTime() + daysElapsed * 86400000)
  await CandidateModel.updateOne(
    { _id: candidateId },
    { $set: { recruiterContactsLeft: newLeft, recruiterContactsUpdatedAt: newUpdatedAt } }
  )
  return newLeft
}

// ── Email transporter (SMTP) ─────────────────────────────────────────────────
const getTransporter = () => {
  const user = process.env.EMAIL_SMTP_USER
  const pass = process.env.EMAIL_SMTP_PASS
  if (!user || !pass) return null
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_SMTP_PORT) || 587,
    secure: false,
    auth: { user, pass },
  })
}

// ── On-demand email draft generation via OpenAI ──────────────────────────────
const DRAFT_SYSTEM_PROMPT = `You write short outreach emails for a job seeker to recruiters, talent partners, and hiring managers.
Output only the email body. No subject line. No markdown. No bullet points. No em dashes.
Use "Hey [First Name]," at the start when a first name is available, otherwise "Hey,".
Keep it 5 to 8 sentences. Warm, confident, casual, and professional. Never salesy or AI-sounding.`

async function generateEmailDraft(recruiter, candidate) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const userName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'the candidate'
  const userPrompt = `Write a short recruiter outreach email using these details.
Recipient first name: ${recruiter.firstName || ''}
Recipient full name: ${recruiter.name || ''}
Recipient role: ${recruiter.jobTitle || ''}
Company: ${recruiter.company || ''}
Specialty: ${recruiter.specialty || ''}

Sender: ${userName}
Sender skills: ${(candidate.skills || []).slice(0, 8).join(', ')}
Sender target roles: ${(candidate.targetRoles || []).slice(0, 4).join(', ')}

Ask if they are hiring now or expect freelance, contract, or full-time needs soon. End casually.`

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: DRAFT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
      },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    )
    return response.data?.choices?.[0]?.message?.content?.trim() || null
  } catch (e) {
    console.warn('OpenAI draft generation failed:', e.message)
    return null
  }
}

// ── Specialty inference from candidate profile ──────────────────────────────
const SPECIALTY_RULES = [
  {
    specialty: 'tech',
    patterns: [
      /technical/i, /software/i, /engineer/i, /developer/i, /devops/i,
      /cloud/i, /data\s*(science|engineer)/i, /fullstack/i, /full.stack/i,
      /front.end/i, /back.end/i, /platform/i, /machine learning/i, /\bml\b/i,
      /\bai\b/i, /react/i, /node/i, /python/i, /java\b/i, /typescript/i,
    ],
  },
  {
    specialty: 'creative',
    patterns: [
      /creative/i, /design/i, /\bux\b/i, /\bui\b/i, /brand/i, /art direct/i,
      /content/i, /copy/i, /media/i, /advertising/i, /marketing/i,
      /motion/i, /video/i, /animation/i, /graphic/i, /visual/i, /figma/i,
    ],
  },
  {
    specialty: 'business',
    patterns: [
      /business/i, /sales/i, /finance/i, /operation/i, /strategy/i,
      /consult/i, /executive/i, /management/i, /\bhr\b/i, /human resource/i,
      /product manager/i, /project manager/i, /scrum/i, /agile/i,
    ],
  },
  {
    specialty: 'healthcare',
    patterns: [/medical/i, /health/i, /clinical/i, /nurs/i, /pharma/i, /biotech/i],
  },
  {
    specialty: 'legal',
    patterns: [/legal/i, /attorney/i, /\blaw\b/i, /compliance/i],
  },
]

function inferSpecialties(candidate) {
  const text = [
    ...(candidate?.targetRoles || []),
    ...(candidate?.skills || []),
    ...(candidate?.skills_2 || []),
    ...(candidate?.inferredSkills || []),
    candidate?.resume_text || '',
    candidate?.work_experience || '',
    candidate?.education || '',
    candidate?.seniority || '',
  ].join(' ')

  const scores = SPECIALTY_RULES.map(({ specialty, patterns }) => ({
    specialty,
    score: patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scores.length === 0) return ['general']

  const topScore = scores[0].score
  // Include all specialties whose score is within 50% of the top score (min score 1)
  return scores
    .filter((item) => item.score >= Math.max(1, Math.floor(topScore * 0.5)))
    .map((item) => item.specialty)
}

// ── GET /recruiter/paired?candidateId=xxx&limit=10&company=optional ─────────
// Returns recruiters matching the candidate's specialty that they haven't
// been paired with before. Optional `company` param filters by recruiter company.
const getPairedRecruiters = asyncHandler(async (req, res) => {
  const { candidateId, limit = 50, company } = req.query
  if (!candidateId) return res.status(400).json({ message: 'candidateId required' })

  // Fetch candidate profile and contact history in parallel — they're independent
  // Only exclude recruiters contacted in the last 90 days so older contacts re-enter the pool
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const [candidate, contacted] = await Promise.all([
    CandidateModel.findById(candidateId).lean(),
    RecruiterContact.find({ candidateId, sentAt: { $gt: ninetyDaysAgo } }).select('recruiterId').lean(),
  ])

  if (!candidate) return res.status(404).json({ message: 'Candidate not found' })

  const specialties = inferSpecialties(candidate)
  const contactedIds = contacted.map((c) => c.recruiterId)

  if (company) {
    const recruiters = await getRecruitersForCompany(company, {
      limit: Number(limit),
      contactedIds,
    })
    return res.json({ specialties, recruiters })
  }

  const isGeneral = specialties.length === 1 && specialties[0] === 'general'
  const filter = {
    specialty: isGeneral ? { $exists: true } : { $in: specialties },
    _id: { $nin: contactedIds },
    email: { $nin: [null, ''] },
    status: 'active',
  }

  const recruiters = await Recruiter.find(filter)
    .sort({ score: -1 })
    .limit(Number(limit))
    .lean()

  res.json({ specialties, recruiters })
})

// POST /recruiter/pair-companies
// Pairs in-house recruiters with active job companies and excludes agencies.
const pairRecruiterCompanies = asyncHandler(async (req, res) => {
  const result = await pairRecruitersToCompanies(req.body || {})
  res.json(result)
})

// ── GET /recruiter/all ───────────────────────────────────────────────────────
const getAllRecruiters = asyncHandler(async (req, res) => {
  const { specialty, limit = 50, skip = 0 } = req.query
  const filter = { status: 'active' }
  if (specialty) filter.specialty = specialty

  const [recruiters, total] = await Promise.all([
    Recruiter.find(filter).sort({ score: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
    Recruiter.countDocuments(filter),
  ])
  res.json({ total, recruiters })
})

// ── POST /recruiter/contact ──────────────────────────────────────────────────
// Records a pairing or email send. Body: { candidateId, recruiterId, status, emailBody, tokensUsed }
const recordContact = asyncHandler(async (req, res) => {
  const { candidateId, recruiterId, status = 'paired', emailBody, tokensUsed = 0 } = req.body
  if (!candidateId || !recruiterId) return res.status(400).json({ message: 'candidateId and recruiterId required' })

  const recruiter = await Recruiter.findById(recruiterId).lean()

  const contact = await RecruiterContact.findOneAndUpdate(
    { candidateId, recruiterId },
    {
      $set: {
        status,
        recruiterEmail: recruiter?.email || null,
        ...(emailBody ? { emailBody, sentAt: new Date(), tokensUsed } : {}),
      },
    },
    { upsert: true, new: true }
  )

  res.json(contact)
})

// ── GET /recruiter/contacts?candidateId=xxx ──────────────────────────────────
const getContactHistory = asyncHandler(async (req, res) => {
  const { candidateId } = req.query
  if (!candidateId) return res.status(400).json({ message: 'candidateId required' })

  const contacts = await RecruiterContact.find({ candidateId })
    .populate({ path: 'recruiterId', model: 'JobSeeker.Recruiter' })
    .sort({ createdAt: -1 })
    .lean()

  res.json(contacts)
})

// ── POST /recruiter/send-email ───────────────────────────────────────────────
// Deducts 10 tokens from candidate and records the contact as email_sent.
// Body: { candidateId, recruiterId }
const RECRUITER_EMAIL_COST = 10

const sendEmail = asyncHandler(async (req, res) => {
  const { candidateId, recruiterId } = req.body
  if (!candidateId || !recruiterId) return res.status(400).json({ message: 'candidateId and recruiterId required' })

  // If a JWT is present, verify the candidateId belongs to the authenticated user
  if (req.user?.email) {
    const claimed = await CandidateModel.findById(candidateId).select('email').lean()
    if (!claimed) return res.status(404).json({ message: 'Candidate not found' })
    if (claimed.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account' })
    }
  }

  // Apply any earned daily-contact refills before checking the limit
  await refillRecruiterContacts(candidateId)

  // Fetch recruiter and atomically deduct tokens + daily contact in parallel.
  const [recruiter, prevCandidate] = await Promise.all([
    Recruiter.findById(recruiterId).lean(),
    CandidateModel.findOneAndUpdate(
      { _id: candidateId, tokenBalance: { $gte: RECRUITER_EMAIL_COST }, recruiterContactsLeft: { $gte: 1 } },
      { $inc: { tokenBalance: -RECRUITER_EMAIL_COST, tokensUsed: RECRUITER_EMAIL_COST, recruiterContactsLeft: -1 } },
      { new: false }
    ),
  ])

  if (!recruiter) return res.status(404).json({ message: 'Recruiter not found' })

  if (!prevCandidate) {
    const candidate = await CandidateModel.findById(candidateId).lean()
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' })
    if ((candidate.recruiterContactsLeft ?? 0) < 1) {
      return res.status(429).json({ message: 'Daily recruiter contact limit reached. Your limit refills at 1 per 24 hours.' })
    }
    return res.status(402).json({ message: 'Insufficient tokens' })
  }

  const tokensRemaining = (prevCandidate.tokenBalance ?? RECRUITER_EMAIL_COST) - RECRUITER_EMAIL_COST
  const contactsRemaining = (prevCandidate.recruiterContactsLeft ?? 1) - 1

  // Resolve email body: use stored template, generate on-demand, or fall back to webhook
  let emailBody = recruiter.emailTemplate
  if (!emailBody && process.env.OPENAI_API_KEY) {
    emailBody = await generateEmailDraft(recruiter, prevCandidate)
  }

  const contact = await RecruiterContact.findOneAndUpdate(
    { candidateId, recruiterId },
    {
      $set: {
        status: 'email_sent',
        recruiterEmail: recruiter.email,
        emailBody: emailBody || '',
        sentAt: new Date(),
        tokensUsed: 1,
      },
    },
    { upsert: true, new: true }
  )

  // Send via SMTP — to recruiter + BCC candidate so they have a copy
  const transporter = getTransporter()
  const candidateEmail = prevCandidate.email || null
  const fromName = [prevCandidate.firstName, prevCandidate.lastName].filter(Boolean).join(' ') || 'Wander/Work'
  const subject = `${recruiter.jobTitle || 'Hiring'} - quick intro from ${fromName}`

  if (transporter && emailBody) {
    const mailOptions = {
      from: `"${fromName}" <${process.env.EMAIL_SMTP_USER}>`,
      to: recruiter.email || process.env.ADMIN_EMAIL,
      replyTo: candidateEmail || process.env.EMAIL_SMTP_USER,
      subject,
      text: emailBody,
    }
    if (candidateEmail) mailOptions.bcc = candidateEmail

    transporter.sendMail(mailOptions)
      .then(() => console.log(`[RecruiterEmail] Sent to ${mailOptions.to} (bcc: ${candidateEmail})`))
      .catch((e) => console.error('[RecruiterEmail] Send failed:', e.message))
  } else {
    console.warn('[RecruiterEmail] SMTP not configured or no email body — skipping send')
  }

  res.json({ contact, tokensRemaining, contactsRemaining })
})

module.exports = {
  getPairedRecruiters,
  getAllRecruiters,
  recordContact,
  getContactHistory,
  sendEmail,
  pairRecruiterCompanies,
}

const asyncHandler = require('express-async-handler')
const mongoose = require('mongoose')
const axios = require('axios')
const sgMail = require('@sendgrid/mail')
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

async function requireCandidateOwner(req, candidateId) {
  const candidate = await CandidateModel.findById(candidateId).lean()
  if (!candidate) {
    const error = new Error('Candidate not found')
    error.statusCode = 404
    throw error
  }

  if (!req.user?.email || String(candidate.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
    const error = new Error('Forbidden: candidate does not belong to this account')
    error.statusCode = 403
    throw error
  }

  return candidate
}

// ── Recruiter draft email delivery ───────────────────────────────────────────
const DEFAULT_WANDERWORK_EMAIL = 'support@wanderwork.io'
const BLOCKED_AUTOMATION_EMAIL_PATTERNS = [
  /@aontechnologies\./i,
]

function isBlockedAutomationEmail(value) {
  const email = normalizeEmailBody(value).toLowerCase()
  return !!email && BLOCKED_AUTOMATION_EMAIL_PATTERNS.some((pattern) => pattern.test(email))
}

function isWanderworkEmail(value) {
  return /@wanderwork\.io$/i.test(normalizeEmailBody(value))
}

function getWanderworkSender() {
  const email = normalizeEmailBody(process.env.EMAIL_FROM || DEFAULT_WANDERWORK_EMAIL)
  if (!email || isBlockedAutomationEmail(email) || !isWanderworkEmail(email)) return null
  return { name: 'Wander/Work', email }
}

function getDraftMailer() {
  const apiKey = normalizeEmailBody(process.env.SENDGRID_API_KEY)
  if (!apiKey || apiKey === 'SG.placeholder') return null
  const sender = getWanderworkSender()
  if (!sender) return null
  sgMail.setApiKey(apiKey)
  return { sender, send: (message) => sgMail.send(message) }
}

// ── On-demand email draft generation via OpenAI ──────────────────────────────
const DRAFT_SYSTEM_PROMPT = `You write short outreach emails for a job seeker to recruiters, talent partners, and hiring managers.
Write a real, human email that feels personal, casual, and professional.
Output only the email body. No subject line. No markdown. No bullet points. No em dashes.
Use "Hey [First Name]," at the start when a first name is available, otherwise "Hey,".
Keep it 5 to 8 complete sentences with at least one real paragraph. Never output only a title, headline, bio, or role summary.
Open with a short, believable acknowledgment based only on the recipient details provided.
Briefly explain what the sender does and why they may be relevant to the kinds of roles the recipient works on.
Mention portfolio and LinkedIn naturally when URLs are provided.
Ask if they are hiring now or expect freelance, contract, or full-time needs soon.
Never invent open roles, hiring plans, personal details, employers, tools, or background.
Never use fake personalization, overpraise, or generic lines like "I hope this email finds you well."
Use only the sender details provided. Do not mention any specific person, employer, tool, client, or background detail unless it appears in the current sender profile or resume context.`

async function generateEmailDraft(recruiter, candidate) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const userName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'the candidate'
  const profile = buildCandidateEmailProfile(candidate)
  const userPrompt = `Write a short recruiter outreach email using these details.
Recipient first name: ${recruiter.firstName || ''}
Recipient full name: ${recruiter.name || ''}
Recipient role: ${recruiter.jobTitle || ''}
Company: ${recruiter.company || ''}
Industry: ${recruiter.industry || ''}
Specialty: ${recruiter.specialty || ''}
Tags: ${listSummary(recruiter.tags, 8)}
Location: ${[recruiter.city, recruiter.state, recruiter.country].filter(Boolean).join(' ') || recruiter.location || ''}
Recipient headline or niche: ${recruiter.headline || ''}

Sender: ${userName}
Sender intro: ${profile.intro}
Sender target roles: ${profile.targetRoles || ''}
Sender seniority: ${profile.seniority || ''}
Sender skills: ${profile.skills || ''}
Sender keywords: ${profile.keywords || ''}
Sender portfolio: ${profile.portfolioUrl || ''}
Sender LinkedIn: ${profile.linkedinUrl || ''}
Sender resume summary: ${profile.summary || ''}
Sender work experience excerpt: ${profile.workExperience || ''}
Sender education excerpt: ${profile.education || ''}
Sender resume excerpt: ${profile.resumeExcerpt || ''}

Use the sender's actual resume/profile details naturally. If a detail is missing, skip it.
Do not copy recruiter titles or headlines as the body of the email.
End casually and professionally.`

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

// Email body safety helpers
const MIN_RECRUITER_EMAIL_BODY_CHARS = 120
const MIN_RECRUITER_EMAIL_BODY_WORDS = 18
const MIN_RECRUITER_EMAIL_SENTENCES = 5

function normalizeEmailBody(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function visibleEmailText(value) {
  const visibleText = normalizeEmailBody(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&zwnj;|&zwj;|&#8203;|&#8204;|&#8205;|&#65279;/gi, '')

  return normalizeEmailBody(visibleText)
}

function hasVisibleEmailContent(value) {
  const visibleText = visibleEmailText(value)
  const wordCount = (visibleText.match(/\S+/g) || []).length
  const sentenceCount = (visibleText.match(/[.!?](?=\s|$)/g) || []).length
  return visibleText.length >= MIN_RECRUITER_EMAIL_BODY_CHARS &&
    wordCount >= MIN_RECRUITER_EMAIL_BODY_WORDS &&
    sentenceCount >= MIN_RECRUITER_EMAIL_SENTENCES
}

function usableEmailBody(value) {
  const emailBody = normalizeEmailBody(value)
  return hasVisibleEmailContent(emailBody) ? emailBody : ''
}

function getFirstName(person = {}) {
  const source = normalizeEmailBody(person.firstName) || normalizeEmailBody(person.name)
  return source.split(/\s+/).find(Boolean) || ''
}

function getRecruiterEmail(recruiter = {}) {
  return normalizeEmailBody(recruiter.email) || normalizeEmailBody(recruiter.personalEmail)
}

function listSummary(value, limit = 4) {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,;\n]/)
      : []

  return items
    .map((item) => normalizeEmailBody(item == null ? '' : String(item)))
    .filter(Boolean)
    .slice(0, limit)
    .join(', ')
}

function compactText(value, maxChars = 900) {
  const text = normalizeEmailBody(value)
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).trim()}...`
}

function findCandidateUrl(candidate = {}, pattern) {
  const urls = Array.isArray(candidate.urls) ? candidate.urls : []
  const match = urls.find((item) => {
    const name = normalizeEmailBody(item?.urlName)
    const address = normalizeEmailBody(item?.urlAddress)
    return pattern.test(`${name} ${address}`)
  })

  return normalizeEmailBody(match?.urlAddress)
}

function buildCandidateEmailProfile(candidate = {}) {
  const name = [candidate.firstName, candidate.lastName]
    .map((part) => normalizeEmailBody(part))
    .filter(Boolean)
    .join(' ') || 'the candidate'
  const targetRoles = listSummary(candidate.targetRoles, 4)
  const seniority = listSummary(candidate.seniority, 3)
  const skills = listSummary([...(candidate.skills || []), ...(candidate.skills_2 || [])], 10)
  const keywords = listSummary(candidate.inferredKeywords, 10)
  const summary = compactText(candidate.summary, 600)
  const workExperience = compactText(candidate.work_experience, 900)
  const education = compactText(candidate.education, 400)
  const resumeExcerpt = compactText(candidate.resume_text, 1200)
  const portfolioUrl = findCandidateUrl(candidate, /portfolio|website|personal|work/i)
  const linkedinUrl = findCandidateUrl(candidate, /linkedin/i)

  let intro = targetRoles
    ? [seniority, targetRoles].filter(Boolean).join(' ')
    : seniority
      ? `${seniority} professional`
      : 'a professional exploring new opportunities'
  if (skills) intro = `${intro} with experience in ${skills}`

  return {
    name,
    targetRoles,
    seniority,
    skills,
    keywords,
    summary,
    workExperience,
    education,
    resumeExcerpt,
    portfolioUrl,
    linkedinUrl,
    intro,
  }
}

function buildGenericRecruiterEmail(recruiter, candidate) {
  const recruiterFirstName = getFirstName(recruiter)
  const greeting = recruiterFirstName ? `Hey ${recruiterFirstName},` : 'Hey,'
  const profile = buildCandidateEmailProfile(candidate)
  const candidateName = profile.name
  const signatureName = normalizeEmailBody(candidate.firstName) || candidateName
  const skills = profile.skills
  const company = normalizeEmailBody(recruiter.company)
  const recipientFocus = normalizeEmailBody(recruiter.headline) ||
    [recruiter.jobTitle, company].map(normalizeEmailBody).filter(Boolean).join(' at ')
  const links = [
    profile.portfolioUrl ? `portfolio: ${profile.portfolioUrl}` : '',
    profile.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}` : '',
  ].filter(Boolean).join(', ')

  const paragraph = [
    recipientFocus
      ? `I saw your focus around ${recipientFocus}, and it seemed close to the kind of work I am exploring.`
      : 'I saw your recruiting work and wanted to make a quick introduction.',
    `I'm ${candidateName}, ${profile.intro}.`,
    skills
      ? `I wanted to introduce myself in case that background lines up with searches you are supporting${company ? ` at ${company}` : ''}.`
      : `I wanted to introduce myself in case my background lines up with searches you are supporting${company ? ` at ${company}` : ''}.`,
    links ? `You can see more of my work here: ${links}.` : null,
    'Are you currently hiring, or do you expect freelance, contract, or full-time needs soon?',
    'If there is a fit, I would be glad to send over more context.',
  ].filter(Boolean).join(' ')

  const lines = [
    greeting,
    '',
    paragraph,
    '',
    'Thanks,',
    signatureName,
  ]

  return lines.join('\n')
}

async function resolveRecruiterEmailBody(recruiter, candidate) {
  let emailBody = ''
  let source = ''

  if (process.env.OPENAI_API_KEY) {
    emailBody = usableEmailBody(await generateEmailDraft(recruiter, candidate))
    source = emailBody ? 'generated' : ''
  }

  if (!emailBody) {
    emailBody = buildGenericRecruiterEmail(recruiter, candidate)
    source = 'fallback'
  }

  return { emailBody, source }
}

// Specialty inference from candidate profile
const SPECIALTY_RULES = [
  {
    specialty: 'tech',
    patterns: [
      /software/i, /engineer/i, /developer/i, /devops/i, /cloud/i,
      /fullstack/i, /full.stack/i, /front.end/i, /back.end/i,
      /machine learning/i, /\bml\b/i, /react/i, /node/i, /python/i,
      /java\b/i, /typescript/i, /cybersecurity/i, /infrastructure/i,
      /\bsre\b/i, /embedded/i, /firmware/i, /blockchain/i, /web3/i,
      /semiconductor/i, /quantum/i, /robotics/i,
    ],
  },
  {
    specialty: 'creative',
    patterns: [
      /creative/i, /design/i, /\bux\b/i, /\bui\b/i, /brand/i, /art direct/i,
      /advertising/i, /marketing/i, /motion/i, /animation/i, /graphic/i,
      /visual/i, /figma/i, /illustration/i, /copywriter/i, /content (creator|strategist)/i,
      /social media/i, /\bseo\b/i, /media buyer/i,
    ],
  },
  {
    specialty: 'product',
    patterns: [
      /product manager/i, /product owner/i, /product lead/i,
      /product recruit/i, /product design/i, /product strategy/i,
      /program manager/i, /project manager/i, /scrum master/i,
    ],
  },
  {
    specialty: 'data',
    patterns: [
      /data scien/i, /data engineer/i, /data analyst/i, /business intelligence/i,
      /\bBI\b/i, /analytics/i, /machine learning/i, /\bML\b/i, /\bai\b.{0,10}recruit/i,
      /data.*recruit/i, /\bLLM\b/i, /\bgenai\b/i, /generative ai/i,
    ],
  },
  {
    specialty: 'sales',
    patterns: [
      /\bsales\b/i, /account executive/i, /account manager/i, /business development/i,
      /go.to.market/i, /\bgtm\b/i, /revenue/i, /\bsdr\b/i, /\bbdr\b/i,
      /customer success/i, /partnerships/i,
    ],
  },
  {
    specialty: 'operations',
    patterns: [
      /operat/i, /supply chain/i, /logistics/i, /procurement/i, /chief of staff/i,
      /\bhr\b/i, /human resource/i, /people ops/i, /talent ops/i,
      /\bea\b.{0,10}recruit/i, /executive assistant/i,
    ],
  },
  {
    specialty: 'finance',
    patterns: [
      /finance/i, /accounting/i, /\bcpa\b/i, /\bcfo\b/i, /investment/i,
      /private equity/i, /\bvc\b/i, /venture/i, /fintech/i, /banking/i,
      /financial.*recruit/i,
    ],
  },
  {
    specialty: 'business',
    // Reserved for executive/C-suite/leadership search specifically
    patterns: [
      /executive search/i, /c-suite/i, /\bceo\b/i, /\bcoo\b/i,
      /chief.*officer/i, /board.*recruit/i, /vp.*search/i,
      /senior.*leader/i, /leadership.*search/i,
    ],
  },
  {
    specialty: 'healthcare',
    patterns: [
      /medical/i, /health/i, /clinical/i, /nurs/i, /pharma/i, /biotech/i,
      /physician/i, /dental/i, /hospital/i, /life science/i, /therapeutics/i,
    ],
  },
  {
    specialty: 'legal',
    patterns: [/legal/i, /attorney/i, /\blaw\b/i, /compliance/i, /paralegal/i],
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

  const [candidate, contacted] = await Promise.all([
    requireCandidateOwner(req, candidateId),
    RecruiterContact.find({ candidateId }).select('recruiterId').lean(),
  ])

  const specialties = inferSpecialties(candidate)
  const contactedIds = contacted.map((c) => c.recruiterId)

  if (company) {
    const recruiters = await getRecruitersForCompany(company, {
      limit: Number(limit),
      contactedIds: [],
    })
    return res.json({ specialties, recruiters })
  }

  const isGeneral = specialties.length === 1 && specialties[0] === 'general'
  const lim = Number(limit)
  const specialtySlots = isGeneral ? 0 : Math.round(lim * 0.7)
  const generalSlots   = lim - specialtySlots
  const baseFilter = { email: { $nin: [null, ''] }, status: 'active' }

  const [specialtyRaw, generalRaw] = await Promise.all([
    specialtySlots > 0
      ? Recruiter.find({ ...baseFilter, specialty: { $in: specialties } }).sort({ score: -1 }).limit(specialtySlots * 2).lean()
      : Promise.resolve([]),
    Recruiter.find({ ...baseFilter, specialty: 'general' }).sort({ score: -1 }).limit(generalSlots * 2).lean(),
  ])

  const seen = new Set()
  const pick = (pool, slots) => {
    const out = []
    for (const r of pool) {
      const key = r.email?.toLowerCase().trim()
      if (key && seen.has(key)) continue
      if (key) seen.add(key)
      out.push(r)
      if (out.length >= slots) break
    }
    return out
  }

  const recruiters = [...pick(specialtyRaw, specialtySlots), ...pick(generalRaw, generalSlots)]

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
  await requireCandidateOwner(req, candidateId)

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
  await requireCandidateOwner(req, candidateId)

  const contacts = await RecruiterContact.find({ candidateId })
    .populate({ path: 'recruiterId', model: 'JobSeeker.Recruiter' })
    .sort({ createdAt: -1 })
    .lean()

  res.json(contacts)
})

// ── POST /recruiter/send-email ───────────────────────────────────────────────
// Deducts 10 tokens and sends the recruiter email draft only to the candidate.
// Body: { candidateId, recruiterId }
const RECRUITER_EMAIL_COST = 10

const sendEmail = asyncHandler(async (req, res) => {
  const { candidateId, recruiterId } = req.body
  if (!candidateId || !recruiterId) return res.status(400).json({ message: 'candidateId and recruiterId required' })
  const ownerCandidate = await requireCandidateOwner(req, candidateId)
  const candidateEmail = normalizeEmailBody(ownerCandidate.email)
  if (!candidateEmail) {
    return res.status(400).json({ message: 'Candidate email unavailable' })
  }
  if (isBlockedAutomationEmail(candidateEmail)) {
    return res.status(400).json({ message: 'Automated recruiter drafts cannot be sent to that email address. Update the user email first.' })
  }

  // Apply any earned daily-contact refills before checking the limit
  await refillRecruiterContacts(candidateId)

  const recruiter = await Recruiter.findById(recruiterId).lean()
  if (!recruiter) return res.status(404).json({ message: 'Recruiter not found' })

  const recruiterEmail = getRecruiterEmail(recruiter)
  const draftMailer = getDraftMailer()
  if (!draftMailer) {
    console.error('[RecruiterEmail] Draft delivery unavailable: WanderWork SendGrid sender is not configured')
    return res.status(503).json({ message: 'WanderWork email service unavailable. No recruiter email was sent.' })
  }

  // Atomically deduct tokens + daily contact after the recruiter is confirmed.
  const prevCandidate = await CandidateModel.findOneAndUpdate(
    { _id: candidateId, tokenBalance: { $gte: RECRUITER_EMAIL_COST }, recruiterContactsLeft: { $gte: 1 } },
    { $inc: { tokenBalance: -RECRUITER_EMAIL_COST, tokensUsed: RECRUITER_EMAIL_COST, recruiterContactsLeft: -1 } },
    { new: false }
  )

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

  // Resolve email body: generate on-demand, or fall back to a safe generic draft.
  const { emailBody, source: emailBodySource } = await resolveRecruiterEmailBody(recruiter, prevCandidate)

  // Send the generated draft only to the candidate's inbox. Do not contact the recruiter from WanderWork.
  const recruiterLabel = [
    normalizeEmailBody(recruiter.name),
    normalizeEmailBody(recruiter.company),
  ].filter(Boolean).join(' at ')
  const subject = recruiterLabel
    ? `Your recruiter email draft for ${recruiterLabel}`
    : 'Your recruiter email draft'

  const mailOptions = {
    from: draftMailer.sender,
    to: candidateEmail,
    replyTo: draftMailer.sender.email,
    subject,
    text: emailBody,
  }

  try {
    await draftMailer.send(mailOptions)
    console.log(`[RecruiterEmail] Draft sent to candidate ${candidateEmail} for recruiter ${recruiter._id} (body: ${emailBodySource})`)
  } catch (e) {
    await CandidateModel.updateOne(
      { _id: candidateId },
      { $inc: { tokenBalance: RECRUITER_EMAIL_COST, tokensUsed: -RECRUITER_EMAIL_COST, recruiterContactsLeft: 1 } }
    )
    console.error('[RecruiterEmail] Send failed, debit refunded:', e.message)
    return res.status(502).json({ message: 'Recruiter draft failed to send to your inbox. Your tokens were refunded.' })
  }

  const contact = await RecruiterContact.findOneAndUpdate(
    { candidateId, recruiterId },
    {
      $set: {
        status: 'draft_sent',
        recruiterEmail: recruiterEmail || null,
        deliveryEmail: candidateEmail,
        emailBody,
        sentAt: new Date(),
        tokensUsed: RECRUITER_EMAIL_COST,
      },
    },
    { upsert: true, new: true }
  )

  res.json({ contact, tokensRemaining, contactsRemaining, draftRecipientEmail: candidateEmail })
})

module.exports = {
  getPairedRecruiters,
  getAllRecruiters,
  recordContact,
  getContactHistory,
  sendEmail,
  pairRecruiterCompanies,
}

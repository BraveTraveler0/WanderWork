const mongoose = require('mongoose')
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate')
const CandidateJobPairings = require('../models/JobSeeker/jobSeeker.CandidateJobPairing')

// Use explicit collection name — same as getAllJobsPure() in the controller — to guarantee
// we read from 'jobseeker.jobs' regardless of how Mongoose derives the collection name
// from the 'JobSeeker.Jobs' model name with dot notation.
function getJobsModel() {
  return mongoose.models.JobDynamic ||
    mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }))
}

const DEFAULT_LIMIT = 250
const DEFAULT_MIN_SCORE = 28

// Seniority tiers — order matters (most senior first)
const SENIORITY_TIERS = [
  { level: 5, keywords: ['vp ', 'vice president', 'chief ', 'cto', 'cpo', 'c-level', 'partner', 'managing director'] },
  { level: 4, keywords: ['director', 'head of', 'principal'] },
  { level: 3, keywords: ['senior', 'sr.', 'sr ', 'lead ', 'staff ', 'manager', 'architect'] },
  { level: 2, keywords: ['mid ', 'mid-level', 'associate', 'ii ', 'iii '] },
  { level: 1, keywords: ['junior', 'jr.', 'jr ', 'entry level', 'entry-level', 'intern', 'internship', 'apprentice', 'apprenticeship', 'trainee', 'graduate', 'new grad', 'new graduate', 'early career', 'campus', 'student', 'co-op', 'fellowship'] },
]

const LOW_LEVEL_JOB_PATTERN = /\b(junior|jr|entry level|intern|internship|apprentice|apprenticeship|trainee|new grad|new graduate|early career|campus|student|co op|fellowship)\b/

function detectSeniorityLevel(text) {
  const t = normalizeText(text)
  for (const tier of SENIORITY_TIERS) {
    if (tier.keywords.some(k => t.includes(k))) return tier.level
  }
  return 2 // default to mid if undetectable
}

function isLowLevelJob(job) {
  const text = normalizeText([
    job.title,
    job.jobType || job.job_type,
    job.shortDescription || job.description_short,
    job.summary,
    toArray(job.tags).join(' '),
  ].filter(Boolean).join(' '))
  return LOW_LEVEL_JOB_PATTERN.test(text)
}

function isSeniorityCompatible(candSeniority, job) {
  // Senior+ candidates should not be matched to entry, intern, apprentice,
  // trainee, or new-grad roles. Those jobs are for lower-experience users.
  if (candSeniority >= 3 && isLowLevelJob(job)) return false
  return true
}

function candidateSeniority(candidate) {
  // Use explicit seniority field first (most reliable)
  if (candidate.seniority) {
    const level = detectSeniorityLevel(candidate.seniority)
    if (level !== 2) return level // only trust it if it's not ambiguous default
  }
  const sources = [
    toArray(candidate.targetRoles).join(' '),
    candidate.work_experience || '',
    candidate.summary || '',
    toArray(candidate.skills).join(' '),
  ].join(' ')
  return detectSeniorityLevel(sources)
}

const SYNONYMS = {
  ui: ['user interface'],
  ux: ['user experience', 'user research', 'prototype', 'prototyping', 'interaction design', 'experience design'],
  javascript: ['js'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js'],
  node: ['nodejs', 'node.js'],
  brand: ['branding'],
  content: ['copywriting', 'copy'],
  creative: ['design', 'brand', 'visual'],
  figma: ['sketch', 'adobe xd'],
  webflow: ['framer', 'no-code', 'nocode'],
}

// Role families with explicit compatibility.
// Families are checked in order — more specific entries come first so
// "frontend engineer" resolves to 'frontend' before "engineer" resolves to 'backend'.
// compatibleWith: families that should NOT be excluded when paired with this family.
//   e.g. design <-> frontend <-> creative are all adjacent and can cross-match.
//   backend, sales, legal, admin are isolated — incompatible with everything else.
const ROLE_FAMILIES = [
  {
    name: 'design',
    keywords: [
      'ux designer', 'ui designer', 'product designer', 'visual designer', 'graphic designer',
      'brand designer', 'interaction designer', 'experience designer', 'motion designer',
      'creative designer', 'web designer', 'digital designer', 'ux engineer', 'design engineer',
      'design lead', 'design manager', 'creative director', 'art director', 'head of design',
      'vp of design', 'chief design officer', 'designer',
    ],
    compatibleWith: ['frontend', 'creative'],
  },
  {
    // Frontend/web roles — same skillset overlap as design; product designers often
    // hold or are interested in these titles. CSS, JS, React, Figma-to-code, etc.
    name: 'frontend',
    keywords: [
      'frontend engineer', 'front end engineer', 'frontend developer', 'front end developer',
      'ui engineer', 'web developer', 'react developer', 'javascript developer',
      'typescript developer', 'vue developer', 'angular developer', 'next.js developer',
      'creative technologist', 'interactive developer', 'web engineer',
    ],
    compatibleWith: ['design', 'creative'],
  },
  {
    // Creative/art — illustrators, animators, art directors for film/marketing/brand.
    // Often the same person or team as design; shares tools and workflows.
    name: 'creative',
    keywords: [
      'illustrator', 'animator', 'motion graphic', 'video editor', 'filmmaker',
      'photographer', 'visual artist', '3d artist', 'concept artist', 'storyboard artist',
      'content creator', 'art lead',
    ],
    compatibleWith: ['design', 'frontend'],
  },
  {
    // Backend/infra/data engineering — distinct skillset, no meaningful overlap with design.
    name: 'backend',
    keywords: [
      'software engineer', 'software developer', 'forward deployed engineer',
      'engineering manager', 'backend engineer', 'back end engineer', 'full stack engineer',
      'fullstack engineer', 'full stack developer', 'fullstack developer',
      'data engineer', 'ml engineer', 'machine learning engineer', 'ai engineer',
      'data scientist', 'research scientist', 'devops engineer', 'site reliability engineer',
      'platform engineer', 'infrastructure engineer', 'solutions engineer',
      'mobile engineer', 'ios engineer', 'android engineer', 'mobile developer',
      'ios developer', 'android developer', 'firmware engineer', 'embedded engineer',
      'systems engineer', 'backend developer', 'python developer', 'java developer',
      'ruby developer', 'go developer', 'rust developer', 'c++ developer',
      'staff engineer', 'principal engineer', 'solutions architect', 'cloud architect',
      'network engineer', 'security engineer',
    ],
    compatibleWith: [],
  },
  {
    // Sales — "Account Executive" is a sales title, NOT a leadership/executive title.
    // SDR, BDR, AE, AM are quota-carrying roles with no design overlap.
    name: 'sales',
    keywords: [
      'account executive', 'account manager', 'sales manager', 'sales director',
      'sales representative', 'sales development representative', 'enterprise sales',
      'inside sales', 'outside sales', 'bdr', 'sdr', 'business development representative',
      'business development manager', 'revenue manager',
    ],
    compatibleWith: [],
  },
  {
    // Legal — attorneys, paralegals, legal assistants. Paralegal is admin-adjacent
    // but still firmly in the legal domain, not design.
    name: 'legal',
    keywords: [
      'attorney', 'counsel', 'paralegal', 'legal assistant', 'legal coordinator',
      'legal analyst', 'compliance officer',
    ],
    compatibleWith: [],
  },
  {
    // Admin/ops — office managers, admins, executive assistants.
    // "Executive Assistant" is admin support; distinct from VP/executive leadership.
    name: 'admin',
    keywords: [
      'executive assistant', 'administrative assistant', 'office manager',
      'office coordinator', 'office assistant', 'operations coordinator',
      'administrative coordinator',
    ],
    compatibleWith: [],
  },
]

// Equivalent titles within the design family — broadens title-role matching
// so a "product designer" posting matches a "ux designer" candidate.
const DESIGN_ROLE_SYNONYMS = {
  'ux designer': ['product designer', 'ui designer', 'experience designer', 'interaction designer', 'digital designer', 'ux ui designer', 'ui ux designer'],
  'product designer': ['ux designer', 'ui designer', 'visual designer', 'experience designer', 'digital designer'],
  'ui designer': ['ux designer', 'product designer', 'visual designer', 'interface designer', 'digital designer'],
  'visual designer': ['graphic designer', 'brand designer', 'product designer', 'ui designer'],
  'graphic designer': ['visual designer', 'brand designer', 'creative designer'],
  'brand designer': ['visual designer', 'graphic designer', 'creative designer'],
  'designer': ['product designer', 'ux designer', 'ui designer', 'visual designer'],
}

function detectFamilyObj(text) {
  const t = normalizeText(text)
  for (const family of ROLE_FAMILIES) {
    if (family.keywords.some(k => t.includes(normalizeText(k)))) return family
  }
  return null
}

function detectFamily(text) {
  const obj = detectFamilyObj(text)
  return obj ? obj.name : null
}

function expandRoles(roles) {
  const expanded = [...roles]
  for (const role of roles) {
    const extras = DESIGN_ROLE_SYNONYMS[role] || []
    expanded.push(...extras)
  }
  return unique(expanded)
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value).split(',')
}

function unique(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))]
}

function candidateKeywords(candidate) {
  // Structured fields only — free-text resume fields (work_experience, education, summary)
  // extract too many generic English words ("senior", "platform", "company") that score
  // false positives against unrelated job descriptions.
  const base = unique([
    ...toArray(candidate.skills),
    ...toArray(candidate.skills_2),
    ...toArray(candidate.inferredKeywords),
    ...toArray(candidate.inferredSkills),
    ...toArray(candidate.inferred_skills),
    ...toArray(candidate.targetRoles),
  ])

  const expanded = []
  for (const keyword of base) {
    expanded.push(keyword)
    const extras = SYNONYMS[keyword] || []
    expanded.push(...extras)
  }
  return unique(expanded).filter((keyword) => keyword.length >= 2)
}

function locationText(locations) {
  if (!Array.isArray(locations)) return normalizeText(locations)
  return normalizeText(
    locations
      .map((location) => {
        if (!location || typeof location !== 'object') return location
        return [location.locationName, location.city, location.state, location.country].filter(Boolean).join(' ')
      })
      .join(' ')
  )
}

function jobText(job) {
  return normalizeText([
    job.title,
    job.company,
    job.jobType || job.job_type,
    locationText(job.location),
    job.shortDescription || job.description_short,
    job.description,
    job.summary,
    toArray(job.tags).join(' '),
    toArray(job.skills).join(' '),
  ].filter(Boolean).join(' '))
}

function tokenSet(text) {
  return new Set(normalizeText(text).split(' ').filter(Boolean))
}

function containsPhrase(text, phrase) {
  const normalized = normalizeText(phrase)
  if (!normalized) return false
  return text.includes(normalized)
}

function scoreJob(candidate, job, keywords, candSeniority) {
  const text = jobText(job)
  const tokens = tokenSet(text)
  const title = normalizeText(job.title)
  const candidateRoles = unique(toArray(candidate.targetRoles))

  const matchedSkills = []
  let score = 0

  if (!isSeniorityCompatible(candSeniority, job)) {
    return {
      score: 0,
      matchedSkills: [],
      excluded: true,
      reason: 'Skipped because this role is below the candidate seniority level',
    }
  }

  // Hard role-family gate: exclude jobs from incompatible families.
  // e.g. design candidates skip backend/sales/legal/admin jobs, but still see
  // frontend and creative jobs (which are in design's compatibleWith list).
  // If either side is unclassified (null), we allow it through — no false exclusions.
  if (candidateRoles.length > 0) {
    const candFamilyObj = detectFamilyObj(candidateRoles.join(' '))
    const jobFamilyObj = detectFamilyObj(job.title)
    if (candFamilyObj && jobFamilyObj && candFamilyObj.name !== jobFamilyObj.name) {
      const isCompatible = candFamilyObj.compatibleWith.includes(jobFamilyObj.name)
      if (!isCompatible) {
        return {
          score: 0,
          matchedSkills: [],
          excluded: true,
          reason: `Role family mismatch: candidate=${candFamilyObj.name}, job=${jobFamilyObj.name}`,
        }
      }
    }
  }

  // Seniority match/mismatch
  const jobSeniority = detectSeniorityLevel(title)
  const seniorityDiff = candSeniority - jobSeniority
  if (seniorityDiff >= 2) score -= 20      // senior applying to entry/intern — strong penalty
  else if (seniorityDiff === 1) score -= 8  // slight overqualified — mild penalty
  else if (seniorityDiff === 0) score += 10 // exact match — bonus
  else if (seniorityDiff === -1) score += 4 // slight stretch — small bonus (aspirational)

  for (const keyword of keywords) {
    const parts = keyword.split(' ').filter(Boolean)
    const matched = parts.length > 1 ? containsPhrase(text, keyword) : tokens.has(keyword)
    if (!matched) continue
    matchedSkills.push(keyword)
    score += containsPhrase(title, keyword) ? 12 : 6
  }

  const rolesExpanded = expandRoles(candidateRoles)
  for (const role of rolesExpanded) {
    if (!role) continue
    if (containsPhrase(title, role)) score += 24
    else if (containsPhrase(text, role)) score += 10
  }

  const candidateLocation = locationText(candidate.location)
  const jobLocation = locationText(job.location)
  if (containsPhrase(text, 'remote')) score += 6
  if (candidateLocation && jobLocation && candidateLocation.split(' ').some((part) => part.length > 2 && jobLocation.includes(part))) {
    score += 8
  }

  const postedAt = new Date(job.date_posted || job.datePosted || job.postedAt || job.createdAt || 0).getTime()
  if (postedAt) {
    const daysOld = Math.max(0, Math.floor((Date.now() - postedAt) / 86400000))
    if (daysOld <= 7) score += 10
    else if (daysOld <= 30) score += 6
    else if (daysOld <= 90) score += 2
  }

  const uniqueMatches = unique(matchedSkills)
  if (uniqueMatches.length >= 5) score += 12
  else if (uniqueMatches.length >= 3) score += 7
  else if (uniqueMatches.length >= 1) score += 3

  // Domain relevance check: at least one of the candidate's core skills or
  // target roles must appear somewhere in the job text. Single-word skills
  // that are clearly domain-specific (e.g. "figma", "react") check full text
  // rather than title-only to avoid over-penalising when a tool name doesn't
  // appear in a short title. Generic single-word skills still require a title
  // hit to prevent "design" or "data" from matching unrelated roles.
  const GENERIC_WORDS = new Set(['data', 'design', 'product', 'sales', 'growth', 'content', 'writing', 'research', 'management', 'analytics', 'operations', 'strategy', 'marketing', 'engineering', 'development'])

  const directSkills = unique([
    ...toArray(candidate.skills),
    ...toArray(candidate.skills_2),
    ...toArray(candidate.targetRoles),
  ]).map(normalizeText).filter(s => s.length >= 3)

  if (directSkills.length > 0) {
    const hasDomainHit = directSkills.some(skill => {
      const parts = skill.split(' ').filter(Boolean)
      if (parts.length > 1) return containsPhrase(text, skill)
      // Single-word: check full text if domain-specific tool/tech, title-only for generic words
      if (GENERIC_WORDS.has(skill)) return containsPhrase(title, skill)
      return containsPhrase(text, skill)
    })
    if (!hasDomainHit) score -= 25
  }

  // Title-role gate: if none of the candidate's target roles (or their synonyms)
  // appear in the job title, apply a strong penalty. The hard family exclusion above
  // catches the obvious cross-family mismatches; this handles subtler same-family misses.
  const titleRoleMatch = rolesExpanded.some(r => r && containsPhrase(title, r))
  if (!titleRoleMatch && candidateRoles.length > 0) score -= 35

  const cappedScore = Math.max(0, Math.min(100, Math.round(score)))
  return {
    score: cappedScore,
    matchedSkills: uniqueMatches.slice(0, 12),
    reason: uniqueMatches.length
      ? `Matched on ${uniqueMatches.slice(0, 5).join(', ')}`
      : 'Matched on role, location, or job freshness',
  }
}

// Internal: accepts a pre-loaded jobs array to avoid redundant DB reads in pairAllCandidates
async function _pairCandidateWithJobs(candidateId, jobs, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(candidateId))) {
    throw new Error('Invalid candidate id')
  }

  const limit = Number(options.limit) || DEFAULT_LIMIT
  const minScore = Number(options.minScore) || DEFAULT_MIN_SCORE
  const candidate = await Candidates.findById(candidateId).lean()
  if (!candidate) {
    const err = new Error('Candidate not found')
    err.statusCode = 404
    throw err
  }

  const keywords = candidateKeywords(candidate)
  const candSeniority = candidateSeniority(candidate)
  const scored = jobs
    .map((job) => ({ job, ...scoreJob(candidate, job, keywords, candSeniority) }))
    .filter((item) => !item.excluded && item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Delete all existing pairings for this candidate, then rewrite only valid ones.
  // Simpler and more reliable than a conditional $nin — avoids any stale pairing surviving.
  await CandidateJobPairings.deleteMany({ candidateId: candidate._id })

  if (!scored.length) {
    return { candidateId, totalJobs: jobs.length, paired: 0, pairings: [] }
  }

  const pairedAt = new Date()
  await CandidateJobPairings.bulkWrite(
    scored.map((item) => ({
      updateOne: {
        filter: { candidateId: candidate._id, jobId: item.job._id },
        update: {
          $set: {
            candidateId: candidate._id,
            jobId: item.job._id,
            score: item.score,
            matchedSkills: item.matchedSkills,
            reason: item.reason,
            pairedAt,
            source: 'mongo',
            algorithmVersion: 'deterministic-v2',
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  )

  const pairings = await CandidateJobPairings.find({
    candidateId: candidate._id,
    jobId: { $in: scored.map((item) => item.job._id) },
  })
    .sort({ score: -1 })
    .lean()

  return { candidateId: String(candidate._id), totalJobs: jobs.length, paired: pairings.length, pairings }
}

async function pairCandidateJobs(candidateId, options = {}) {
  const jobs = await getJobsModel().find({}).lean()
  return _pairCandidateWithJobs(candidateId, jobs, options)
}

async function pairAllCandidates(options = {}) {
  const candidates = await Candidates.find({}).select('_id').lean()
  // Load jobs once and reuse — avoids N full table scans
  const jobs = await getJobsModel().find({}).lean()
  const results = []
  for (const candidate of candidates) {
    try {
      results.push(await _pairCandidateWithJobs(candidate._id, jobs, options))
    } catch (error) {
      results.push({ candidateId: String(candidate._id), error: error.message })
    }
  }
  return results
}

module.exports = {
  pairCandidateJobs,
  pairAllCandidates,
  scoreJob,
  candidateSeniority,
  isLowLevelJob,
  isSeniorityCompatible,
}

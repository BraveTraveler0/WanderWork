'use strict'

const mongoose = require('mongoose')
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate')
const CandidateJobPairings = require('../models/JobSeeker/jobSeeker.CandidateJobPairing')
const { detectCluster, getDistance, roleScoreFromDistance, classifyMatchType } = require('./matching/roleOntology')
const { getBridgeEvidence, evaluateBridge } = require('./matching/bridgeRules')
const { normalizeSkills, expandSkillsWithAliases } = require('./matching/skillGraph')

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function getJobsModel() {
  return mongoose.models.JobDynamic ||
    mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }))
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value).split(',').map(s => s.trim()).filter(Boolean)
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))]
}

function containsPhrase(text, phrase) {
  const p = norm(phrase)
  return p.length > 0 && text.includes(p)
}

function tokenSet(text) {
  return new Set(text.split(/\s+/).filter(Boolean))
}

function locationText(locations) {
  if (!locations) return ''
  if (!Array.isArray(locations)) return norm(locations)
  return norm(locations.map(l => {
    if (!l || typeof l !== 'object') return l
    return [l.locationName, l.city, l.state, l.country].filter(Boolean).join(' ')
  }).join(' '))
}

// ---------------------------------------------------------------------------
// Job text extraction
// ---------------------------------------------------------------------------

function jobFullText(job) {
  return norm([
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

// ---------------------------------------------------------------------------
// Seniority detection
// ---------------------------------------------------------------------------

const SENIORITY_TIERS = [
  { level: 5, keywords: ['vp ', 'vice president', 'chief ', 'cto', 'cpo', 'cfo', 'ceo', 'c-level', 'partner', 'managing director', 'executive director'] },
  { level: 4, keywords: ['director', 'head of', 'principal'] },
  { level: 3, keywords: ['senior', 'sr.', 'sr ', 'lead ', 'staff ', 'manager', 'architect'] },
  { level: 2, keywords: ['mid ', 'mid-level', 'associate ', 'ii ', 'iii '] },
  { level: 1, keywords: ['junior', 'jr.', 'jr ', 'entry level', 'entry-level', 'intern', 'internship', 'apprentice', 'trainee', 'new grad', 'new graduate', 'early career', 'campus', 'student', 'co-op', 'fellowship'] },
]

const LOW_LEVEL_PATTERN = /\b(junior|jr|entry.level|intern|internship|apprentice|trainee|new.grad|new.graduate|early.career|campus|student|co.op|fellowship)\b/i

function detectSeniority(text) {
  const t = norm(text)
  for (const tier of SENIORITY_TIERS) {
    if (tier.keywords.some(k => t.includes(k))) return tier.level
  }
  return 2
}

function candidateSeniority(candidate) {
  if (candidate.seniority) {
    const level = detectSeniority(candidate.seniority)
    if (level !== 2) return level
  }
  return detectSeniority([
    toArray(candidate.targetRoles).join(' '),
    candidate.work_experience || '',
    candidate.summary || '',
  ].join(' '))
}

function isLowLevelJob(job) {
  const text = norm([job.title, job.jobType || job.job_type, job.shortDescription || job.description_short].filter(Boolean).join(' '))
  return LOW_LEVEL_PATTERN.test(text)
}

// ---------------------------------------------------------------------------
// Candidate keyword extraction
// ---------------------------------------------------------------------------

function candidateSkillList(candidate) {
  const raw = unique([
    ...toArray(candidate.skills),
    ...toArray(candidate.skills_2),
    ...toArray(candidate.inferredKeywords),
    ...toArray(candidate.inferredSkills),
    ...toArray(candidate.inferred_skills),
  ])
  return normalizeSkills(raw)
}

// All target role strings, normalized
function candidateRoleStrings(candidate) {
  return unique(toArray(candidate.targetRoles)).map(r => norm(r)).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Score components (each returns 0–100)
// ---------------------------------------------------------------------------

// Role score — based on cluster distance + bridge evidence
function computeRoleScore(distance, bridgeEvidence) {
  return roleScoreFromDistance(distance, bridgeEvidence?.score ?? 0)
}

// Skill score — matches candidate skills against job text + job.skills array
function computeSkillScore(candidateSkills, job) {
  if (!candidateSkills.length) return 30  // neutral baseline

  const jobText = jobFullText(job)
  const tokens = tokenSet(jobText)
  const jobSkillsNorm = normalizeSkills(toArray(job.skills))
  const expanded = expandSkillsWithAliases(candidateSkills)

  let matched = 0
  let total = 0
  const matchedList = []

  for (const skill of expanded) {
    total++
    const parts = skill.split(' ').filter(Boolean)
    const inText = parts.length > 1 ? containsPhrase(jobText, skill) : tokens.has(skill)
    const inJobSkills = jobSkillsNorm.includes(skill)

    if (inJobSkills) {
      matched += 1.5  // required-skill bonus
      matchedList.push(skill)
    } else if (inText) {
      matched += 1
      matchedList.push(skill)
    }
  }

  if (total === 0) return 30
  const ratio = Math.min(1, matched / Math.max(total * 0.4, 3))  // expect ~40% of skills to match
  return Math.round(30 + ratio * 70)  // 30–100
}

// Seniority score
function computeSeniorityScore(candLevel, job) {
  const jobLevel = detectSeniority(job.title || '')
  const diff = candLevel - jobLevel

  if (isLowLevelJob(job) && candLevel >= 3) return 0  // senior applying to intern/entry

  if (diff === 0) return 100
  if (diff === 1) return 75   // slightly overqualified
  if (diff === -1) return 85  // slight stretch — positive
  if (diff === 2) return 40
  if (diff === -2) return 55
  return 20
}

// Remote score — generous defaults when data is missing
function computeRemoteScore(job) {
  const text = jobFullText(job)
  if (containsPhrase(text, 'remote')) return 85
  if (containsPhrase(text, 'hybrid')) return 55
  if (containsPhrase(text, 'on-site') || containsPhrase(text, 'onsite') || containsPhrase(text, 'in office') || containsPhrase(text, 'in-office')) return 30
  return 50  // unclear → neutral
}

// Recency score
function computeRecencyScore(job) {
  const postedAt = new Date(job.date_posted || job.datePosted || job.postedAt || job.createdAt || 0).getTime()
  if (!postedAt) return 40
  const daysOld = Math.max(0, Math.floor((Date.now() - postedAt) / 86400000))
  if (daysOld <= 3) return 100
  if (daysOld <= 7) return 90
  if (daysOld <= 14) return 75
  if (daysOld <= 30) return 60
  if (daysOld <= 60) return 40
  if (daysOld <= 90) return 25
  return 10
}

// Domain/role alignment score — checks if candidate's target role keywords
// appear in the job text (title gets extra weight)
function computeDomainScore(candidateRoles, candidateSkills, job) {
  const title = norm(job.title || '')
  const text = jobFullText(job)
  let score = 0

  for (const role of candidateRoles) {
    if (containsPhrase(title, role)) { score += 30; break }
    if (containsPhrase(text, role)) { score += 15; break }
  }

  // Cluster-specific skill hits
  const skillsExpanded = expandSkillsWithAliases(candidateSkills)
  const domainHits = skillsExpanded.filter(s => s.length >= 3 && containsPhrase(text, s)).length
  score += Math.min(30, domainHits * 6)

  return Math.min(100, score)
}

// ---------------------------------------------------------------------------
// Match explanation
// ---------------------------------------------------------------------------

function buildReasons(params) {
  const { roleDistance, candClusterId, jobClusterId, bridgeEval, skillScore, seniorityScore, remoteScore, recencyScore, matchedRoleKeyword, finalScore } = params
  const reasons = []
  const warnings = []

  if (roleDistance === 0) reasons.push(`Direct ${jobClusterId?.replace(/_/g, ' ')} role match`)
  else if (roleDistance === 1) reasons.push(`Strong adjacent role (${jobClusterId?.replace(/_/g, ' ')})`)
  else if (roleDistance === 2) reasons.push(`Bridge match: ${candClusterId?.replace(/_/g, ' ')} → ${jobClusterId?.replace(/_/g, ' ')}`)
  else if (roleDistance === 3) reasons.push(`Stretch match: ${candClusterId?.replace(/_/g, ' ')} → ${jobClusterId?.replace(/_/g, ' ')}`)

  if (bridgeEval?.evidenceSkills?.length) {
    reasons.push(`Bridge skills: ${bridgeEval.evidenceSkills.slice(0, 4).join(', ')}`)
  }
  if (matchedRoleKeyword) reasons.push(`"${matchedRoleKeyword}" in job title`)
  if (skillScore >= 70) reasons.push('Strong skill match')
  else if (skillScore >= 50) reasons.push('Moderate skill match')
  if (seniorityScore >= 85) reasons.push('Seniority aligned')
  else if (seniorityScore < 40) warnings.push('Seniority mismatch')
  if (remoteScore >= 80) reasons.push('Remote eligible')
  else if (remoteScore <= 30) warnings.push('May not be remote')
  if (recencyScore >= 90) reasons.push('Posted within 3 days')
  else if (recencyScore >= 75) reasons.push('Posted within 2 weeks')

  return { reasons, warnings }
}

// ---------------------------------------------------------------------------
// Core job scorer
// ---------------------------------------------------------------------------

const DEFAULT_MIN_SCORE = 40
const ALGORITHM_VERSION = 'structured-v3'

function scoreJob(candidate, job, candSkills, candRoles, candCluster, candSeniorityLevel) {
  const title = norm(job.title || '')
  const text = jobFullText(job)

  // Detect job cluster
  const jobClusterObj = detectCluster(job.title)
  const jobClusterId = jobClusterObj?.id ?? null

  // Role distance
  const distance = getDistance(candCluster?.id ?? null, jobClusterId)

  // Hard block at distance 5 (unrelated families)
  if (distance >= 5) {
    return {
      score: 0,
      excluded: true,
      excludeReason: `Unrelated role family: candidate=${candCluster?.id}, job=${jobClusterId}`,
    }
  }

  // Hard block: senior candidate applying to entry/intern role
  if (candSeniorityLevel >= 3 && isLowLevelJob(job)) {
    return { score: 0, excluded: true, excludeReason: 'Entry-level job excluded for senior candidate' }
  }

  // Bridge evidence (only meaningful when distance >= 2)
  let bridgeEvidenceResult = null
  if (distance >= 2 && candCluster?.id && jobClusterId) {
    bridgeEvidenceResult = getBridgeEvidence(candSkills, candCluster.id, jobClusterId)
  }
  const bridgeEval = evaluateBridge(bridgeEvidenceResult, distance)

  // At distance 2+, require bridge evidence to show the job
  if (distance >= 2 && !bridgeEval.show) {
    return {
      score: 0,
      excluded: true,
      excludeReason: `Insufficient bridge evidence (${candCluster?.id} → ${jobClusterId})`,
    }
  }

  // Score components
  const roleScore = computeRoleScore(distance, bridgeEvidenceResult)
  const skillScore = computeSkillScore(candSkills, job)
  const seniorityScore = computeSeniorityScore(candSeniorityLevel, job)
  const remoteScore = computeRemoteScore(job)
  const recencyScore = computeRecencyScore(job)
  const domainScore = computeDomainScore(candRoles, candSkills, job)

  // Did the candidate's target role appear in the job title?
  const matchedRoleKeyword = candRoles.find(r => containsPhrase(title, r)) || null

  // Weighted formula — weights must sum to 1.0
  const rawScore =
    roleScore    * 0.30 +
    skillScore   * 0.30 +
    seniorityScore * 0.10 +
    remoteScore  * 0.10 +
    recencyScore * 0.10 +
    domainScore  * 0.05 +
    (bridgeEval.bridgeScore || 0) * 100 * 0.05

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)))

  // Skill match list for display (top skills that appear in job text)
  const tokens = tokenSet(text)
  const expanded = expandSkillsWithAliases(candSkills)
  const matchedSkills = unique(
    expanded.filter(s => {
      const parts = s.split(' ').filter(Boolean)
      return parts.length > 1 ? containsPhrase(text, s) : tokens.has(s)
    })
  ).slice(0, 12)

  const matchType = bridgeEval.matchType || classifyMatchType(distance)
  const { reasons, warnings } = buildReasons({
    roleDistance: distance,
    candClusterId: candCluster?.id,
    jobClusterId,
    bridgeEval: bridgeEvidenceResult ? { ...bridgeEvidenceResult, ...bridgeEval } : null,
    skillScore,
    seniorityScore,
    remoteScore,
    recencyScore,
    matchedRoleKeyword,
    finalScore,
  })

  return {
    score: finalScore,
    excluded: false,
    matchType,
    matchedSkills,
    roleScore,
    skillScore,
    seniorityScore,
    remoteScore,
    recencyScore,
    domainScore,
    bridgeScore: bridgeEval.bridgeScore || 0,
    reasons,
    warnings,
    reason: reasons[0] || 'Matched on role and skills',
  }
}

// ---------------------------------------------------------------------------
// Pairing engine
// ---------------------------------------------------------------------------

async function _pairCandidateWithJobs(candidateId, jobs, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(candidateId))) {
    throw new Error('Invalid candidate id')
  }

  const minScore = Number(options.minScore) || DEFAULT_MIN_SCORE
  const limit = Number(options.limit) || 250

  const candidate = await Candidates.findById(candidateId).lean()
  if (!candidate) {
    const err = new Error('Candidate not found'); err.statusCode = 404; throw err
  }

  // Pre-compute candidate attributes once
  const candSkills = candidateSkillList(candidate)
  const candRoles = candidateRoleStrings(candidate)
  const candSeniorityLevel = candidateSeniority(candidate)

  // Detect candidate cluster from their target roles
  const roleText = candRoles.join(' ')
  const candCluster = detectCluster(roleText) ?? detectCluster(candRoles[0] || '')

  const scored = jobs
    .map(job => {
      const result = scoreJob(candidate, job, candSkills, candRoles, candCluster, candSeniorityLevel)
      return { job, ...result }
    })
    .filter(item => !item.excluded && item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Delete all existing pairings, rewrite with fresh scores
  await CandidateJobPairings.deleteMany({ candidateId: candidate._id })

  if (!scored.length) {
    return { candidateId: String(candidate._id), totalJobs: jobs.length, paired: 0, pairings: [] }
  }

  const pairedAt = new Date()
  await CandidateJobPairings.bulkWrite(
    scored.map(item => ({
      updateOne: {
        filter: { candidateId: candidate._id, jobId: item.job._id },
        update: {
          $set: {
            candidateId: candidate._id,
            jobId: item.job._id,
            score: item.score,
            matchType: item.matchType,
            matchedSkills: item.matchedSkills,
            reasons: item.reasons,
            warnings: item.warnings,
            reason: item.reason,
            roleScore: item.roleScore,
            skillScore: item.skillScore,
            bridgeScore: item.bridgeScore,
            pairedAt,
            source: 'mongo',
            algorithmVersion: ALGORITHM_VERSION,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  )

  const pairings = await CandidateJobPairings
    .find({ candidateId: candidate._id, jobId: { $in: scored.map(i => i.job._id) } })
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
  const jobs = await getJobsModel().find({}).lean()
  const results = []
  for (const candidate of candidates) {
    try {
      results.push(await _pairCandidateWithJobs(candidate._id, jobs, options))
    } catch (err) {
      results.push({ candidateId: String(candidate._id), error: err.message })
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
}

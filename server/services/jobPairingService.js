const mongoose = require('mongoose')
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate')
const Jobs = require('../models/JobSeeker/jobSeeker.Job')
const CandidateJobPairings = require('../models/JobSeeker/jobSeeker.CandidateJobPairing')

const DEFAULT_LIMIT = 250
const DEFAULT_MIN_SCORE = 18

const SYNONYMS = {
  ui: ['user interface', 'interface'],
  ux: ['user experience', 'research', 'prototype', 'prototyping'],
  javascript: ['js'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js'],
  node: ['nodejs', 'node.js'],
  brand: ['branding'],
  content: ['copywriting', 'copy'],
  creative: ['design', 'brand', 'visual'],
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
  const base = unique([
    ...toArray(candidate.skills),
    ...toArray(candidate.skills_2),
    ...toArray(candidate.inferredSkills),
    ...toArray(candidate.inferred_skills),
    ...toArray(candidate.targetRoles),
    candidate.work_experience,
    candidate.education,
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
    job.jobType,
    locationText(job.location),
    job.shortDescription,
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

function scoreJob(candidate, job, keywords) {
  const text = jobText(job)
  const tokens = tokenSet(text)
  const title = normalizeText(job.title)
  const candidateRoles = unique(toArray(candidate.targetRoles))

  const matchedSkills = []
  let score = 0

  for (const keyword of keywords) {
    const parts = keyword.split(' ').filter(Boolean)
    const matched = parts.length > 1 ? containsPhrase(text, keyword) : tokens.has(keyword)
    if (!matched) continue
    matchedSkills.push(keyword)
    score += containsPhrase(title, keyword) ? 12 : 6
  }

  for (const role of candidateRoles) {
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

  const postedAt = new Date(job.datePosted || job.postedAt || job.createdAt || 0).getTime()
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

  const cappedScore = Math.max(0, Math.min(100, Math.round(score)))
  return {
    score: cappedScore,
    matchedSkills: uniqueMatches.slice(0, 12),
    reason: uniqueMatches.length
      ? `Matched on ${uniqueMatches.slice(0, 5).join(', ')}`
      : 'Matched on role, location, or job freshness',
  }
}

async function pairCandidateJobs(candidateId, options = {}) {
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
  const jobs = await Jobs.find({}).lean()
  const scored = jobs
    .map((job) => ({ job, ...scoreJob(candidate, job, keywords) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

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
            algorithmVersion: 'deterministic-v1',
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

async function pairAllCandidates(options = {}) {
  const candidates = await Candidates.find({}).select('_id').lean()
  const results = []
  for (const candidate of candidates) {
    try {
      results.push(await pairCandidateJobs(candidate._id, options))
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
}

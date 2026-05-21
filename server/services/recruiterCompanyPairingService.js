const Recruiter = require('../models/JobSeeker/jobSeeker.Recruiter')
const Jobs = require('../models/JobSeeker/jobSeeker.Job')
const RecruiterJobPairing = require('../models/JobSeeker/jobSeeker.RecruiterJobPairing')

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000
let scheduledTimer = null
let scheduleRunning = false

const AGENCY_PATTERNS = [
  /\bstaffing\b/i,
  /\bagenc(y|ies)\b/i,
  /\brecruit(ing|ment)?\b/i,
  /\btalent agency\b/i,
  /\bsearch firm\b/i,
  /\bheadhunt/i,
  /\bplacement\b/i,
  /\bemployment agency\b/i,
  /\bworkforce solutions\b/i,
  /\bconsulting group\b/i,
  /\bconsulting services\b/i,
  /\bprofessional services\b/i,
  /\bmanpower\b/i,
  /\brobert half\b/i,
  /\brandstad\b/i,
  /\badecco\b/i,
  /\bkelly\b/i,
  /\bteksystems\b/i,
  /\binsight global\b/i,
  /\bmotion recruitment\b/i,
  /\bcybercoders\b/i,
  /\bkforce\b/i,
  /\bcreative circle\b/i,
  /\b24 seven\b/i,
  /\batrium\b/i,
  /\bmichael page\b/i,
  /\bhays\b/i,
  /\baerotek\b/i,
  /\bapex systems\b/i,
  /\baddison group\b/i,
  /\bla salle network\b/i,
  /\bthe judge group\b/i,
  /\bvaco\b/i,
  /\bmodis\b/i,
  /\bakkodis\b/i,
]

const COMPANY_SUFFIXES = [
  'incorporated',
  'corporation',
  'company',
  'limited',
  'holdings',
  'group',
  'systems',
  'technologies',
  'technology',
  'solutions',
  'services',
  'international',
  'global',
  'inc',
  'corp',
  'co',
  'llc',
  'ltd',
  'plc',
]

const JOB_BOARD_COMPANIES = new Set([
  'linkedin',
  'indeed',
  'built in',
  'breezy hr',
  'greenhouse',
  'lever',
  'workday',
  'ziprecruiter',
])

function normalizeCompany(value) {
  const words = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter((word) => !COMPANY_SUFFIXES.includes(word))

  return words.join(' ').replace(/\s+/g, ' ').trim()
}

function extractEmployerCompany(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const labeled = raw.match(/company\s*name\s*:\s*([^\n\r]+)/i)
  if (labeled) {
    return labeled[1].replace(/\s+(salary|updated description)\s*:.*$/i, '').trim()
  }

  return raw
    .split(/\s+\|\s+/)[0]
    .split(/\n|\r/)[0]
    .replace(/\s+(salary|updated description)\s*:.*$/i, '')
    .trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isAgencyRecruiter(recruiter) {
  const text = [recruiter.company, recruiter.source].filter(Boolean).join(' ')
  return AGENCY_PATTERNS.some((pattern) => pattern.test(text))
}

function isUsefulCompanyKey(key) {
  return key &&
    key.length >= 2 &&
    !JOB_BOARD_COMPANIES.has(key) &&
    ![
      'remote',
      'remotely',
      'remote across anz',
      'north america remote',
      'confidential',
      'unknown',
      'not available',
      'not found',
      'not specified',
      'freelance',
      'ai trainer',
      'm d',
      'na',
      'n a',
    ].includes(key)
}

function confidenceForMatch(recruiterKey, jobKey) {
  if (!recruiterKey || !jobKey) return 0
  if (recruiterKey === jobKey) return 100

  const recruiterWords = recruiterKey.split(' ')
  const jobWords = jobKey.split(' ')
  if (recruiterWords.length >= 2 && jobKey.includes(recruiterKey)) return 90
  if (jobWords.length >= 2 && recruiterKey.includes(jobKey)) return 90
  return 0
}

async function pairRecruitersToCompanies(options = {}) {
  const limit = Number(options.limit) || 5000
  const minConfidence = Number(options.minConfidence) || 90
  const [recruiters, jobs] = await Promise.all([
    Recruiter.find({ status: 'active', company: { $nin: [null, ''] }, email: { $nin: [null, ''] } })
      .limit(limit)
      .lean(),
    Jobs.find({ company: { $nin: [null, ''] } }).lean(),
  ])

  const jobsByCompany = new Map()
  for (const job of jobs) {
    const employerCompany = extractEmployerCompany(job.company)
    const key = normalizeCompany(employerCompany)
    if (!isUsefulCompanyKey(key)) continue
    if (!jobsByCompany.has(key)) jobsByCompany.set(key, [])
    jobsByCompany.get(key).push({ ...job, employerCompany })
  }

  const writes = []
  const pairedAt = new Date()
  let skippedAgencies = 0

  for (const recruiter of recruiters) {
    if (isAgencyRecruiter(recruiter)) {
      skippedAgencies += 1
      continue
    }

    const recruiterKey = normalizeCompany(recruiter.company)
    if (!isUsefulCompanyKey(recruiterKey)) continue

    for (const [jobKey, companyJobs] of jobsByCompany.entries()) {
      const confidence = confidenceForMatch(recruiterKey, jobKey)
      if (confidence < minConfidence) continue

      for (const job of companyJobs) {
        writes.push({
          updateOne: {
            filter: { recruiterId: recruiter._id, jobId: job._id },
            update: {
              $set: {
                recruiterId: recruiter._id,
                jobId: job._id,
                company: job.employerCompany || job.company,
                normalizedCompany: jobKey,
                confidence,
                reason: confidence === 100
                  ? `Recruiter company matches job company: ${job.employerCompany || job.company}`
                  : `Recruiter company is a close normalized match for ${job.employerCompany || job.company}`,
                pairedAt,
                source: 'mongo',
                algorithmVersion: 'company-normalized-v1',
              },
            },
            upsert: true,
          },
        })
      }
    }
  }

  await RecruiterJobPairing.deleteMany({
    source: 'mongo',
    algorithmVersion: 'company-normalized-v1',
  })

  if (writes.length) {
    await RecruiterJobPairing.bulkWrite(writes, { ordered: false })
  }

  return {
    recruitersChecked: recruiters.length,
    jobsChecked: jobs.length,
    skippedAgencies,
    paired: writes.length,
    companiesMatched: new Set(writes.map((write) => write.updateOne.update.$set.normalizedCompany)).size,
  }
}

async function getRecruitersForCompany(company, options = {}) {
  const limit = Number(options.limit) || 50
  const contactedIds = options.contactedIds || []
  const key = normalizeCompany(company)
  if (!isUsefulCompanyKey(key)) return []

  const pairings = await RecruiterJobPairing.find({ normalizedCompany: key })
    .sort({ confidence: -1, pairedAt: -1 })
    .limit(limit * 3)
    .populate({ path: 'recruiterId', model: 'JobSeeker.Recruiter' })
    .lean()

  const seen = new Set()
  const contacted = new Set(contactedIds.map(String))
  const recruiters = []

  for (const pairing of pairings) {
    const recruiter = pairing.recruiterId
    if (!recruiter?._id) continue
    const id = String(recruiter._id)
    if (seen.has(id) || contacted.has(id)) continue
    if (!recruiter.email || recruiter.status !== 'active' || isAgencyRecruiter(recruiter)) continue
    seen.add(id)
    recruiters.push({ ...recruiter, companyPairing: {
      company: pairing.company,
      confidence: pairing.confidence,
      reason: pairing.reason,
      pairedAt: pairing.pairedAt,
    } })
    if (recruiters.length >= limit) break
  }

  if (recruiters.length) return recruiters

  return Recruiter.find({
    company: { $regex: new RegExp(`^\\s*${escapeRegex(company)}\\s*$`, 'i') },
    _id: { $nin: contactedIds },
    email: { $nin: [null, ''] },
    status: 'active',
  })
    .sort({ score: -1 })
    .limit(limit)
    .lean()
}

function scheduleRecruiterCompanyPairing(options = {}) {
  if (scheduledTimer) return scheduledTimer
  const intervalMs = Number(options.intervalMs) || DEFAULT_INTERVAL_MS

  const run = async () => {
    if (scheduleRunning) return
    scheduleRunning = true
    try {
      const result = await pairRecruitersToCompanies(options)
      console.log('[RecruiterCompanyPairing]', result)
    } catch (error) {
      console.warn('[RecruiterCompanyPairing] failed:', error.message)
    } finally {
      scheduleRunning = false
    }
  }

  scheduledTimer = setInterval(run, intervalMs)
  scheduledTimer.unref?.()
  setTimeout(run, 30000).unref?.()
  return scheduledTimer
}

module.exports = {
  normalizeCompany,
  extractEmployerCompany,
  isAgencyRecruiter,
  pairRecruitersToCompanies,
  getRecruitersForCompany,
  scheduleRecruiterCompanyPairing,
}

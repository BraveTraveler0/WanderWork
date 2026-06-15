'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const mongoose = require('mongoose')
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate')
const Job = require('../models/JobSeeker/jobSeeker.Job')
const Application = require('../models/JobSeeker/jobSeeker.Application')
const RecruiterContact = require('../models/JobSeeker/jobSeeker.RecruiterContact')
const CandidateJobPairing = require('../models/JobSeeker/jobSeeker.CandidateJobPairing')
const { adminDigestEmail } = require('../utils/adminDigestEmail')

// Friday noon EST = Friday 17:00 UTC
const SCHEDULE = '0 17 * * 5'

async function gatherStats() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  // ObjectId boundary for Candidate new signups (no createdAt field)
  const weekAgoObjectId = mongoose.Types.ObjectId.createFromTime(Math.floor(weekAgo.getTime() / 1000))

  // Use raw collection for job queries — fields like desc_cleaned, has_recruiter, description_short
  // are not in the Mongoose schema, and strictQuery strips unknown fields from model queries
  const jobCol = mongoose.connection.collection('jobseeker.jobs')

  const [
    totalCandidates,
    newCandidates,
    candidatesWithResume,
    paidCandidates,

    totalJobs,
    newJobs,
    jobsWithRecruiter,
    jobsCleaned,
    jobsWithoutDescription,
    topCompanies,

    newPairings,
    pairingAgg,
    candidatesWithPairings,

    materialsGenerated,

    recruiterEmailsSent,

    tokensAgg,
  ] = await Promise.all([
    // Candidates
    Candidate.countDocuments(),
    Candidate.countDocuments({ _id: { $gt: weekAgoObjectId } }),
    Candidate.countDocuments({ resume_text: { $exists: true, $ne: '' } }),
    Candidate.countDocuments({ plan: { $in: ['upgraded', 'premium'] } }),

    // Jobs — raw collection to avoid strictQuery stripping non-schema fields
    jobCol.countDocuments({}),
    jobCol.countDocuments({ datePosted: { $gte: weekAgo } }),
    jobCol.countDocuments({ has_recruiter: true }),
    jobCol.countDocuments({ desc_cleaned: true }),
    jobCol.countDocuments({ desc_cleaned: { $ne: true }, description_short: { $exists: true, $ne: '' } }),
    jobCol.aggregate([
      { $match: { company: { $exists: true, $ne: '' } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, company: '$_id', count: 1 } },
    ]).toArray(),

    // Pairings
    CandidateJobPairing.countDocuments({ pairedAt: { $gte: weekAgo } }),
    CandidateJobPairing.aggregate([
      { $match: { pairedAt: { $gte: weekAgo }, score: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$score' } } },
    ]),
    CandidateJobPairing.distinct('candidateId').then(ids => ids.length),

    // Application materials
    Application.countDocuments({ preparedAt: { $gte: weekAgo } }),

    // Recruiter emails
    RecruiterContact.countDocuments({ sentAt: { $gte: weekAgo } }),

    // Tokens/credits used — sum tokensUsed across all candidates
    Candidate.aggregate([
      { $group: { _id: null, total: { $sum: '$tokensUsed' } } },
    ]),
  ])

  return {
    weekStart: weekAgo,
    weekEnd: now,
    stats: {
      totalCandidates,
      newCandidates,
      candidatesWithResume,
      paidCandidates,

      totalJobs,
      newJobs,
      jobsWithRecruiter,
      jobsCleaned,
      jobsWithoutDescription,
      topCompanies,

      newPairings,
      avgMatchScore: pairingAgg[0]?.avg ?? null,
      candidatesWithPairings,

      materialsGenerated,
      recruiterEmailsSent,
      tokensSpentTotal: tokensAgg[0]?.total ?? 0,
    },
  }
}

async function sendAdminWeeklyDigest() {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey || apiKey === 'SG.placeholder') {
    console.log('[AdminDigest] No SendGrid key set, skipping.')
    return
  }
  sgMail.setApiKey(apiKey)

  console.log('[AdminDigest] Gathering weekly stats...')
  const { weekStart, weekEnd, stats } = await gatherStats()

  console.log('[AdminDigest] Stats gathered:', JSON.stringify(stats, null, 2))

  const msg = adminDigestEmail({ weekStart, weekEnd, stats })

  try {
    await sgMail.send(msg)
    console.log('[AdminDigest] Digest sent to darrienccarter@gmail.com')
  } catch (err) {
    console.error('[AdminDigest] Send failed:', err.response?.body || err.message)
  }
}

function initAdminWeeklyDigest() {
  console.log('[AdminDigest] Weekly admin digest scheduled: Fridays at 12PM EST')
  cron.schedule(SCHEDULE, () => {
    sendAdminWeeklyDigest().catch(err =>
      console.error('[AdminDigest] Unexpected error:', err.message)
    )
  })
}

module.exports = { initAdminWeeklyDigest, sendAdminWeeklyDigest }

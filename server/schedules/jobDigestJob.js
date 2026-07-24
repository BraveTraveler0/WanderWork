const cron = require('node-cron');
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
const connectDB = require('../config/dbConn');
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate');
const Job = require('../models/JobSeeker/jobSeeker.Job');
const CandidateJobPairing = require('../models/JobSeeker/jobSeeker.CandidateJobPairing');
const { jobDigestEmail } = require('../utils/jobDigestEmail');

const SCHEDULE = '0 10 * * 2';
const SCHEDULE_TIMEZONE = 'America/New_York';
const JOBS_PER_EMAIL = 5;
const MAX_JOB_AGE_DAYS = 60;
const MIN_MATCH_SCORE = 35;

async function ensureDatabaseConnection() {
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.db.admin().ping();
      return;
    } catch (err) {
      console.warn(`[JobDigest] MongoDB ping failed; reconnecting: ${err.message}`);
    }
  }

  await mongoose.disconnect().catch(() => {});
  await connectDB();
}

function isDigestEligibleJob(job, now = Date.now()) {
  if (!job || !job.title || !job.company || !(job.url || job.url_normalized)) return false;

  const status = String(job.status || job.submit_status || '').trim().toLowerCase();
  if (['closed', 'expired', 'inactive', 'removed', 'rejected'].includes(status)) return false;

  const postedValue = job.datePosted || job.date_posted || job.postedAt || job.createdAt;
  const postedAt = postedValue ? new Date(postedValue).getTime() : NaN;
  if (!Number.isFinite(postedAt)) return false;

  const ageMs = now - postedAt;
  return ageMs >= -(2 * 24 * 60 * 60 * 1000)
    && ageMs <= MAX_JOB_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function digestWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

async function getMatchedJobsForCandidate(candidateId) {
  // Fetch extra pairings because stale and closed jobs are filtered below.
  const pairings = await CandidateJobPairing.find({ candidateId })
    .sort({ score: -1 })
    .limit(JOBS_PER_EMAIL * 10)
    .lean();

  if (!pairings.length) return [];

  const eligiblePairings = pairings.filter(pairing => Number(pairing.score) >= MIN_MATCH_SCORE);
  const jobIds = eligiblePairings.map(pairing => pairing.jobId);
  const jobs = await Job.find({ _id: { $in: jobIds } }).lean();

  const jobMap = new Map(jobs.map(job => [job._id.toString(), job]));
  return eligiblePairings
    .map(pairing => jobMap.get(pairing.jobId.toString()))
    .filter(isDigestEligibleJob)
    .slice(0, JOBS_PER_EMAIL);
}

async function sendWeeklyJobDigest() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || apiKey === 'SG.placeholder') {
    console.log('[JobDigest] No SendGrid key set, skipping.');
    return;
  }
  sgMail.setApiKey(apiKey);

  console.log('[JobDigest] Starting weekly job digest...');
  await ensureDatabaseConnection();

  const candidates = await Candidate.find(
    { email: { $exists: true, $ne: '' } },
    'firstName email _id'
  ).lean();

  console.log(`[JobDigest] Processing ${candidates.length} candidates.`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const weekKey = digestWeekKey();
  const deliveries = mongoose.connection.db.collection('job_digest_deliveries');

  for (const candidate of candidates) {
    if (!candidate.email) continue;

    const jobs = await getMatchedJobsForCandidate(candidate._id);
    if (!jobs.length) {
      console.log(`  [skip] ${candidate.email} — no current matched jobs`);
      skipped++;
      continue;
    }

    // Both production services run this scheduler. Claiming each candidate/week
    // prevents duplicate emails while a failed send remains retryable.
    const deliveryId = `${weekKey}:${String(candidate._id)}`;
    try {
      await deliveries.insertOne({
        _id: deliveryId,
        candidateId: candidate._id,
        email: candidate.email.toLowerCase(),
        weekKey,
        status: 'sending',
        createdAt: new Date(),
      });
    } catch (err) {
      if (err && err.code === 11000) {
        console.log(`  [skip] ${candidate.email} — digest already claimed for ${weekKey}`);
        skipped++;
        continue;
      }
      throw err;
    }

    const template = jobDigestEmail({ firstName: candidate.firstName, jobs });
    try {
      await sgMail.send({ to: candidate.email, ...template });
      await deliveries.updateOne(
        { _id: deliveryId },
        { $set: { status: 'sent', sentAt: new Date(), jobIds: jobs.map(job => job._id) } }
      );
      console.log(`  [sent] ${candidate.email} — ${jobs.length} matched jobs`);
      sent++;
    } catch (err) {
      console.warn(`  [fail] ${candidate.email}: ${err.message}`);
      await deliveries.deleteOne({ _id: deliveryId }).catch(() => {});
      failed++;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log(`[JobDigest] Done. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
}

function initJobDigestSchedule() {
  console.log('[JobDigest] Weekly digest scheduled: Tuesdays at 10 AM America/New_York');
  cron.schedule(SCHEDULE, () => {
    sendWeeklyJobDigest().catch(err =>
      console.error('[JobDigest] Unexpected error:', err.message)
    );
  }, { timezone: SCHEDULE_TIMEZONE });
}

module.exports = {
  initJobDigestSchedule,
  sendWeeklyJobDigest,
  getMatchedJobsForCandidate,
  isDigestEligibleJob,
  digestWeekKey,
};

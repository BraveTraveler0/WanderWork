const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate');
const Job = require('../models/JobSeeker/jobSeeker.Job');
const CandidateJobPairing = require('../models/JobSeeker/jobSeeker.CandidateJobPairing');
const { jobDigestEmail } = require('../utils/jobDigestEmail');

// Tuesday 10 AM EST = Tuesday 15:00 UTC
const SCHEDULE = '0 15 * * 2';
const JOBS_PER_EMAIL = 5;

async function getMatchedJobsForCandidate(candidateId) {
  // Get top scored pairings for this candidate
  const pairings = await CandidateJobPairing.find({ candidateId })
    .sort({ score: -1 })
    .limit(JOBS_PER_EMAIL)
    .lean();

  if (!pairings.length) return [];

  const jobIds = pairings.map(p => p.jobId);
  const jobs = await Job.find({ _id: { $in: jobIds } }).lean();

  // Return jobs in score order
  const jobMap = new Map(jobs.map(j => [j._id.toString(), j]));
  return pairings
    .map(p => jobMap.get(p.jobId.toString()))
    .filter(Boolean);
}

async function sendWeeklyJobDigest() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || apiKey === 'SG.placeholder') {
    console.log('[JobDigest] No SendGrid key set, skipping.');
    return;
  }
  sgMail.setApiKey(apiKey);

  console.log('[JobDigest] Starting weekly job digest...');

  const candidates = await Candidate.find(
    { email: { $exists: true, $ne: '' } },
    'firstName email _id'
  ).lean();

  console.log(`[JobDigest] Processing ${candidates.length} candidates.`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of candidates) {
    if (!c.email) continue;

    const jobs = await getMatchedJobsForCandidate(c._id);

    if (!jobs.length) {
      console.log(`  [skip] ${c.email} — no matched jobs`);
      skipped++;
      continue;
    }

    const template = jobDigestEmail({ firstName: c.firstName, jobs });
    try {
      await sgMail.send({ to: c.email, ...template });
      console.log(`  [sent] ${c.email} — ${jobs.length} matched jobs`);
      sent++;
    } catch (err) {
      console.warn(`  [fail] ${c.email}: ${err.message}`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`[JobDigest] Done. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`);
}

function initJobDigestSchedule() {
  console.log('[JobDigest] Weekly digest scheduled: Mondays at 10 AM EST');
  cron.schedule(SCHEDULE, () => {
    sendWeeklyJobDigest().catch(err =>
      console.error('[JobDigest] Unexpected error:', err.message)
    );
  });
}

module.exports = { initJobDigestSchedule, sendWeeklyJobDigest };

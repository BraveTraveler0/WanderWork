const cron = require('node-cron');
const mongoose = require('mongoose');
const { importAtsJobs } = require('../scripts/importAtsJobs.cjs');
const { importRemotiveOnly } = require('../scripts/importRemoteJobs.cjs');
const { cleanNewJobs } = require('../scripts/cleanJobDescriptions.cjs');
const { tagRecruiterJobs } = require('../scripts/tagRecruiterJobs.cjs');
const { purgeJobs } = require('../scripts/purgeJobs.cjs');
const { pairAllCandidates } = require('../services/jobPairingService');

// If ATS import leaves the DB below this count, Remotive fills the gap
const REMOTIVE_FALLBACK_THRESHOLD = 1200;

// Every 6 hours: midnight, 6am, noon, 6pm UTC
const SCHEDULE = '0 0,6,12,18 * * *';

let running = false;

async function runImport() {
  if (running) { console.log('[Import] Already in progress, skipping.'); return; }
  running = true;
  try {
    console.log('[Import] Starting ATS import cycle...');
    // ATS-direct: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Jobvite
    try { await importAtsJobs(); } catch (e) { console.warn('[Import] ATS error:', e.message); }

    // Remotive fallback — only if ATS didn't bring us to the threshold
    try {
      const col = mongoose.connection.collection('jobseeker.jobs');
      const count = await col.countDocuments({});
      if (count < REMOTIVE_FALLBACK_THRESHOLD) {
        console.log(`[Import] Only ${count} jobs after ATS (threshold ${REMOTIVE_FALLBACK_THRESHOLD}) — running Remotive fallback`);
        await importRemotiveOnly();
      } else {
        console.log(`[Import] ${count} jobs after ATS — Remotive fallback not needed`);
      }
    } catch (e) { console.warn('[Import] Remotive fallback error:', e.message); }

    // Tag recruiter jobs and purge stale ones before pairing
    try { await tagRecruiterJobs(); } catch (e) { console.warn('[Import] Recruiter tag error:', e.message); }
    try { await purgeJobs(); } catch (e) { console.warn('[Import] Purge error:', e.message); }
    // Re-pair all candidates — runs BEFORE cleanNewJobs so an OpenAI hang never blocks it
    try {
      console.log('[Import] Re-pairing all candidates...');
      const pairResults = await pairAllCandidates();
      const paired = pairResults.reduce((s, r) => s + (r.paired || 0), 0);
      console.log(`[Import] Paired ${paired} jobs across ${pairResults.length} candidates`);
    } catch (e) { console.warn('[Import] Pairing error:', e.message); }
    // Clean descriptions last — OpenAI calls can hang; doesn't block anything critical above
    try { await cleanNewJobs(); } catch (e) { console.warn('[Import] Clean error:', e.message); }
    // Bust the in-memory job cache so new jobs show within the next request
    try {
      const ctrl = require('../controllers/JobSeeker/jobSeekerController');
      if (typeof ctrl._invalidateJobsCache === 'function') ctrl._invalidateJobsCache();
    } catch (_) {}
    console.log('[Import] Cycle complete.');
  } catch (err) {
    console.error('[Import] Cycle error:', err.message);
  } finally {
    running = false;
  }
}

function initRemoteJobsImport() {
  cron.schedule(SCHEDULE, runImport);
  console.log('[RemoteJobs] Import scheduled every 6 hours (0, 6, 12, 18 UTC)');
  // Run once at startup so jobs are available immediately
  setImmediate(runImport);
}

module.exports = { initRemoteJobsImport };

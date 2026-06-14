const cron = require('node-cron');
const { importAtsJobs } = require('../scripts/importAtsJobs.cjs');
const { cleanNewJobs } = require('../scripts/cleanJobDescriptions.cjs');
const { tagRecruiterJobs } = require('../scripts/tagRecruiterJobs.cjs');
const { purgeJobs } = require('../scripts/purgeJobs.cjs');

// Every 6 hours: midnight, 6am, noon, 6pm UTC
const SCHEDULE = '0 0,6,12,18 * * *';

let running = false;

async function runImport() {
  if (running) { console.log('[Import] Already in progress, skipping.'); return; }
  running = true;
  try {
    console.log('[Import] Starting ATS import cycle...');
    // ATS-direct only: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Jobvite
    try { await importAtsJobs(); } catch (e) { console.warn('[Import] ATS error:', e.message); }
    // Clean descriptions for any newly added jobs
    try { await cleanNewJobs(); } catch (e) { console.warn('[Import] Clean error:', e.message); }
    // Re-pair recruiter companies with jobs so new jobs get tagged immediately
    try { await tagRecruiterJobs(); } catch (e) { console.warn('[Import] Recruiter tag error:', e.message); }
    // Purge zombie/low-quality jobs after every import cycle
    try { await purgeJobs(); } catch (e) { console.warn('[Import] Purge error:', e.message); }
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

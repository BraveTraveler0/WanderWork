const cron = require('node-cron');
const { importRemoteJobs } = require('../scripts/importRemoteJobs.cjs');
const { cleanNewJobs } = require('../scripts/cleanJobDescriptions.cjs');

// Every 6 hours: midnight, 6am, noon, 6pm UTC
const SCHEDULE = '0 0,6,12,18 * * *';

let running = false;

async function runImport() {
  if (running) { console.log('[RemoteJobs] Import already in progress, skipping.'); return; }
  running = true;
  try {
    console.log('[RemoteJobs] Starting scheduled import...');
    const result = await importRemoteJobs();
    console.log('[RemoteJobs] Import complete:', result);
    // Clean descriptions for any newly added jobs
    try { await cleanNewJobs(); } catch (e) { console.warn('[RemoteJobs] Clean error:', e.message); }
    // Bust the in-memory job cache so new jobs show within the next request
    try {
      const ctrl = require('../controllers/JobSeeker/jobSeekerController');
      if (typeof ctrl._invalidateJobsCache === 'function') ctrl._invalidateJobsCache();
    } catch (_) {}
  } catch (err) {
    console.error('[RemoteJobs] Import error:', err.message);
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

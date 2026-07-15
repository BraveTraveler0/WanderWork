const cron = require('node-cron');
const mongoose = require('mongoose');
const { importAtsJobs } = require('../scripts/importAtsJobs.cjs');
const { importRemoteJobs } = require('../scripts/importRemoteJobs.cjs');
const { cleanNewJobs } = require('../scripts/cleanJobDescriptions.cjs');
const { tagRecruiterJobs } = require('../scripts/tagRecruiterJobs.cjs');
const { purgeJobs } = require('../scripts/purgeJobs.cjs');
const { pairAllCandidates } = require('../services/jobPairingService');
const { notifyJobsAdded, notifyJobsRemoved } = require('../utils/searchIndexing');

// Every 6 hours: midnight, 6am, noon, 6pm UTC
const SCHEDULE = '0 0,6,12,18 * * *';

let running = false;

async function runImport() {
  if (running) { console.log('[Import] Already in progress, skipping.'); return; }
  running = true;
  try {
    const col = mongoose.connection.collection('jobseeker.jobs');
    const cycleStart = new Date();

    console.log('[Import] Starting ATS import cycle...');
    // ATS-direct: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Jobvite
    try { await importAtsJobs(); } catch (e) { console.warn('[Import] ATS error:', e.message); }

    // Remotive + The Muse — runs every cycle, not just as a volume fallback.
    // Tech-company ATS boards rarely post writing/PR/social-media-marketing
    // roles, so this is the only source for those categories.
    try { await importRemoteJobs(); } catch (e) { console.warn('[Import] Remote jobs import error:', e.message); }

    // Tag recruiter jobs and purge stale ones before pairing
    try { await tagRecruiterJobs(); } catch (e) { console.warn('[Import] Recruiter tag error:', e.message); }

    // Capture jobs about to be purged so we can notify search engines of their removal
    try {
      const expiredJobs = await col.find(
        { datePosted: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        { projection: { _id: 1, title: 1, company: 1 } }
      ).toArray();
      await purgeJobs();
      if (expiredJobs.length) {
        notifyJobsRemoved(expiredJobs).catch(() => {});
        console.log(`[Import] Notified search engines of ${expiredJobs.length} removed jobs`);
      }
    } catch (e) { console.warn('[Import] Purge error:', e.message); }
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

    // Notify search engines of newly added jobs (fire-and-forget)
    try {
      const newJobs = await col.find(
        { createdAt: { $gte: cycleStart } },
        { projection: { _id: 1, title: 1, company: 1 } }
      ).toArray();
      if (newJobs.length) {
        notifyJobsAdded(newJobs).catch(() => {});
        console.log(`[Import] Notified search engines of ${newJobs.length} new jobs`);
      }
    } catch (e) { console.warn('[Import] Indexing notify error:', e.message); }

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

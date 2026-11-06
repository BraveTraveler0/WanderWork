const cron = require('node-cron');
const mongoose = require('mongoose');
const { importAtsJobs } = require('../scripts/importAtsJobs.cjs');
const { importRemoteJobs } = require('../scripts/importRemoteJobs.cjs');
const { cleanNewJobs } = require('../scripts/cleanJobDescriptions.cjs');
const { tagRecruiterJobs } = require('../scripts/tagRecruiterJobs.cjs');
const { purgeJobs } = require('../scripts/purgeJobs.cjs');
const { pairAllCandidates } = require('../services/jobPairingService');
const { notifyJobsAdded, notifyJobsRemoved } = require('../utils/searchIndexing');
const { acquireLock } = require('../utils/schedulerClaim');

// Every 6 hours: midnight, 6am, noon, 6pm UTC
const SCHEDULE = '0 0,6,12,18 * * *';

// Both production services run this schedule, and each also ran it at
// startup, so every cycle (and every deploy) imported, cleaned and AI-labeled
// the same jobs twice. One lock per cycle: the first instance to grab it runs,
// the other skips. It lasts 5h (cycles are 6h apart), so a deploy shortly
// after a cycle doesn't trigger another full run either. A crashed run's lock
// expires on its own.
const CYCLE_LOCK_MS = 5 * 60 * 60 * 1000;

let running = false;

async function runImport() {
  if (running) { console.log('[Import] Already in progress, skipping.'); return; }
  running = true;
  try {
    const won = await acquireLock('remote_jobs_import', CYCLE_LOCK_MS).catch((err) => {
      console.warn('[Import] Lock check failed, skipping this cycle:', err.message);
      return false;
    });
    if (!won) { console.log('[Import] Another instance ran this cycle (or one ran in the last 5h); skipping.'); return; }

    const col = mongoose.connection.collection('jobseeker.jobs');
    const cycleStart = new Date();

    console.log('[Import] Starting ATS import cycle...');
    // ATS-direct: Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Jobvite
    try {
      const ats = await importAtsJobs();
      if (ats?.removedJobs?.length) {
        notifyJobsRemoved(ats.removedJobs).catch(() => {});
        console.log(`[Import] Notified search engines of ${ats.removedJobs.length} closed jobs`);
      }
    } catch (e) { console.warn('[Import] ATS error:', e.message); }

    // Remotive + The Muse — runs every cycle, not just as a volume fallback.
    // Tech-company ATS boards rarely post writing/PR/social-media-marketing
    // roles, so this is the only source for those categories.
    try { await importRemoteJobs(); } catch (e) { console.warn('[Import] Remote jobs import error:', e.message); }

    // Tag recruiter jobs and purge stale ones before pairing
    try { await tagRecruiterJobs(); } catch (e) { console.warn('[Import] Recruiter tag error:', e.message); }

    // purgeJobs returns what it removed so search engines can drop those pages.
    // (The old pre-query filtered on `datePosted`, a field jobs don't have, so
    // it never found anything to report.)
    try {
      const purge = await purgeJobs();
      const expiredJobs = purge?.removed || [];
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

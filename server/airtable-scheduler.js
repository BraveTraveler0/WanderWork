/**
 * Airtable Scheduled Sync Service
 * Automatically syncs Airtable data to MongoDB on a schedule
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const connectDB = require('./config/dbConn');
const { sync, dedupeJobs, purgeOldJobs, expireOldApplications } = require('./airtable-sync');
const { syncRecruiters } = require('./services/recruiterSyncService');
const { runRecruiterApifyPipeline } = require('./services/apifyRecruiterService');
const { sendWeeklyTokenEmails } = require('./services/weeklyTokenService');
const { sendOperationalAlert } = require('./utils/operationalAlert');

let isRunning = false;
let lastSyncTime = null;
let lastSyncStatus = null;

async function checkMongoHealth() {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn(`[MongoHealth] Connection state ${mongoose.connection.readyState}; reconnecting...`);
      await connectDB();
      console.log('[MongoHealth] MongoDB connection restored.');
      return;
    }
    await mongoose.connection.db.admin().ping();
  } catch (error) {
    console.error('[MongoHealth] Health check failed; attempting recovery:', error.message);
    try {
      await mongoose.disconnect().catch(() => {});
      await connectDB();
      await sendOperationalAlert(
        'mongodb-recovered',
        'MongoDB connection recovered automatically',
        `The health check detected a connection failure and restored MongoDB.\n\nOriginal error: ${error.message}`
      );
    } catch (reconnectError) {
      await sendOperationalAlert(
        'mongodb-health',
        'MongoDB connection failed',
        `The automatic MongoDB health check could not recover.\n\n${reconnectError.stack || reconnectError.message}`
      );
    }
  }
}

/**
 * Run the sync
 */
async function runSync() {
  if (isRunning) {
    console.log('⏭️  Sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📅 Scheduled Airtable Sync - ${startTime.toISOString()}`);
    console.log(`${'='.repeat(60)}`);

    const results = await sync({ all: true });
    const failedSections = Object.entries(results || {})
      .filter(([key, value]) => key !== 'applicationLinks' && value === null)
      .map(([key]) => key);
    if (failedSections.length) {
      await sendOperationalAlert(
        'airtable-sync',
        'Scheduled data sync partially failed',
        `The following sync sections failed: ${failedSections.join(', ')}. Check Render logs for the upstream response.`
      );
    }
    if (process.env.ENABLE_AIRTABLE_RECRUITER_SYNC === 'true') {
      await syncRecruiters().catch((e) => console.warn('[RecruiterSync] Failed (non-fatal):', e.message));
    } else {
      console.log('[RecruiterSync] Airtable recruiter sync disabled; n8n should post recruiters to /sync/recruiters');
    }

    lastSyncTime = new Date();
    lastSyncStatus = 'success';

    console.log(`\n✅ Sync completed in ${Math.round((new Date() - startTime) / 1000)}s`);
    console.log(`Next sync: ${new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString()}`);

    // Pairing and job cleanup run in the six-hour ATS import and daily
    // maintenance jobs. Repeating full collection scans hourly was redundant.
  } catch (error) {
    lastSyncStatus = 'error';
    console.error(`❌ Sync failed: ${error.message}`);
    await sendOperationalAlert(
      'scheduled-sync',
      'Scheduled sync failed',
      error.stack || error.message
    );
  } finally {
    isRunning = false;
  }
}


/**
 * Run daily deduplication
 */
async function runDailyDedup() {
  if (isRunning) {
    console.log('??  Sync already in progress, skipping dedup...');
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`
${'='.repeat(60)}`);
    console.log(`?? Daily Job Dedup - ${startTime.toISOString()}`);
    console.log(`${'='.repeat(60)}`);

    await dedupeJobs();
    await purgeOldJobs(60);
    await expireOldApplications(30);

    lastSyncTime = new Date();
    lastSyncStatus = 'success';

    console.log(`
? Dedup completed in ${Math.round((new Date() - startTime) / 1000)}s`);
  } catch (error) {
    lastSyncStatus = 'error';
    console.error(`? Dedup failed: ${error.message}`);
  } finally {
    isRunning = false;
  }
}

let isRecruiterApifyRunning = false;

/**
 * Monthly recruiter pull straight from the Apify actor task (replaces the n8n relay).
 */
async function runRecruiterApifySync() {
  if (isRecruiterApifyRunning) {
    console.log('⏭️  Recruiter Apify sync already in progress, skipping...');
    return;
  }

  isRecruiterApifyRunning = true;
  const startTime = new Date();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📅 Monthly Recruiter Apify Sync - ${startTime.toISOString()}`);
    console.log(`${'='.repeat(60)}`);

    const result = await runRecruiterApifyPipeline();
    console.log(`✅ Recruiter Apify sync completed in ${Math.round((new Date() - startTime) / 1000)}s`, result);
  } catch (error) {
    console.error(`❌ Recruiter Apify sync failed: ${error.message}`);
    await sendOperationalAlert(
      'recruiter-apify-sync',
      'Monthly recruiter import failed',
      error.stack || error.message
    );
  } finally {
    isRecruiterApifyRunning = false;
  }
}

function isElevenAmEastern() {
  const etHour = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  ).getHours();
  return etHour === 11;
}

/**
 * Initialize maintenance schedules. MongoDB and the direct job-source
 * pipelines are authoritative, so the legacy full Airtable import is disabled.
 */
function initScheduledSync() {
  console.log('\n🕐 Initializing maintenance schedules...');
  console.log('   Legacy hourly Airtable import: disabled');
  console.log('   Recruiter Apify import: monthly (first day at 06:00 UTC)');


  // Run daily dedup at 2:30 AM server time
  const dedupTask = cron.schedule('30 2 * * *', () => {
    runDailyDedup();
  });

  // Keep the database connection healthy even when there is little web traffic.
  const mongoHealthTask = cron.schedule('*/5 * * * *', checkMongoHealth);

  // Weekly free token emails — every Thursday, fires at 15:00 and 16:00 UTC
  // to cover both EST (UTC-5) and EDT (UTC-4). Only executes when Eastern time = 11 AM.
  cron.schedule('0 15,16 * * 4', () => {
    if (!isElevenAmEastern()) return;
    console.log('[WeeklyToken] Thursday 11 AM EST triggered — sending free token emails...');
    sendWeeklyTokenEmails().catch((e) => console.error('[WeeklyToken] Cron failed:', e.message));
  });

  // Monthly recruiter pull from Apify — first day of the month at 6:00 AM UTC.
  const recruiterApifyTask = cron.schedule('0 6 1 * *', () => {
    runRecruiterApifySync();
  });

console.log('✅ Maintenance schedules initialized\n');

  return { dedup: dedupTask, recruiterApify: recruiterApifyTask, mongoHealth: mongoHealthTask };
}

/**
 * Get sync status
 */
function getSyncStatus() {
  return {
    isRunning,
    lastSyncTime,
    lastSyncStatus,
    airtableScheduledSync: 'disabled',
    recruiterApifySchedule: '0 6 1 * *',
  };
}

/**
 * Manually trigger a sync (useful for testing or immediate needs)
 */
async function triggerSync() {
  console.log('\n🔄 Manual sync triggered...');
  return runSync();
}

module.exports = {
  initScheduledSync,
  getSyncStatus,
  triggerSync,
  runSync,
  runDailyDedup,
  runRecruiterApifySync,
  checkMongoHealth,
};

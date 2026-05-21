/**
 * Airtable Scheduled Sync Service
 * Automatically syncs Airtable data to MongoDB on a schedule
 */

const cron = require('node-cron');
const { sync, dedupeJobs, purgeOldJobs, expireOldApplications } = require('./airtable-sync');

let isRunning = false;
let lastSyncTime = null;
let lastSyncStatus = null;

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
    await dedupeJobs();
    await purgeOldJobs(60);
    await expireOldApplications(30);

    lastSyncTime = new Date();
    lastSyncStatus = 'success';

    console.log(`\n✅ Sync completed in ${Math.round((new Date() - startTime) / 1000)}s`);
    console.log(`Next sync: ${new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString()}`);
  } catch (error) {
    lastSyncStatus = 'error';
    console.error(`❌ Sync failed: ${error.message}`);
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

/**
 * Initialize scheduled sync
 * Runs at the top of every hour (00 minutes)
 */
function initScheduledSync() {
  console.log('\n🕐 Initializing Airtable scheduled sync...');
  console.log('   Schedule: Every hour (at :00)');
  console.log('   Format: 0 * * * * (cron notation)');

  // Run at minute 0 of every hour
  const task = cron.schedule('0 * * * *', () => {
    runSync();
  });

  
  // Run daily dedup at 2:30 AM server time
  const dedupTask = cron.schedule('30 2 * * *', () => {
    runDailyDedup();
  });

console.log('✅ Scheduled sync initialized\n');

  return { sync: task, dedup: dedupTask };
}

/**
 * Get sync status
 */
function getSyncStatus() {
  return {
    isRunning,
    lastSyncTime,
    lastSyncStatus,
    nextSync: new Date(Math.ceil(Date.now() / 3600000) * 3600000).toISOString(),
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
};

#!/usr/bin/env node
/**
 * Manual Airtable Sync Trigger
 * Run this to immediately sync jobs from Airtable
 */

require('dotenv').config();
const { syncAllJobSeekerData } = require('./airtable-sync');

async function main() {
  console.log('\n🔄 Starting manual Airtable sync...\n');
  
  try {
    const result = await syncAllJobSeekerData();
    
    console.log('\n✅ Sync completed successfully!');
    console.log('📊 Results:');
    console.log(`  Jobs synced: ${result.jobsCount || 0}`);
    console.log(`  Candidates synced: ${result.candidatesCount || 0}`);
    console.log(`  Applications synced: ${result.applicationsCount || 0}`);
    console.log(`  Contacts synced: ${result.contactsCount || 0}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();

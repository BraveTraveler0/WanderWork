// Pulls recruiter leads from the "RecruiterSearchII" Apify actor task and upserts them
// into MongoDB directly, bypassing the n8n -> Airtable relay.
// Run standalone: node server/scripts/recruiterApifyPipeline.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { runRecruiterApifyPipeline } = require('../services/apifyRecruiterService');

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log('[RecruiterApify] Connected to MongoDB');
  try {
    const result = await runRecruiterApifyPipeline(process.env.RECRUITER_APIFY_RESUME_RUN_ID);
    console.log('[RecruiterApify] Result:', result);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

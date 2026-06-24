// One-off/rerunnable cleanup: re-checks existing pending grants against the geo
// eligibility rules in server/config/capitalWatchGeo.js and rejects any that are
// out-of-region (e.g. "XTC India 2026") so they stop cluttering the dashboard.
// Marks them rejected (not deleted) so the decision is easy to undo if needed.
// Run: node server/scripts/capitalWatchGeoCleanup.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Grant = require('../models/CapitalWatch/capitalWatch.Grant');
const { isEligibleLocation } = require('../config/capitalWatchGeo');

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log('[CapitalWatch] Connected to MongoDB');

  const pending = await Grant.find({ status: 'pending' });
  const toReject = pending.filter((g) => !isEligibleLocation(g));

  for (const grant of toReject) {
    grant.status = 'rejected';
    await grant.save();
    console.log(`[CapitalWatch] Rejected (out of region): "${grant.title}", location: ${grant.location || 'n/a'}`);
  }

  console.log(`[CapitalWatch] Done. Checked ${pending.length} pending grant(s), rejected ${toReject.length}.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });

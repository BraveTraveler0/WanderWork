// One-off, safe to re-run: puts the outreach email of every applied (approved)
// opportunity whose deadline hasn't passed into the Outbox as a draft for review.
// Approvals made before the Outbox existed only emailed the draft to the team.
// Skips any opportunity that already has an Outbox email. Sends nothing.
// Run: node server/scripts/capitalWatchBackfillOutbox.cjs [--dry-run]
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Grant = require('../models/CapitalWatch/capitalWatch.Grant');
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail');
const { getCompanyProfile } = require('../config/capitalWatchCompanies');
const { expirePastDue } = require('../schedules/capitalWatchDeadlines');

const dryRun = process.argv.includes('--dry-run');
const EM_DASH_RE = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, 'g');

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  const today = new Date().toISOString().slice(0, 10);

  if (!dryRun) await expirePastDue();

  const approved = await Grant.find({ status: 'approved', outreachEmail: { $nin: [null, ''] } }).lean();
  const already = new Set((await OutboundEmail.find({ grant: { $in: approved.map((g) => g._id) } }, { grant: 1 }).lean()).map((e) => String(e.grant)));

  let created = 0;
  for (const g of approved) {
    const open = g.rolling || !g.dueDate || g.dueDate >= today;
    if (!open || already.has(String(g._id))) continue;
    const company = getCompanyProfile(g.company);
    const draft = {
      grant: g._id,
      grantTitle: g.title,
      company: company?.id,
      to: g.contactEmail || '',
      subject: `${company?.name || 'Inquiry'}: ${g.title}`.slice(0, 300),
      body: g.outreachEmail.replace(EM_DASH_RE, ', '),
      source: 'approval',
    };
    console.log(`${dryRun ? '[dry run] ' : ''}${g.title} (${g.rolling ? 'rolling' : g.dueDate || 'no deadline'})`);
    if (!dryRun) await OutboundEmail.create(draft);
    created++;
  }
  console.log(`${dryRun ? 'Would create' : 'Created'} ${created} draft(s); ${already.size} already had one.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });

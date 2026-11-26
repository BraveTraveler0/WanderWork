// One-time move from the single-team Capital Watch to accounts and business profiles.
// Safe to re-run: everything it creates is looked up first.
//  1. Admin accounts for the team emails.
//  2. Aonverse and Wanderwork as editable business profiles shared by the team.
//  3. Every approved / archived / rejected opportunity becomes a decision for the
//     right business (drafts included), and the opportunity goes back to "open".
//  4. Outbox drafts are attached to their business.
// Run: node server/scripts/capitalWatchMigrateToAccounts.cjs [--dry-run]
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Grant = require('../models/CapitalWatch/capitalWatch.Grant');
const Member = require('../models/CapitalWatch/capitalWatch.Member');
const Business = require('../models/CapitalWatch/capitalWatch.Business');
const Decision = require('../models/CapitalWatch/capitalWatch.Decision');
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail');
const { ADMIN_EMAILS } = require('../config/capitalWatchTeam');

const dryRun = process.argv.includes('--dry-run');
const log = (...a) => console.log(dryRun ? '[dry run]' : '', ...a);

// The team's two companies, split from the old one-paragraph profiles into fields.
const SHARED = {
  country: 'United States', state: 'Georgia', city: 'Atlanta', entityType: 'for_profit',
  founderDemographics: ['black', 'veteran'],
  seeking: ['grant', 'investment', 'competition', 'accelerator', 'fellowship'],
  // The old ranking pushed these to the bottom; now they're simply hidden.
  ignoreKeywords: ['housing', 'real estate', 'mortgage', 'homeowner', 'rental assistance', 'food truck', 'equipment financing', 'vehicle financing'],
};
const COMPANIES = [
  {
    legacyId: 'aonverse',
    name: 'Aonverse',
    description: 'Aonverse is a creator-first social marketplace blending short-form content, direct commerce, and digital goods, with a playful, customizable, gaming-inspired feel. The idea comes from firsthand exposure to platform risk for creators, highlighted by the TikTok ban scare: temporary reversals do not remove structural risk.',
    founders: 'Founder and CEO: Darrien Carter, who has worked with Fortune 500 companies including Coca-Cola, Mitsubishi, and Delta. Lean team with an experienced CTO and a retired Air Force veteran COO.',
    highlights: 'Beta is live; team and user base doubled in Q4 2024; hosted a 400+ attendee creative mixer with 50+ influencers and vendors; Georgia Tech graduate program partnership for a Web3 marketplace; graduated from Square One Startup School; Atlanta-based, clean cap table, founder-led execution.',
    industries: ['media', 'ecommerce', 'gaming'],
    stage: 'early_revenue',
  },
  {
    legacyId: 'wanderwork',
    name: 'Wanderwork',
    description: 'Wanderwork is an AI-powered remote job search platform that helps job seekers find and land remote roles faster. It aggregates remote job listings, uses AI to tailor resumes and cover letters per job, automates recruiter outreach with AI-drafted emails, and matches candidates to jobs with a scoring engine.',
    founders: 'Founder: Darrien Carter.',
    highlights: 'Serves job seekers directly through Pro and Premium subscription tiers, with growing weekly active users and recruiter contact volume. Atlanta-based, founder-led execution.',
    industries: ['software', 'ai', 'workforce'],
    stage: 'early_revenue',
  },
];

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  // The unique (business, grant) index must exist before decisions are written.
  if (!dryRun) await Decision.syncIndexes();

  // 1. Admin accounts.
  const admins = [];
  for (const email of ADMIN_EMAILS) {
    let m = await Member.findOne({ email });
    if (!m) {
      log('create admin', email);
      if (!dryRun) m = await Member.create({ email, name: email.startsWith('darrien') ? 'Darrien Carter' : '', role: 'admin', marketingConsent: true, marketingConsentAt: new Date() });
    } else if (m.role !== 'admin' && !dryRun) {
      await Member.updateOne({ _id: m._id }, { $set: { role: 'admin' } });
    }
    if (m) admins.push(m);
  }

  // 2. Business profiles.
  const byLegacyId = {};
  for (const c of COMPANIES) {
    const { legacyId, ...fields } = c;
    let b = await Business.findOne({ name: c.name, memberIds: { $in: admins.map((a) => a._id) } });
    if (!b) {
      log('create business', c.name);
      if (!dryRun) b = await Business.create({ ...SHARED, ...fields, memberIds: admins.map((a) => a._id) });
    } else if (!dryRun) {
      await Business.updateOne({ _id: b._id }, { $addToSet: { memberIds: { $each: admins.map((a) => a._id) } } });
    }
    byLegacyId[legacyId] = b;
  }
  const allBusinesses = Object.values(byLegacyId).filter(Boolean);

  // 3. Decisions.
  const legacy = await Grant.find({ status: { $in: ['approved', 'archived', 'rejected'] } }).lean();
  let created = 0;
  for (const g of legacy) {
    const targets = g.status === 'approved' ? [byLegacyId[g.company] || allBusinesses[0]] : allBusinesses;
    for (const b of targets.filter(Boolean)) {
      if (await Decision.exists({ business: b._id, grant: g._id })) continue;
      created++;
      if (!dryRun) {
        await Decision.create({
          business: b._id,
          grant: g._id,
          decidedBy: admins[0]?._id,
          status: g.status,
          ...(g.status === 'approved' ? {
            outreachEmail: g.outreachEmail,
            applicationNarrative: g.applicationNarrative,
            requirementsChecklist: (g.requirementsChecklist || []).map(({ requirement, status, detail }) => ({ requirement, status, detail })),
            deadlineAlertsSent: g.deadlineAlertsSent || [],
          } : {}),
        });
      }
    }
  }
  log(`decisions created: ${created} from ${legacy.length} decided opportunities`);
  if (!dryRun && legacy.length) {
    const r = await Grant.updateMany({ _id: { $in: legacy.map((g) => g._id) } }, { $set: { status: 'pending' } });
    log(`opportunities reopened for matching: ${r.modifiedCount}`);
  }

  // 4. Outbox drafts.
  const loose = await OutboundEmail.find({ business: { $exists: false } }).lean();
  for (const e of loose) {
    const grant = e.grant ? await Grant.findById(e.grant).select('company').lean() : null;
    const b = byLegacyId[e.company] || byLegacyId[grant?.company] || allBusinesses[0];
    if (b && !dryRun) await OutboundEmail.updateOne({ _id: e._id }, { $set: { business: b._id, createdBy: admins[0]?._id } });
  }
  log(`outbox emails attached: ${loose.length}`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });

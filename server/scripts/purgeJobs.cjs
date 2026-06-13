'use strict';
/**
 * purgeJobs.cjs — Remove low-quality jobs, keep autofill-ready, recruiter-linked listings.
 *
 * Quality tiers (highest first):
 *   1. Company has recruiter in our DB                     (+5)
 *   2. ats_direct (Greenhouse/Lever/Ashby/SmartRecruiters) (+4)
 *   3. Direct ATS-style apply_url                          (+3)
 *   4. Description cleaned + substantial                   (+2-3)
 *   5. Recent (< 30d)                                       (+1-3)
 *   6. company_url resolved                                (+1)
 *
 * Hard removes (always deleted):
 *   - No title
 *   - LinkedIn jobs
 *   - German (lang: 'de')
 *   - Aggregator-only (Jobicy/RemoteOK URL and no direct apply_url)
 *   - No URL at all
 *   - Stale > 90 days
 *   - Empty description (no description_short AND no description)
 *
 * After hard removes, any job scoring <= LOW_SCORE_THRESHOLD is also removed.
 * If that's still fewer than MIN_PURGE, lowest-scoring jobs fill the gap up to MIN_PURGE.
 *
 * Run:  node server/scripts/purgeJobs.cjs --dry-run   (show what would be removed)
 *       node server/scripts/purgeJobs.cjs              (actually delete)
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const LOW_SCORE_THRESHOLD = 2; // score ≤ this → soft remove
const MIN_PURGE = 0;           // never forced to remove beyond hard+low-score

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGGREGATOR_HOSTS = [
  'jobicy.com', 'remoteok.com', 'arbeitnow.com', 'workingnomads.com',
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
  'simplyhired.com', 'careerjet.com', 'jooble.org', 'trovit.com',
];

const ATS_HOSTS = [
  'greenhouse.io', 'lever.co', 'ashbyhq.com', 'smartrecruiters.com',
  'workable.com', 'bamboohr.com', 'jobvite.com', 'icims.com',
  'taleo.net', 'successfactors.com', 'myworkdayjobs.com',
];

function isAggregatorUrl(url) {
  if (!url) return false;
  try {
    const h = new URL(String(url)).hostname.replace(/^www\./, '');
    return AGGREGATOR_HOSTS.some(a => h === a || h.endsWith('.' + a));
  } catch {
    return AGGREGATOR_HOSTS.some(a => String(url).includes(a));
  }
}

function isAtsUrl(url) {
  if (!url) return false;
  return ATS_HOSTS.some(a => String(url).includes(a));
}

function normalizeCompany(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|technologies|solutions|group|holdings)\b\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreJob(job, recruiterCompanySet) {
  let score = 0;

  // 1. Recruiter linkable — same company exists in our recruiter DB
  const normComp = normalizeCompany(job.company);
  if (normComp && recruiterCompanySet.has(normComp)) score += 5;

  // 2. ATS direct
  if (job.ats_direct) score += 4;
  else if (isAtsUrl(job.apply_url) || isAtsUrl(job.url)) score += 3;

  // 3. Direct non-aggregator apply URL
  const applyUrl = String(job.apply_url || '');
  if (applyUrl && !isAggregatorUrl(applyUrl)) score += 2;

  // 4. Description quality
  if (job.desc_cleaned) score += 2;
  const descLen = String(job.description_short || '').length;
  if (descLen > 250) score += 2;
  else if (descLen > 100) score += 1;

  // 5. Company URL resolved
  if (job.company_url) score += 1;

  // 6. Recency
  if (job.date_posted) {
    const ageDays = (Date.now() - new Date(job.date_posted).getTime()) / 86400000;
    if (ageDays <= 7) score += 3;
    else if (ageDays <= 14) score += 2;
    else if (ageDays <= 30) score += 1;
  }

  return score;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function purgeJobs() {
  const col = mongoose.connection.collection('jobseeker.jobs');
  const recruiterCol = mongoose.connection.collection('jobseeker.recruiters');

  // Build set of normalized company names from recruiter DB
  const recruiters = await recruiterCol.find({}, { projection: { company: 1 } }).toArray();
  const recruiterCompanySet = new Set(
    recruiters.map(r => normalizeCompany(r.company)).filter(Boolean)
  );
  console.log(`[purge] Recruiter companies in DB: ${recruiterCompanySet.size}`);

  const total = await col.countDocuments({});
  console.log(`[purge] Total jobs in DB: ${total}`);

  // Load all jobs (we need to score them all)
  const allJobs = await col.find({}).toArray();

  // ── Phase 1: Hard removes ──────────────────────────────────────────────────
  const hardRemoveIds = [];
  const reasons = {};

  function recordHard(id, reason) {
    hardRemoveIds.push(id);
    reasons[reason] = (reasons[reason] || 0) + 1;
  }

  for (const job of allJobs) {
    const url      = String(job.url || '');
    const applyUrl = String(job.apply_url || '');
    const title    = String(job.title || job.job_title || '').trim();
    const desc     = String(job.description_short || job.description || '').trim();
    const lang     = job.lang;
    const source   = String(job.source || '').toLowerCase();

    if (!title) {
      recordHard(job._id, 'no_title'); continue;
    }
    if (/linkedin\.com/i.test(url) || /linkedin\.com/i.test(applyUrl)) {
      recordHard(job._id, 'linkedin'); continue;
    }
    if (lang === 'de') {
      recordHard(job._id, 'german'); continue;
    }
    // Aggregator-only: primary URL is aggregator AND no usable direct apply_url
    if (isAggregatorUrl(url) && (!applyUrl || isAggregatorUrl(applyUrl))) {
      // Exception: if we have company_url we can still redirect there
      if (!job.company_url) {
        recordHard(job._id, 'aggregator_no_escape'); continue;
      }
    }
    if (!url && !applyUrl) {
      recordHard(job._id, 'no_url'); continue;
    }
    if (!desc) {
      recordHard(job._id, 'no_description'); continue;
    }
    if (job.date_posted) {
      const ageDays = (Date.now() - new Date(job.date_posted).getTime()) / 86400000;
      if (ageDays > 90) {
        recordHard(job._id, 'stale_90d'); continue;
      }
    }
  }

  console.log(`\n[purge] Phase 1 — Hard removes: ${hardRemoveIds.length}`);
  const hardSet = new Set(hardRemoveIds.map(id => id.toString()));
  for (const [r, c] of Object.entries(reasons).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${r}: ${c}`);
  }

  // ── Phase 2: Score remaining ───────────────────────────────────────────────
  const remaining = allJobs.filter(j => !hardSet.has(j._id.toString()));
  const scored = remaining
    .map(j => ({
      _id: j._id,
      title: String(j.title || '').slice(0, 60),
      company: String(j.company || ''),
      source: String(j.source || ''),
      ats_direct: !!j.ats_direct,
      desc_len: String(j.description_short || '').length,
      score: scoreJob(j, recruiterCompanySet),
    }))
    .sort((a, b) => a.score - b.score);

  // Score distribution
  const dist = {};
  for (const j of scored) dist[j.score] = (dist[j.score] || 0) + 1;
  console.log(`\n[purge] Phase 2 — Score distribution of ${scored.length} remaining jobs:`);
  for (const [s, c] of Object.entries(dist).sort((a,b) => +a[0] - +b[0])) {
    console.log(`  score ${s}: ${c} jobs`);
  }

  // Low-score soft removes
  const softRemove = scored.filter(j => j.score <= LOW_SCORE_THRESHOLD);
  console.log(`\n[purge] Phase 2 — Low-quality removes (score ≤ ${LOW_SCORE_THRESHOLD}): ${softRemove.length}`);
  if (softRemove.length > 0) {
    console.log('  Worst 20:');
    softRemove.slice(0, 20).forEach(j =>
      console.log(`    [score ${j.score}] ${j.title} | ${j.company} | ${j.source} | desc:${j.desc_len}ch`)
    );
  }

  // Summary of what we're KEEPING
  const keepCount = scored.length - softRemove.length;
  const recruiterLinked = scored.filter(j => j.score >= 5 && !softRemove.includes(j)).length;
  const atsDirect = scored.filter(j => j.ats_direct && !softRemove.includes(j)).length;
  console.log(`\n[purge] Will keep ${keepCount} jobs:`);
  console.log(`  - Recruiter-company linked: ${recruiterLinked}`);
  console.log(`  - ATS-direct (autofill): ${atsDirect}`);
  console.log(`  - Other quality: ${keepCount - recruiterLinked - atsDirect}`);

  const totalRemoved = hardRemoveIds.length + softRemove.length;
  console.log(`\n[purge] Total to remove: ${totalRemoved} (hard: ${hardRemoveIds.length} + low-score: ${softRemove.length})`);
  console.log(`[purge] DB after purge: ${total - totalRemoved} jobs`);

  if (DRY_RUN) {
    console.log('\n[purge] DRY RUN — no changes made. Re-run without --dry-run to execute.');
    return;
  }

  // ── Execute deletes ────────────────────────────────────────────────────────
  let deleted = 0;
  if (hardRemoveIds.length > 0) {
    const r = await col.deleteMany({ _id: { $in: hardRemoveIds } });
    deleted += r.deletedCount;
    console.log(`[purge] Hard removes deleted: ${r.deletedCount}`);
  }
  if (softRemove.length > 0) {
    const softIds = softRemove.map(j => j._id);
    const r = await col.deleteMany({ _id: { $in: softIds } });
    deleted += r.deletedCount;
    console.log(`[purge] Soft removes deleted: ${r.deletedCount}`);
  }

  const finalCount = await col.countDocuments({});
  console.log(`\n[purge] Complete. Removed ${deleted} total. DB now has ${finalCount} jobs.`);
}

mongoose.connect(process.env.DATABASE_URI)
  .then(() => purgeJobs())
  .then(() => mongoose.disconnect())
  .catch(err => { console.error(err); process.exit(1); });

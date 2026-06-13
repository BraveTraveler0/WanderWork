'use strict';
/**
 * backfillCompanyUrls.cjs
 * Adds company_url to existing jobs that don't have one.
 * Uses Clearbit autocomplete (free, no auth) with GPT-4o-mini fallback.
 *
 * Run: node server/scripts/backfillCompanyUrls.cjs
 */
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { OpenAI } = require('openai');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clearbitLookup(name) {
  try {
    const res = await axios.get('https://autocomplete.clearbit.com/v1/companies/suggest', {
      params: { query: name },
      timeout: 6000,
    });
    const hits = Array.isArray(res.data) ? res.data : [];
    if (!hits.length) return null;
    // Best match: name similarity
    const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const best = hits.find(h => h.name?.toLowerCase().replace(/[^a-z0-9]/g, '').includes(nameLower.slice(0, 6)))
      || hits[0];
    return best?.domain ? `https://${best.domain}` : null;
  } catch { return null; }
}

async function gptBatchLookup(names) {
  if (!openai || !names.length) return {};
  try {
    const prompt = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [{
        role: 'system',
        content: 'Return a JSON object mapping each company name to its homepage URL (https://domain.com). If unknown, use null. Output JSON only, no markdown.',
      }, {
        role: 'user',
        content: `Give me the homepage URL for each company:\n${prompt}`,
      }],
    });
    const raw = res.choices?.[0]?.message?.content?.trim() || '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    // Map by position number
    const result = {};
    names.forEach((n, i) => {
      const val = parsed[String(i + 1)] || parsed[n] || null;
      if (val && val.startsWith('http')) result[n] = val;
    });
    return result;
  } catch { return {}; }
}

async function backfillCompanyUrls() {
  const col = mongoose.connection.collection('jobseeker.jobs');

  // Only process jobs that have a company name but no company_url
  const jobs = await col.find(
    { company_url: { $in: [null, '', undefined] }, company: { $exists: true, $nin: ['', null, 'Unknown'] } },
    { projection: { _id: 1, company: 1 } }
  ).toArray();

  if (!jobs.length) { console.log('[backfill] All jobs already have company_url.'); return; }
  console.log(`[backfill] ${jobs.length} jobs need company_url`);

  // Deduplicate: build map of company → [job _ids]
  const companyMap = new Map();
  for (const job of jobs) {
    const name = String(job.company || '').trim();
    if (!name || name === 'Unknown') continue;
    if (!companyMap.has(name)) companyMap.set(name, []);
    companyMap.get(name).push(job._id);
  }

  const companies = [...companyMap.keys()];
  console.log(`[backfill] ${companies.length} unique companies to resolve`);

  const resolved = new Map();
  const misses = [];

  // Phase 1: Clearbit (parallel, up to 10 at a time)
  const CLEARBIT_CONCURRENCY = 10;
  for (let i = 0; i < companies.length; i += CLEARBIT_CONCURRENCY) {
    const batch = companies.slice(i, i + CLEARBIT_CONCURRENCY);
    const results = await Promise.all(batch.map(async name => ({ name, url: await clearbitLookup(name) })));
    for (const { name, url } of results) {
      if (url) resolved.set(name, url);
      else misses.push(name);
    }
    if (i % 100 === 0) console.log(`[backfill] Clearbit: ${i}/${companies.length} (${resolved.size} found so far)`);
    await sleep(50);
  }
  console.log(`[backfill] Clearbit: ${resolved.size} found, ${misses.length} misses`);

  // Phase 2: GPT batch for misses (20 at a time to stay under token limits)
  if (misses.length > 0 && openai) {
    const GPT_BATCH = 20;
    for (let i = 0; i < misses.length; i += GPT_BATCH) {
      const batch = misses.slice(i, i + GPT_BATCH);
      const gptResult = await gptBatchLookup(batch);
      for (const [name, url] of Object.entries(gptResult)) {
        if (url) resolved.set(name, url);
      }
      if (i % 100 === 0) console.log(`[backfill] GPT: ${i}/${misses.length} processed`);
      await sleep(200);
    }
  }
  console.log(`[backfill] Total resolved: ${resolved.size}/${companies.length}`);

  // Phase 3: Write to DB (bulk)
  let updated = 0;
  const bulkOps = [];
  for (const [company, url] of resolved) {
    const ids = companyMap.get(company) || [];
    for (const id of ids) {
      bulkOps.push({ updateOne: { filter: { _id: id }, update: { $set: { company_url: url } } } });
    }
  }

  if (bulkOps.length > 0) {
    const WRITE_BATCH = 500;
    for (let i = 0; i < bulkOps.length; i += WRITE_BATCH) {
      const res = await col.bulkWrite(bulkOps.slice(i, i + WRITE_BATCH), { ordered: false });
      updated += res.modifiedCount;
    }
  }

  console.log(`[backfill] Done. Updated ${updated} jobs with company_url.`);
}

mongoose.connect(process.env.DATABASE_URI)
  .then(() => backfillCompanyUrls())
  .then(() => mongoose.disconnect())
  .catch(err => { console.error(err); process.exit(1); });

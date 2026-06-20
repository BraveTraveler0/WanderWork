// Scrapes funding-opportunity pages via the "capitalwatch" Apify actor task, extracts
// structured grant data with OpenAI, and saves new opportunities to MongoDB.
// Run standalone: node server/scripts/capitalWatchPipeline.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const OpenAI = require('openai');
const { ApifyClient } = require('apify-client');
const Grant = require('../models/CapitalWatch/capitalWatch.Grant');
const SOURCES = require('../config/capitalWatchSources');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_SYSTEM_PROMPT = `You are a funding opportunity extraction engine. You must ONLY use the provided input text as evidence. Do not invent, infer, or guess.

You must return ONLY valid JSON. No markdown. No explanations. No extra text.

Hard rules:

Every key must exist in the output.

If a value is not explicitly stated in the text, set it to null.

Never output sample, example, or placeholder content.

Never infer funding amounts, deadlines, agencies, or locations.

Dates must be explicitly stated and converted to YYYY-MM-DD. If uncertain, set due_date to null.

rolling is true ONLY if the text explicitly says rolling, ongoing, or no deadline.

link must equal the input url ONLY if a real funding opportunity exists. Otherwise null.

If no clear funding opportunity exists, title MUST be null and link MUST be null.

Allowed funding_type values only:
grant, loan, prize, contract, fellowship, stipend, scholarship, other

Extraction requirements:

title: exact opportunity name from the text

agency: exact organization name from the text

funding_type: based only on explicit wording

amount.value_usd: number only. If unclear or multiple ambiguous amounts, null

location: explicit geographic eligibility only

summary: 2 to 3 sentences strictly grounded in the text

why: 1 to 2 sentences explaining relevance based only on stated purpose or audience

requirements: explicit eligibility criteria or submission requirements/standards stated in the text (e.g. required documents, format, who may apply, how to submit). If not explicitly stated, null.

target_demographics: array of founder/owner eligibility groups EXPLICITLY stated in the text, using only these values: "women", "veteran", "military", "black", "african_american", "latino", "hispanic", "asian", "minority", "lgbtq", "disabled", "rural", "youth". If the text states no specific founder demographic restriction (open to all founders), return an empty array [].

Return EXACTLY this JSON shape and nothing else:

{
"title": null,
"agency": null,
"funding_type": null,
"amount": { "value_usd": null },
"due_date": null,
"rolling": false,
"location": null,
"link": null,
"summary": null,
"why": null,
"requirements": null,
"target_demographics": []
}`;

// This team is military/veteran and African American. Skip opportunities whose stated
// eligibility is exclusively for demographics the team doesn't qualify under — keep
// anything open to all founders, or that explicitly includes veteran/military/black/
// african_american/minority among its eligible groups.
const QUALIFYING_TAGS = ['veteran', 'military', 'black', 'african_american', 'minority'];

// Mirrors the Mongoose enum in capitalWatch.Grant.js — anything the model returns
// outside this list (it occasionally drifts from the prompt's allowed values)
// falls back to 'other' instead of throwing a validation error and dropping the item.
const ALLOWED_FUNDING_TYPES = ['grant', 'loan', 'prize', 'contract', 'fellowship', 'stipend', 'scholarship', 'other'];

function normalizeFundingType(fundingType) {
  return ALLOWED_FUNDING_TYPES.includes(fundingType) ? fundingType : 'other';
}

function isEligibleForTeam(targetDemographics) {
  if (!Array.isArray(targetDemographics) || targetDemographics.length === 0) return true;
  return targetDemographics.some((tag) => QUALIFYING_TAGS.includes(tag));
}

// gpt-4o-mini has a 128k-token context window; cap text well below that (~15k tokens)
// so a single huge scraped page can't blow the budget alongside the system prompt.
const MAX_TEXT_CHARS = 60000;

// Normalized forms used for duplicate detection — catches the same opportunity
// reappearing under a slightly different URL (trailing slash, www, query string)
// or being re-extracted with an identical title from a different page.
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')).toLowerCase();
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadExistingFingerprints() {
  const existing = await Grant.find({}, { link: 1, title: 1 }).lean();
  return {
    links: new Set(existing.map((g) => normalizeUrl(g.link))),
    titles: new Set(existing.map((g) => normalizeTitle(g.title))),
  };
}

// Rotates through capitalWatchSources.js in fixed-size batches instead of crawling
// every source every run, tracked in Mongo so it persists across deploys/restarts.
const ROTATION_BATCH_SIZE = 16;

async function getRotationBatch() {
  const col = mongoose.connection.collection('capitalwatch.state');
  const state = await col.findOne({ _id: 'rotation' });
  const startIndex = state?.batchIndex || 0;
  const batch = [];
  for (let i = 0; i < ROTATION_BATCH_SIZE; i++) {
    batch.push(SOURCES[(startIndex + i) % SOURCES.length]);
  }
  const nextIndex = (startIndex + ROTATION_BATCH_SIZE) % SOURCES.length;
  await col.updateOne(
    { _id: 'rotation' },
    { $set: { batchIndex: nextIndex, lastRunAt: new Date() } },
    { upsert: true }
  );
  return batch;
}

function normalizeItem(item) {
  return {
    url: item.url || '',
    text: (item.text || '').slice(0, MAX_TEXT_CHARS),
    title: item.title || '',
    agency: item.source || '',
    email: item.email || (item.emails && item.emails[0]) || '',
  };
}

async function extractOpportunity(item) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract funding opportunity information from the following webpage content.\n\nurl: ${item.url}\n\ntext:\n${item.text}\n\nIf there is no clear funding opportunity, return the null object exactly as specified.`,
      },
    ],
    temperature: 0.2,
  });

  const text = response.choices[0].message.content.trim();
  const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(json);

  if (!parsed.title || !parsed.link) return null;
  return parsed;
}

// Poll with plain GETs instead of the SDK's long-poll (waitForFinish=999999), which
// has been prone to "socket hang up" over long-running crawls on this connection.
async function waitForRun(client, runId) {
  for (;;) {
    const run = await client.run(runId).get();
    if (run.status !== 'RUNNING' && run.status !== 'READY') return run;
    await new Promise((r) => setTimeout(r, 15000));
  }
}

async function fetchDatasetItems(existingRunId) {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  let run;
  if (existingRunId) {
    console.log(`[CapitalWatch] Resuming existing run ${existingRunId}...`);
    run = await waitForRun(client, existingRunId);
  } else {
    const taskId = process.env.APIFY_CAPITALWATCH_TASK_ID;

    const batch = await getRotationBatch();
    console.log(`[CapitalWatch] Rotating to this run's ${batch.length} source(s): ${batch.join(', ')}`);
    const task = await client.task(taskId).get();
    task.input.startUrls = batch.map((url) => ({ url }));
    await client.task(taskId).update({ input: task.input });

    console.log('[CapitalWatch] Starting Apify actor task...');
    // start(input, options) -- timeout/memory belong in the second (options) argument,
    // not the first (input override). Passing them as a single object silently merged
    // them into the run's input instead of actually capping its timeout/memory.
    const started = await client.task(taskId).start(undefined, { timeout: 1800, memory: 4096 });
    run = await waitForRun(client, started.id);
  }

  // TIMED-OUT runs still finalize their dataset with whatever was scraped before the
  // cutoff — worth keeping since we already paid for that compute, rather than
  // discarding it. Only truly failed/aborted runs have nothing usable.
  if (run.status !== 'SUCCEEDED' && run.status !== 'TIMED-OUT') {
    throw new Error(`Apify run ended with status ${run.status}`);
  }
  if (run.status === 'TIMED-OUT') {
    console.log('[CapitalWatch] Run hit the timeout — using partial results scraped before the cutoff.');
  }

  console.log('[CapitalWatch] Fetching dataset items...');
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}

async function processDatasetItems(rawItems) {
  const result = { scraped: rawItems.length, inserted: 0, skippedDuplicates: 0, skippedIneligible: 0, errors: 0, newGrants: [] };
  console.log(`[CapitalWatch] Scraped ${rawItems.length} pages`);

  const seen = await loadExistingFingerprints();

  for (const raw of rawItems) {
    const item = normalizeItem(raw);
    if (!item.url) continue;

    try {
      if (seen.links.has(normalizeUrl(item.url))) { result.skippedDuplicates++; continue; }

      const parsed = await extractOpportunity(item);
      if (!parsed) continue;

      if (!isEligibleForTeam(parsed.target_demographics)) {
        result.skippedIneligible++;
        continue;
      }

      const linkNorm = normalizeUrl(parsed.link);
      const titleNorm = normalizeTitle(parsed.title);
      if (seen.links.has(linkNorm) || seen.titles.has(titleNorm)) {
        result.skippedDuplicates++;
        continue;
      }

      const grant = await Grant.create({
        title: parsed.title,
        agency: parsed.agency || item.agency || undefined,
        fundingType: normalizeFundingType(parsed.funding_type),
        amountUsd: parsed.amount?.value_usd ?? undefined,
        dueDate: parsed.due_date || undefined,
        rolling: !!parsed.rolling,
        location: parsed.location || undefined,
        link: parsed.link,
        summary: parsed.summary || undefined,
        why: parsed.why || undefined,
        requirements: parsed.requirements || undefined,
        targetDemographics: Array.isArray(parsed.target_demographics) ? parsed.target_demographics : [],
        contactEmail: item.email || undefined,
        hotLead: !!item.email,
        status: 'pending',
      });

      seen.links.add(linkNorm);
      seen.titles.add(titleNorm);
      result.inserted++;
      result.newGrants.push(grant);
    } catch (err) {
      console.error('[CapitalWatch] Item error:', err.message);
      result.errors++;
    }
  }

  console.log(`[CapitalWatch] Done. Inserted: ${result.inserted}, Duplicates skipped: ${result.skippedDuplicates}, Ineligible skipped: ${result.skippedIneligible}, Errors: ${result.errors}`);
  return result;
}

async function runCapitalWatchPipeline(existingRunId) {
  const rawItems = await fetchDatasetItems(existingRunId);
  return processDatasetItems(rawItems);
}

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log('[CapitalWatch] Connected to MongoDB');
  try {
    await runCapitalWatchPipeline(process.env.CAPITALWATCH_RESUME_RUN_ID);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { runCapitalWatchPipeline };

// Scrapes funding-opportunity pages via the "capitalwatch" Apify actor task, extracts
// structured grant data with AI, and saves new opportunities to MongoDB.
// Run standalone: node server/scripts/capitalWatchPipeline.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { ApifyClient } = require('apify-client');
const Grant = require('../models/CapitalWatch/capitalWatch.Grant');
const SeenPage = require('../models/CapitalWatch/capitalWatch.SeenPage');
const SOURCES = require('../config/capitalWatchSources');
const { DEMOGRAPHIC_IDS, INDUSTRY_IDS, STAGE_IDS, ENTITY_TYPE_IDS } = require('../config/capitalWatchOptions');

const { aiChatCheap: openai } = require('../utils/aiChat');

const EXTRACTION_SYSTEM_PROMPT = `You are a funding opportunity extraction engine. You must ONLY use the provided input text as evidence. Do not invent, infer, or guess.

You must return ONLY valid JSON. No markdown. No explanations. No extra text.

Hard rules:

Every key must exist in the output.

If a value is not explicitly stated in the text, set it to null.

Never output sample, example, or placeholder content.

Never infer funding amounts, deadlines, agencies, or locations.

Dates must be explicitly stated and converted to YYYY-MM-DD. If uncertain, set due_date to null.

rolling is true ONLY if the text explicitly says rolling, ongoing, or no deadline.

is_opportunity is true ONLY if the page describes one specific funding opportunity that applicants can apply to now or in the future (a grant, loan, prize, fellowship, investment program, accelerator, etc.). It is false for news about awards already given, lists or directories of many programs, general company pages, and closed programs.

If is_opportunity is false, title MUST be null.

Allowed funding_type values only:
grant, loan, prize, contract, fellowship, stipend, scholarship, other

Extraction requirements:

title: exact opportunity name from the text

agency: exact organization name from the text

funding_type: based only on explicit wording

amount.value_usd: a plain number in US dollars (no symbols, commas, or text). If unclear, not in USD, or multiple ambiguous amounts, null

location: explicit geographic eligibility only

summary: 2 to 3 sentences strictly grounded in the text

why: 1 to 2 sentences explaining relevance based only on stated purpose or audience

requirements: explicit eligibility criteria or submission requirements/standards stated in the text (e.g. required documents, format, who may apply, how to submit). If not explicitly stated, null.

contact_email: an email address written in the text for questions or applications about THIS opportunity (not a newsletter, privacy, or general support address). If none, null.

target_demographics: array of founder/owner groups the opportunity is EXCLUSIVELY for, as explicitly stated, using only these values: "women", "veteran", "black", "latino", "asian", "native", "minority", "lgbtq", "disabled", "immigrant", "youth", "rural", "low_income". If it is open to all founders (even if it says it "encourages" some groups), return [].

applicant_types: who may apply, only if explicitly stated, using only: "for_profit", "nonprofit", "sole_proprietor", "individual". If not stated, [].

eligible_countries: countries applicants must be in, only if explicitly stated (full English names, e.g. "United States"). "Worldwide" if explicitly open globally. If not stated, [].

industries: up to 3 industries the opportunity explicitly targets, using only: ${INDUSTRY_IDS.join(', ')}. If it is open to any industry, [].

stages: business stages explicitly required, using only: ${STAGE_IDS.join(', ')}. If not stated, [].

is_investment: true only if this is equity investment (angel, venture, seed fund) rather than a grant, loan, prize or program.

Do not use em dashes in any text field.

Return EXACTLY this JSON shape and nothing else:

{
"is_opportunity": false,
"title": null,
"agency": null,
"funding_type": null,
"amount": { "value_usd": null },
"due_date": null,
"rolling": false,
"location": null,
"summary": null,
"why": null,
"requirements": null,
"contact_email": null,
"target_demographics": [],
"applicant_types": [],
"eligible_countries": [],
"industries": [],
"stages": [],
"is_investment": false
}`;

// Everything is kept: opportunities are shared by every business on Capital Watch,
// and whether one fits a particular business is decided at match time
// (utils/capitalWatchMatching.js). Older synonyms are folded into the current ids.
const DEMOGRAPHIC_ALIASES = { african_american: 'black', hispanic: 'latino', military: 'veteran', indigenous: 'native' };
const DEMOGRAPHIC_TAGS = new Set([...DEMOGRAPHIC_IDS, 'minority']);
const pickAllowed = (value, allowed, max = 6) => [...new Set((Array.isArray(value) ? value : [])
  .map((v) => String(v).trim().toLowerCase()).filter((v) => allowed.includes(v)))].slice(0, max);
const countryList = (value) => [...new Set((Array.isArray(value) ? value : [])
  .map((v) => String(v).trim()).filter((v) => v.length >= 2 && v.length <= 60))].slice(0, 30);

// Mirrors the Mongoose enum in capitalWatch.Grant.js. Anything the model returns
// outside this list falls back to 'other' instead of failing validation.
const ALLOWED_FUNDING_TYPES = ['grant', 'loan', 'prize', 'contract', 'fellowship', 'stipend', 'scholarship', 'other'];

// Pages without any of these words can't be a funding opportunity, so they're skipped
// without an AI call.
const FUNDING_KEYWORDS_RE = /\b(grants?|funding|funded|fund|loans?|awards?|prizes?|fellowships?|scholarships?|stipends?|accelerator|incubator|investors?|investment|invest|seed|pitch|competition|challenge|apply|application|applications|rfp|solicitation|sbir|sttr)\b/i;

// Scraped pages are rarely longer than this (median ~2k chars); the cap only guards
// the AI bill against an occasional huge page.
const MAX_TEXT_CHARS = 20000;
const ROTATION_BATCH_SIZE = 16;
// Apify's own run timeout is 30 minutes; stop waiting a little after that.
const MAX_WAIT_MS = 45 * 60 * 1000;
const EM_DASH_RE = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, 'g');

const normalizeFundingType = (t) => (ALLOWED_FUNDING_TYPES.includes(t) ? t : 'other');
const cleanText = (v) => (typeof v === 'string' && v.trim() ? v.replace(EM_DASH_RE, ', ').trim() : undefined);

// Tracking parameters are dropped, but real query parameters (e.g. ?id=123) are kept,
// since two different opportunities can share a path.
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    }
    u.searchParams.sort();
    const query = u.searchParams.toString();
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + (query ? `?${query}` : '')).toLowerCase();
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

// Same title from the same organization = same opportunity. Title alone isn't enough:
// many agencies run a "Small Business Grant".
const fingerprint = (title, agency) =>
  `${String(title || '').trim().toLowerCase().replace(/\s+/g, ' ')}|${String(agency || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
  const n = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function parseDueDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? undefined : value;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IGNORED_EMAIL_RE = /^(no-?reply|donotreply|privacy|unsubscribe|webmaster|abuse|postmaster|newsletter|press|media|careers|jobs)@/i;

// The model's answer is only trusted if that address really appears on the page.
// Otherwise fall back to the one address on the page, if there is exactly one usable one.
function pickContactEmail(modelEmail, text) {
  const found = [...new Set((text.match(EMAIL_RE) || []).map((e) => e.toLowerCase()))]
    .filter((e) => !IGNORED_EMAIL_RE.test(e) && !/\.(png|jpe?g|gif|svg|webp)$/i.test(e));
  const claimed = String(modelEmail || '').trim().toLowerCase();
  if (claimed && found.includes(claimed)) return claimed;
  return found.length === 1 ? found[0] : undefined;
}

function normalizeItem(item) {
  let host = '';
  try { host = new URL(item.url).hostname.replace(/^www\./, ''); } catch { /* bad url */ }
  return {
    url: item.url || '',
    text: (item.text || '').slice(0, MAX_TEXT_CHARS),
    host,
  };
}

async function extractOpportunity(item) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    max_tokens: 900,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract funding opportunity information from the following webpage content.\n\nurl: ${item.url}\n\ntext:\n${item.text}\n\nIf there is no clear funding opportunity, return the null object exactly as specified.`,
      },
    ],
    temperature: 0.2,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  if (!parsed || parsed.is_opportunity === false || !parsed.title) return null;
  return parsed;
}

// The run being processed is saved, so if the server restarts mid-run (a deploy
// during the 30-minute crawl) the next attempt picks up the paid-for results instead
// of starting and paying for a new crawl.
const stateCol = () => mongoose.connection.collection('capitalwatch.state');

async function getRotationBatch() {
  const state = await stateCol().findOne({ _id: 'rotation' });
  const startIndex = state?.batchIndex || 0;
  const batch = [];
  for (let i = 0; i < ROTATION_BATCH_SIZE; i++) batch.push(SOURCES[(startIndex + i) % SOURCES.length]);
  await stateCol().updateOne(
    { _id: 'rotation' },
    { $set: { batchIndex: (startIndex + ROTATION_BATCH_SIZE) % SOURCES.length, lastRunAt: new Date() } },
    { upsert: true },
  );
  return batch;
}

// Poll with plain GETs instead of the SDK's long-poll, which has been prone to
// "socket hang up" over long-running crawls on this connection.
async function waitForRun(client, runId) {
  const started = Date.now();
  for (;;) {
    const run = await client.run(runId).get();
    if (run.status !== 'RUNNING' && run.status !== 'READY') return run;
    if (Date.now() - started > MAX_WAIT_MS) throw new Error(`Apify run ${runId} still ${run.status} after 45 minutes`);
    await new Promise((r) => setTimeout(r, 15000));
  }
}

async function fetchDatasetItems(existingRunId) {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const saved = await stateCol().findOne({ _id: 'rotation' });
  const resumeId = existingRunId || saved?.activeRunId;

  let run;
  if (resumeId) {
    console.log(`[CapitalWatch] Resuming run ${resumeId}...`);
    run = await waitForRun(client, resumeId);
  } else {
    const taskId = process.env.APIFY_CAPITALWATCH_TASK_ID;
    const batch = await getRotationBatch();
    console.log(`[CapitalWatch] Rotating to this run's ${batch.length} source(s): ${batch.join(', ')}`);
    // Passed as this run's input (Apify merges it over the task's saved input) instead
    // of rewriting the saved task, so two runs can't overwrite each other's start URLs.
    console.log('[CapitalWatch] Starting Apify actor task...');
    const started = await client.task(taskId).start({ startUrls: batch.map((url) => ({ url })) }, { timeout: 1800, memory: 4096 });
    await stateCol().updateOne({ _id: 'rotation' }, { $set: { activeRunId: started.id } }, { upsert: true });
    run = await waitForRun(client, started.id);
  }

  // TIMED-OUT runs still finalize their dataset with whatever was scraped before the
  // cutoff; that compute is already paid for. Only failed/aborted runs have nothing usable.
  if (run.status !== 'SUCCEEDED' && run.status !== 'TIMED-OUT') {
    await stateCol().updateOne({ _id: 'rotation' }, { $unset: { activeRunId: 1 } });
    throw new Error(`Apify run ended with status ${run.status}`);
  }
  if (run.status === 'TIMED-OUT') console.log('[CapitalWatch] Run hit the timeout; using partial results scraped before the cutoff.');

  // Only the fields the pipeline reads: skipping the HTML, Markdown and metadata copies
  // cuts the download to about a quarter.
  console.log('[CapitalWatch] Fetching dataset items...');
  const items = [];
  const dataset = client.dataset(run.defaultDatasetId);
  for (let offset = 0; ; offset += 250) {
    const page = await dataset.listItems({ offset, limit: 250, fields: ['url', 'text'] });
    items.push(...page.items);
    if (page.items.length < 250) break;
  }
  return { items, runId: run.id };
}

async function processDatasetItems(rawItems) {
  const result = { scraped: rawItems.length, inserted: 0, skippedSeen: 0, skippedNoKeywords: 0, skippedDuplicates: 0, skippedIneligible: 0, skippedLocation: 0, skippedPastDue: 0, aiCalls: 0, errors: 0, newGrants: [] };
  console.log(`[CapitalWatch] Scraped ${rawItems.length} pages`);

  const existing = await Grant.find({}, { link: 1, title: 1, agency: 1 }).lean();
  const links = new Set(existing.map((g) => normalizeUrl(g.link)));
  const prints = new Set(existing.map((g) => fingerprint(g.title, g.agency)));

  const items = rawItems.map(normalizeItem).filter((i) => i.url);
  const keys = [...new Set(items.map((i) => normalizeUrl(i.url)))];
  const seen = new Set((await SeenPage.find({ _id: { $in: keys } }, { _id: 1 }).lean()).map((s) => s._id));
  const handled = new Set();
  const remember = (key, outcome) => SeenPage.updateOne({ _id: key }, { $set: { outcome, checkedAt: new Date() } }, { upsert: true }).catch(() => {});

  for (const item of items) {
    const key = normalizeUrl(item.url);
    if (handled.has(key)) continue;
    handled.add(key);

    try {
      if (links.has(key)) { result.skippedDuplicates++; continue; }
      if (seen.has(key)) { result.skippedSeen++; continue; }
      if (!FUNDING_KEYWORDS_RE.test(item.text)) { result.skippedNoKeywords++; await remember(key, 'no_keywords'); continue; }

      result.aiCalls++;
      const parsed = await extractOpportunity(item);
      if (!parsed) { await remember(key, 'not_opportunity'); continue; }

      const tags = [...new Set((Array.isArray(parsed.target_demographics) ? parsed.target_demographics : [])
        .map((t) => String(t).toLowerCase()).map((t) => DEMOGRAPHIC_ALIASES[t] || t).filter((t) => DEMOGRAPHIC_TAGS.has(t)))];

      const dueDate = parseDueDate(parsed.due_date);
      const rolling = parsed.rolling === true;
      if (dueDate && !rolling && dueDate < todayKey()) { result.skippedPastDue++; await remember(key, 'past_due'); continue; }

      const agency = cleanText(parsed.agency) || item.host || undefined;
      const print = fingerprint(parsed.title, agency);
      if (prints.has(print)) { result.skippedDuplicates++; await remember(key, 'duplicate'); continue; }

      const contactEmail = pickContactEmail(parsed.contact_email, item.text);
      const grant = await Grant.create({
        title: cleanText(parsed.title),
        agency,
        fundingType: normalizeFundingType(parsed.funding_type),
        amountUsd: parseAmount(parsed.amount?.value_usd),
        dueDate,
        rolling,
        location: cleanText(parsed.location),
        // The page the text came from, never a link the model wrote.
        link: item.url,
        summary: cleanText(parsed.summary),
        why: cleanText(parsed.why),
        requirements: cleanText(parsed.requirements),
        targetDemographics: tags,
        applicantTypes: pickAllowed(parsed.applicant_types, ENTITY_TYPE_IDS),
        eligibleCountries: countryList(parsed.eligible_countries),
        industries: pickAllowed(parsed.industries, INDUSTRY_IDS, 3),
        stages: pickAllowed(parsed.stages, STAGE_IDS),
        isInvestment: parsed.is_investment === true,
        contactEmail,
        hotLead: Boolean(contactEmail),
        status: 'pending',
      });

      links.add(key);
      prints.add(print);
      await remember(key, 'inserted');
      result.inserted++;
      result.newGrants.push(grant);
    } catch (err) {
      // Not remembered, so a page that failed (AI outage, bad JSON) is retried next time.
      console.error('[CapitalWatch] Item error:', err.message);
      result.errors++;
    }
  }

  console.log(`[CapitalWatch] Done. Inserted: ${result.inserted}, AI calls: ${result.aiCalls}, Already checked: ${result.skippedSeen}, No funding words: ${result.skippedNoKeywords}, Duplicates: ${result.skippedDuplicates}, Ineligible: ${result.skippedIneligible}, Out of region: ${result.skippedLocation}, Past due: ${result.skippedPastDue}, Errors: ${result.errors}`);
  return result;
}

async function runCapitalWatchPipeline(existingRunId) {
  const { items, runId } = await fetchDatasetItems(existingRunId);
  const result = await processDatasetItems(items);
  // Processed: the next import starts a fresh crawl.
  await stateCol().updateOne({ _id: 'rotation', activeRunId: runId }, { $unset: { activeRunId: 1 } });
  return result;
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

module.exports = { runCapitalWatchPipeline, processDatasetItems, normalizeUrl, parseAmount, parseDueDate, pickContactEmail };

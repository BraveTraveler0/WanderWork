// Scrapes funding-opportunity pages via the "capitalwatch" Apify actor task, extracts
// structured grant data with OpenAI, and saves new opportunities to MongoDB.
// Run standalone: node server/scripts/capitalWatchPipeline.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const OpenAI = require('openai');
const { ApifyClient } = require('apify-client');
const Grant = require('../models/CapitalWatch/capitalWatch.Grant');

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
grant, loan, prize, contract, fellowship, stipend, other

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

function isEligibleForTeam(targetDemographics) {
  if (!Array.isArray(targetDemographics) || targetDemographics.length === 0) return true;
  return targetDemographics.some((tag) => QUALIFYING_TAGS.includes(tag));
}

// gpt-4o-mini has a 128k-token context window; cap text well below that (~15k tokens)
// so a single huge scraped page can't blow the budget alongside the system prompt.
const MAX_TEXT_CHARS = 60000;

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
    console.log('[CapitalWatch] Starting Apify actor task...');
    const started = await client.task(taskId).start({ timeout: 1800, memory: 4096 });
    run = await waitForRun(client, started.id);
  }

  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Apify run ended with status ${run.status}`);
  }

  console.log('[CapitalWatch] Fetching dataset items...');
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}

async function processDatasetItems(rawItems) {
  const result = { scraped: rawItems.length, inserted: 0, skippedDuplicates: 0, skippedIneligible: 0, errors: 0, newGrants: [] };
  console.log(`[CapitalWatch] Scraped ${rawItems.length} pages`);

  for (const raw of rawItems) {
    const item = normalizeItem(raw);
    if (!item.url) continue;

    try {
      const existing = await Grant.exists({ link: item.url });
      if (existing) { result.skippedDuplicates++; continue; }

      const parsed = await extractOpportunity(item);
      if (!parsed) continue;

      if (!isEligibleForTeam(parsed.target_demographics)) {
        result.skippedIneligible++;
        continue;
      }

      const alreadyHaveLink = await Grant.exists({ link: parsed.link });
      if (alreadyHaveLink) { result.skippedDuplicates++; continue; }

      const grant = await Grant.create({
        title: parsed.title,
        agency: parsed.agency || item.agency || undefined,
        fundingType: parsed.funding_type || 'other',
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

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
"requirements": null
}`;

function normalizeItem(item) {
  return {
    url: item.url || '',
    text: item.text || '',
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

async function fetchDatasetItems() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const taskId = process.env.APIFY_CAPITALWATCH_TASK_ID;

  console.log('[CapitalWatch] Running Apify actor task...');
  const run = await client.task(taskId).call({ timeout: 1200, memory: 2048 });

  console.log('[CapitalWatch] Fetching dataset items...');
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}

async function runCapitalWatchPipeline() {
  const result = { scraped: 0, inserted: 0, skippedDuplicates: 0, errors: 0, newGrants: [] };

  const rawItems = await fetchDatasetItems();
  result.scraped = rawItems.length;
  console.log(`[CapitalWatch] Scraped ${rawItems.length} pages`);

  for (const raw of rawItems) {
    const item = normalizeItem(raw);
    if (!item.url) continue;

    try {
      const existing = await Grant.exists({ link: item.url });
      if (existing) { result.skippedDuplicates++; continue; }

      const parsed = await extractOpportunity(item);
      if (!parsed) continue;

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

  console.log(`[CapitalWatch] Done. Inserted: ${result.inserted}, Duplicates skipped: ${result.skippedDuplicates}, Errors: ${result.errors}`);
  return result;
}

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log('[CapitalWatch] Connected to MongoDB');
  try {
    await runCapitalWatchPipeline();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { runCapitalWatchPipeline };

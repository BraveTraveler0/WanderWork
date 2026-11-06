'use strict';
// AI fallback for who-can-apply. jobSignals' regex labels most postings, but
// many just say "Remote" and state eligibility in prose the regex misses
// ("pay ranges for CA, NY and WA", "must hold UK right to work"). For those
// jobs only, the full posting text goes to the model once; the answer is
// stored on the job with a hash of the text (ai_regions / ai_region_hash) and
// reused every later import until the posting changes.
//
// The model can only answer with REGION_KEYS (the same labels the regex
// uses), and is told to return nothing when the posting does not say. An
// unknown job stays unknown rather than getting a guessed region.

const { chatCompletion, hasAIProvider } = require('./aiChat');
const { REGION_KEYS, scopeLabel } = require('./jobSignals');
const { textHash, normalizeUrl } = require('./jobUpsert');

const CONCURRENCY = 6;
const MIN_TEXT = 200;

const SYSTEM_PROMPT = `You read remote job postings and report where candidates are allowed to live or work from.
Return ONLY JSON: {"regions": [..], "worldwide": true|false, "evidence": "<exact quote>"}
- "regions" may only contain these exact values: ${REGION_KEYS.join(', ')}.
- Use a region only when the posting states or clearly implies the restriction: "must be based in", "open to candidates in", work authorization requirements, pay ranges listed only for specific US states or Canadian provinces, US-only benefits such as 401(k), or a location field like "Remote - UK".
- Prefer the most specific values the posting supports (e.g. "UK" rather than "Europe" when only the UK is named); list every region that is allowed.
- Office locations, company headquarters, sales territories, markets the team covers, or where customers are do NOT count as restrictions. "Grow revenue across MENA and Europe" says nothing about where the employee lives.
- When the location field names one country that is not in the list above (e.g. "Remote - UAE", "Remote, South Korea"), return {"regions": [], "worldwide": false}.
- "worldwide" is true only when the posting explicitly says candidates can be anywhere in the world. "Remote" alone does NOT mean worldwide.
- "evidence" must be a short quote (under 25 words) copied exactly from the posting or location field that supports your answer. If you cannot quote one, the answer is empty.
- If the posting does not say, return {"regions": [], "worldwide": false}. Never guess.`;

function needsInference(job) {
  return !(job.remote_regions || []).length
    && !job.remote_scope
    && String(job.desc_source || '').length >= MIN_TEXT;
}

function applyRegions(job, regions, worldwide) {
  job.remote_regions = regions;
  job.remote_scope = scopeLabel(regions, worldwide);
}

// The quote must really be in the posting: a label the model can't back with
// the posting's own words is a guess, and guesses are dropped.
const norm = (t) => String(t || '').toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const EXPLICIT_WORLDWIDE = /\b(?:worldwide|anywhere in the world|work from anywhere|from anywhere|any country|globally|global(?:ly)? remote|all countries)\b/i;

async function askModel(job) {
  const userPrompt = [
    `Title: ${job.title || ''}`,
    `Company: ${job.company || ''}`,
    `Location field: ${job.location || ''}`,
    '',
    String(job.desc_source).slice(0, 12000),
  ].join('\n');
  const data = await chatCompletion({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
    response_format: { type: 'json_object' },
    max_tokens: 120,
    temperature: 0,
  }, { timeout: 20000 });
  const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
  const allowed = new Set(REGION_KEYS);
  let regions = [...new Set((Array.isArray(parsed.regions) ? parsed.regions : []).filter((r) => allowed.has(r)))];
  let worldwide = !regions.length && parsed.worldwide === true;
  const quote = norm(parsed.evidence);
  const source = norm(`${job.location || ''} ${job.desc_source}`);
  const quoted = quote.length >= 8 && source.includes(quote);
  if (!quoted) { regions = []; worldwide = false; }
  if (worldwide && !EXPLICIT_WORLDWIDE.test(parsed.evidence || '')) worldwide = false;
  return { regions, worldwide };
}

// Mutates `jobs` in place, adding remote_regions/remote_scope (and the
// ai_* cache fields) to jobs the regex left unlabeled. At most `maxCalls`
// model calls per run; the rest are picked up on later imports.
async function inferMissingRegions(col, jobs, { maxCalls = 300 } = {}) {
  const stats = { candidates: 0, cached: 0, inferred: 0, labeled: 0, failed: 0, deferred: 0 };
  const pending = jobs.filter(needsInference);
  stats.candidates = pending.length;
  if (!pending.length) return stats;

  const urls = pending.map((j) => normalizeUrl(j.url));
  const stored = await col.find(
    { url_normalized: { $in: urls }, ai_region_hash: { $exists: true } },
    { projection: { url_normalized: 1, ai_regions: 1, ai_worldwide: 1, ai_region_hash: 1 } }
  ).toArray();
  const byUrl = new Map(stored.map((d) => [d.url_normalized, d]));

  const toAsk = [];
  for (const job of pending) {
    const hash = textHash(job.desc_source);
    const prev = byUrl.get(normalizeUrl(job.url));
    if (prev && prev.ai_region_hash === hash) {
      // Carry the stored answer forward so the upsert doesn't blank it.
      job.ai_regions = prev.ai_regions || [];
      job.ai_worldwide = !!prev.ai_worldwide;
      job.ai_region_hash = hash;
      applyRegions(job, job.ai_regions, job.ai_worldwide);
      stats.cached++;
    } else {
      toAsk.push({ job, hash });
    }
  }

  if (!hasAIProvider()) { stats.deferred = toAsk.length; return stats; }
  const batch = toAsk.slice(0, maxCalls);
  stats.deferred = toAsk.length - batch.length;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    await Promise.all(batch.slice(i, i + CONCURRENCY).map(async ({ job, hash }) => {
      try {
        const { regions, worldwide } = await askModel(job);
        job.ai_regions = regions;
        job.ai_worldwide = worldwide;
        job.ai_region_hash = hash;
        applyRegions(job, regions, worldwide);
        stats.inferred++;
        if (regions.length || worldwide) stats.labeled++;
      } catch (e) {
        // No hash stored, so this job is retried on the next import.
        stats.failed++;
      }
    }));
  }
  return stats;
}

module.exports = { inferMissingRegions, needsInference };

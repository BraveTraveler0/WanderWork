'use strict';
const crypto = require('crypto');

// Upsert used by every importer. Listing fields (title, location, salary,
// regions, last_seen_at...) refresh on every run, but the summary is only
// replaced when the posting text itself changed. Replacing it every run used
// to overwrite the AI-cleaned summary with raw text while desc_cleaned stayed
// true, so the cleanup never ran again. A changed posting now gets a new
// summary and is queued for cleanup (desc_cleaned: false).
//
// Written as an aggregation-pipeline update so one round trip can compare the
// stored hash. Every value is wrapped in $literal: a salary like "$120,000"
// would otherwise be read as a field path.

function textHash(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex').slice(0, 16);
}

function normalizeUrl(url) {
  return String(url || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
}

function jobUpsertPipeline(job, { urlNormalized, jobCode, now = new Date() }) {
  const { description_short: summary, desc_source: source, job_code: providedCode, ...fields } = job;
  const hash = textHash(source ?? summary);
  const lit = (v) => ({ $literal: v });
  const set = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) set[key] = lit(value);
  }
  const unchanged = { $eq: ['$desc_hash', hash] };
  Object.assign(set, {
    url_normalized: lit(urlNormalized),
    updatedAt: lit(now),
    last_seen_at: lit(now),
    createdAt: { $ifNull: ['$createdAt', lit(now)] },
    job_code: providedCode ? lit(providedCode) : { $ifNull: ['$job_code', lit(jobCode)] },
    cover_letter: { $ifNull: ['$cover_letter', ''] },
    description_short: { $cond: [unchanged, '$description_short', lit(summary)] },
    desc_cleaned: { $cond: [unchanged, { $ifNull: ['$desc_cleaned', false] }, false] },
    desc_hash: lit(hash),
  });
  return [{ $set: set }];
}

async function upsertJob(col, job, jobCode) {
  const urlNormalized = normalizeUrl(job.url);
  return col.updateOne(
    { url_normalized: urlNormalized },
    jobUpsertPipeline(job, { urlNormalized, jobCode }),
    { upsert: true }
  );
}

module.exports = { upsertJob, jobUpsertPipeline, normalizeUrl, textHash };

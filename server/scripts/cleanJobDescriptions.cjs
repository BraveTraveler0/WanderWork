'use strict';
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function callClaude(description) {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      messages: [{
        role: 'user',
        content: `Clean this job description excerpt. Remove section headers (like "Requirements:", "EDUCATIONAL/EXPERIENCE", "Job Summary:", "Qualifications:", "Responsibilities:", "Minimum Requirements:"), bullet markers, and any formatting labels. Keep all actual job content. Return only clean, readable prose. Return ONLY the cleaned text with no explanation.\n\n${description}`,
      }],
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return res.data?.content?.[0]?.text?.trim() || description;
}

async function cleanJob(col, job) {
  try {
    const cleaned = await callClaude(job.description_short);
    await col.updateOne(
      { _id: job._id },
      { $set: { description_short: cleaned, desc_cleaned: true } }
    );
    return true;
  } catch (err) {
    console.warn(`[CleanDesc] Failed ${job._id}: ${err.message}`);
    return false;
  }
}

// Called from the import cron after each run — cleans up to 200 newly added jobs
async function cleanNewJobs() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[CleanDesc] ANTHROPIC_API_KEY not set — skipping');
    return;
  }
  const col = mongoose.connection.collection('jobseeker.jobs');
  const jobs = await col
    .find({ desc_cleaned: { $ne: true }, description_short: { $exists: true, $ne: '' } })
    .limit(200)
    .toArray();

  if (jobs.length === 0) { console.log('[CleanDesc] All jobs already clean.'); return; }
  console.log(`[CleanDesc] Cleaning ${jobs.length} descriptions...`);

  let done = 0, errors = 0;
  const CONCURRENCY = 3;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(j => cleanJob(col, j)));
    results.forEach(ok => ok ? done++ : errors++);
    if (i + CONCURRENCY < jobs.length) await new Promise(r => setTimeout(r, 300));
  }
  console.log(`[CleanDesc] cleaned=${done} errors=${errors}`);
}

// Standalone one-time batch — no job cap, run from Render shell
async function cleanAllJobs() {
  const col = mongoose.connection.collection('jobseeker.jobs');
  const total = await col.countDocuments({ desc_cleaned: { $ne: true }, description_short: { $exists: true, $ne: '' } });
  console.log(`[CleanDesc] ${total} jobs to clean`);

  let done = 0, errors = 0;
  const CONCURRENCY = 3;
  let batch = [];
  const cursor = col.find({ desc_cleaned: { $ne: true }, description_short: { $exists: true, $ne: '' } });

  for await (const job of cursor) {
    batch.push(job);
    if (batch.length >= CONCURRENCY) {
      const results = await Promise.all(batch.map(j => cleanJob(col, j)));
      results.forEach(ok => ok ? done++ : errors++);
      if (done % 30 === 0) console.log(`[CleanDesc] ${done}/${total}...`);
      batch = [];
      await new Promise(r => setTimeout(r, 300));
    }
  }
  if (batch.length) {
    const results = await Promise.all(batch.map(j => cleanJob(col, j)));
    results.forEach(ok => ok ? done++ : errors++);
  }
  console.log(`[CleanDesc] Complete. cleaned=${done} errors=${errors}`);
}

if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
  mongoose.connect(process.env.DATABASE_URI)
    .then(() => cleanAllJobs())
    .then(() => { console.log('Done'); mongoose.disconnect(); })
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { cleanNewJobs };

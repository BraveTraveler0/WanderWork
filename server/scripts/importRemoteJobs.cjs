'use strict';
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function generateJobCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  return 'jb_' + (hash >>> 0).toString(36);
}

function truncateDesc(text) {
  if (!text) return '';
  const clean = stripHtml(text).trim();
  if (clean.length <= 500) return clean;
  const cut = clean.slice(0, 500);
  const lastSentence = cut.search(/[.!?][^.!?]*$/);
  return lastSentence > 100 ? cut.slice(0, lastSentence + 1) : cut;
}

function normalizeLocation(loc) {
  if (!loc) return 'Remote';
  const l = stripHtml(loc).trim();
  if (!l || /remote|worldwide|anywhere|global/i.test(l)) return 'Remote';
  return l.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
}

function get(url, opts = {}) {
  return axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'WanderWork/1.0 (wanderwork.io)' },
    ...opts,
  });
}

// ── Source fetchers ───────────────────────────────────────────────────────────

async function fetchRemotive() {
  const res = await get('https://remotive.com/api/remote-jobs', { params: { limit: 100 } });
  return (res.data?.jobs || []).map(j => ({
    title: stripHtml(j.title),
    company: stripHtml(j.company_name),
    url: j.url,
    salary: j.salary ? stripHtml(j.salary) : 'Not Listed',
    location: normalizeLocation(j.candidate_required_location),
    job_type: j.job_type || 'Full-time',
    date_posted: j.publication_date ? new Date(j.publication_date) : new Date(),
    description_short: truncateDesc(j.description),
    source: 'Remotive',
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 10) : [],
  }));
}

async function fetchJobicy() {
  const res = await get('https://jobicy.com/api/v2/remote-jobs', { params: { count: 50 } });
  return (res.data?.jobs || []).map(j => {
    const min = j.annualSalaryMin, max = j.annualSalaryMax, cur = j.salaryCurrency || 'USD';
    const salary = min && max ? `${cur} ${Number(min).toLocaleString()} - ${Number(max).toLocaleString()} / year`
      : min ? `${cur} ${Number(min).toLocaleString()}+ / year`
      : 'Not Listed';
    return {
      title: stripHtml(j.jobTitle),
      company: stripHtml(j.companyName),
      url: j.url,
      salary,
      location: normalizeLocation(j.jobGeo),
      job_type: j.jobType || 'Full-time',
      date_posted: j.pubDate ? new Date(j.pubDate) : new Date(),
      description_short: truncateDesc(j.jobDescription),
      source: 'Jobicy',
      tags: Array.isArray(j.jobIndustry) ? j.jobIndustry : [],
    };
  });
}

async function fetchRemoteOK() {
  const res = await get('https://remoteok.com/api');
  const raw = Array.isArray(res.data) ? res.data.slice(1) : [];
  return raw.map(j => {
    const salary = j.salary_min && j.salary_max
      ? `$${Number(j.salary_min).toLocaleString()} - $${Number(j.salary_max).toLocaleString()} / year`
      : j.salary_min ? `$${Number(j.salary_min).toLocaleString()}+ / year`
      : 'Not Listed';
    return {
      title: stripHtml(j.position),
      company: stripHtml(j.company),
      url: j.url || `https://remoteok.com/l/${j.slug}`,
      salary,
      location: 'Remote',
      job_type: 'Full-time',
      date_posted: j.epoch ? new Date(Number(j.epoch) * 1000) : new Date(),
      description_short: truncateDesc(j.description),
      source: 'RemoteOK',
      tags: Array.isArray(j.tags) ? j.tags.slice(0, 10) : [],
    };
  });
}

async function fetchArbeitnow() {
  const res = await get('https://www.arbeitnow.com/api/job-board-api');
  const jobs = (res.data?.data || []).filter(j => j.remote);
  return jobs.map(j => ({
    title: stripHtml(j.title),
    company: stripHtml(j.company_name),
    url: j.url,
    salary: 'Not Listed',
    location: 'Remote',
    job_type: Array.isArray(j.job_types) && j.job_types.length ? j.job_types.join(', ') : 'Full-time',
    date_posted: j.created_at ? new Date(Number(j.created_at) * 1000) : new Date(),
    description_short: truncateDesc(j.description),
    source: 'Arbeitnow',
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 10) : [],
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

const SOURCES = [
  { name: 'Remotive',  fetch: fetchRemotive  },
  { name: 'Jobicy',    fetch: fetchJobicy    },
  { name: 'RemoteOK',  fetch: fetchRemoteOK  },
  { name: 'Arbeitnow', fetch: fetchArbeitnow },
];

async function importRemoteJobs() {
  const col = mongoose.connection.collection('jobseeker.jobs');
  let totalUpserted = 0, totalUpdated = 0, totalSkipped = 0, totalErrors = 0;

  for (const src of SOURCES) {
    console.log(`[importRemoteJobs] Fetching ${src.name}...`);
    let jobs;
    try {
      jobs = await src.fetch();
      console.log(`[importRemoteJobs] ${src.name}: ${jobs.length} jobs`);
    } catch (err) {
      console.error(`[importRemoteJobs] ${src.name} failed:`, err.message);
      totalErrors++;
      continue;
    }

    let upserted = 0, updated = 0, skipped = 0, errors = 0;
    for (const job of jobs) {
      try {
        if (!job.title || !job.url) { skipped++; continue; }
        const urlNormalized = job.url.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
        const result = await col.updateOne(
          { url_normalized: urlNormalized },
          {
            $set: { ...job, url_normalized: urlNormalized, score: 0, cover_letter: '', updatedAt: new Date() },
            $setOnInsert: { job_code: generateJobCode(urlNormalized), createdAt: new Date() },
          },
          { upsert: true }
        );
        if (result.upsertedCount) upserted++;
        else updated++;
      } catch (err) {
        errors++;
      }
    }

    console.log(`[importRemoteJobs] ${src.name}: new=${upserted} updated=${updated} skipped=${skipped} errors=${errors}`);
    totalUpserted += upserted;
    totalUpdated += updated;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  console.log(`[importRemoteJobs] Total: new=${totalUpserted} updated=${totalUpdated} errors=${totalErrors}`);
  return { totalUpserted, totalUpdated, totalSkipped, totalErrors };
}

if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URI)
    .then(() => importRemoteJobs())
    .then(r => { console.log('Done', r); mongoose.disconnect(); })
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { importRemoteJobs };

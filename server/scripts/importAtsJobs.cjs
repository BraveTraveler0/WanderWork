'use strict';
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function get(url, opts = {}) {
  return axios.get(url, {
    timeout: 15000,
    headers: { 'User-Agent': 'WanderWork/1.0 (wanderwork.io)' },
    ...opts,
  });
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function truncateDesc(text) {
  if (!text) return '';
  const clean = stripHtml(text).trim();
  if (clean.length <= 500) return clean;
  const cut = clean.slice(0, 500);
  const last = cut.search(/[.!?][^.!?]*$/);
  return last > 100 ? cut.slice(0, last + 1) : cut;
}

function normalizeLocation(loc) {
  if (!loc) return 'Remote';
  const l = String(loc).trim();
  if (!l || /remote|worldwide|anywhere|global/i.test(l)) return 'Remote';
  return l;
}

function generateJobCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  return 'ats_' + (hash >>> 0).toString(36);
}

const REMOTE_RE = /remote|worldwide|anywhere|work.?from.?home|\bwfh\b/i;

// ── Slug discovery ────────────────────────────────────────────────────────────

const DISCOVER_RES = {
  greenhouse:       /boards\.greenhouse\.io\/([a-z0-9_-]+)/i,
  lever:            /jobs\.lever\.co\/([a-z0-9_-]+)/i,
  ashby:            /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i,
  smartrecruiters:  /jobs\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i,
};

async function discoverSlugs(col) {
  const slugs = { greenhouse: new Set(), lever: new Set(), ashby: new Set(), smartrecruiters: new Set() };

  const jobs = await col.find(
    { $or: [
      { apply_url: { $regex: 'greenhouse\\.io|lever\\.co|ashbyhq\\.com|smartrecruiters\\.com', $options: 'i' } },
      { url:       { $regex: 'greenhouse\\.io|lever\\.co|ashbyhq\\.com|smartrecruiters\\.com', $options: 'i' } },
    ]},
    { projection: { apply_url: 1, url: 1 } }
  ).toArray();

  for (const job of jobs) {
    const u = String(job.apply_url || job.url || '');
    for (const [ats, re] of Object.entries(DISCOVER_RES)) {
      const m = u.match(re);
      if (m?.[1]) slugs[ats].add(m[1].toLowerCase());
    }
  }

  return slugs;
}

async function resolveCompanyName(col, urlFragment, slug) {
  try {
    const existing = await col.findOne(
      { $or: [{ apply_url: { $regex: urlFragment, $options: 'i' } }, { url: { $regex: urlFragment, $options: 'i' } }] },
      { projection: { company: 1 } }
    );
    if (existing?.company && existing.company !== 'Unknown') return existing.company;
  } catch {}
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── ATS fetchers ──────────────────────────────────────────────────────────────

async function fetchGreenhouse(slug, company) {
  const res = await get(`https://boards.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  return (res.data?.jobs || [])
    .filter(j => REMOTE_RE.test(j.location?.name || '') || !j.location?.name)
    .map(j => ({
      title: stripHtml(j.title),
      company,
      url: j.absolute_url,
      apply_url: j.absolute_url,
      location: normalizeLocation(j.location?.name),
      job_type: 'Full-time',
      salary: 'Not Listed',
      date_posted: j.updated_at ? new Date(j.updated_at) : new Date(),
      description_short: truncateDesc(j.content || ''),
      lang: 'en',
      source: 'Greenhouse',
      ats: 'greenhouse',
      ats_direct: true,
      tags: [],
    }));
}

async function fetchLever(slug, company) {
  // ?remote=true filters to remote postings server-side
  const res = await get(`https://api.lever.co/v0/postings/${slug}?mode=json&remote=true`);
  const jobs = Array.isArray(res.data) ? res.data : [];
  return jobs.map(j => ({
    title: stripHtml(j.text),
    company,
    url: j.hostedUrl,
    apply_url: j.hostedUrl,
    location: normalizeLocation(j.categories?.location),
    job_type: j.categories?.commitment || 'Full-time',
    salary: 'Not Listed',
    date_posted: j.createdAt ? new Date(j.createdAt) : new Date(),
    description_short: truncateDesc(j.descriptionPlain || ''),
    lang: 'en',
    source: 'Lever',
    ats: 'lever',
    ats_direct: true,
    tags: j.categories?.team ? [j.categories.team] : [],
  }));
}

async function fetchAshby(slug, company) {
  const res = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  const org = res.data?.organization?.name || company;
  return (res.data?.jobPostings || [])
    .filter(j => j.isRemote || REMOTE_RE.test(j.locationName || ''))
    .map(j => ({
      title: stripHtml(j.title),
      company: org,
      url: j.applyLink?.url || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
      apply_url: j.applyLink?.url || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
      location: j.isRemote ? 'Remote' : normalizeLocation(j.locationName),
      job_type: j.employmentType || 'Full-time',
      salary: 'Not Listed',
      date_posted: j.publishedDate ? new Date(j.publishedDate) : new Date(),
      description_short: truncateDesc(j.descriptionHtml || ''),
      lang: 'en',
      source: 'Ashby',
      ats: 'ashby',
      ats_direct: true,
      tags: j.department ? [j.department] : [],
    }));
}

async function fetchSmartRecruiters(slug, company) {
  const res = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
  return (res.data?.content || [])
    .filter(j => j.location?.remote || REMOTE_RE.test(j.location?.city || ''))
    .map(j => ({
      title: stripHtml(j.name),
      company: j.company?.name || company,
      url: j.ref || `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      apply_url: j.ref || `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      location: j.location?.remote ? 'Remote' : normalizeLocation([j.location?.city, j.location?.country].filter(Boolean).join(', ')),
      job_type: 'Full-time',
      salary: 'Not Listed',
      date_posted: j.releasedDate ? new Date(j.releasedDate) : new Date(),
      description_short: truncateDesc(`${j.name} at ${j.company?.name || company}.`),
      lang: 'en',
      source: 'SmartRecruiters',
      ats: 'smartrecruiters',
      ats_direct: true,
      tags: j.department?.label ? [j.department.label] : [],
    }));
}

const ATS_FETCHERS = {
  greenhouse:      { fetch: fetchGreenhouse, urlFragment: slug => `greenhouse.io/${slug}` },
  lever:           { fetch: fetchLever,      urlFragment: slug => `lever.co/${slug}` },
  ashby:           { fetch: fetchAshby,      urlFragment: slug => `ashbyhq.com/${slug}` },
  smartrecruiters: { fetch: fetchSmartRecruiters, urlFragment: slug => `smartrecruiters.com/${slug}` },
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function importAtsJobs() {
  const col = mongoose.connection.collection('jobseeker.jobs');

  console.log('[importAtsJobs] Discovering ATS slugs from existing jobs...');
  const slugsByAts = await discoverSlugs(col);

  let totalNew = 0, totalUpdated = 0, totalErrors = 0;

  for (const [atsName, slugSet] of Object.entries(slugsByAts)) {
    const slugs = [...slugSet];
    if (!slugs.length) continue;
    console.log(`[importAtsJobs] ${atsName}: ${slugs.length} companies discovered`);
    const { fetch, urlFragment } = ATS_FETCHERS[atsName];

    for (const slug of slugs) {
      let jobs;
      try {
        const company = await resolveCompanyName(col, urlFragment(slug), slug);
        jobs = await fetch(slug, company);
        console.log(`  ${atsName}/${slug} (${company}): ${jobs.length} remote jobs`);
      } catch (err) {
        // 404 = private/removed board — skip silently
        if (err.response?.status !== 404) {
          console.warn(`  ${atsName}/${slug} failed: ${err.message}`);
        }
        totalErrors++;
        continue;
      }

      for (const job of jobs) {
        try {
          if (!job.title || !job.url) continue;
          const urlNormalized = job.url.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
          const result = await col.updateOne(
            { url_normalized: urlNormalized },
            {
              $set: { ...job, url_normalized: urlNormalized, cover_letter: '', updatedAt: new Date() },
              $setOnInsert: { job_code: generateJobCode(urlNormalized), createdAt: new Date() },
            },
            { upsert: true }
          );
          if (result.upsertedCount) totalNew++;
          else totalUpdated++;
        } catch { totalErrors++; }
      }

      // Small delay between companies to be a polite client
      await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log(`[importAtsJobs] Done. new=${totalNew} updated=${totalUpdated} errors=${totalErrors}`);
  return { totalNew, totalUpdated, totalErrors };
}

if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URI)
    .then(() => importAtsJobs())
    .then(r => { console.log('Done', r); mongoose.disconnect(); })
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { importAtsJobs };

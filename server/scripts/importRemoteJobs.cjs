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

const JUNK_LEAD_RE = /^(?:job\s+(?:overview|summary|description|details|brief|post|requirements|qualifications)|position\s+(?:overview|summary|description)|role\s+(?:overview|summary|requirements)|about\s+(?:the\s+)?(?:role|job|position|opportunity)|overview|summary|description|requirements?\s*(?:minimum)?|qualifications?|educational?(?:\s*[\/&]\s*\w+)?|responsibilities|key\s+(?:responsibilities|qualifications|requirements)|duties|minimum\s+qualifications?)\s*[:\-–—]?\s*/i;

function stripJunkLeads(text) {
  let s = text, prev;
  do { prev = s; s = s.replace(JUNK_LEAD_RE, '').trim(); } while (s !== prev);
  return s;
}

function truncateDesc(text) {
  if (!text) return '';
  const clean = stripJunkLeads(stripHtml(text).trim());
  if (clean.length <= 500) return clean;
  const cut = clean.slice(0, 500);
  const lastSentence = cut.search(/[.!?][^.!?]*$/);
  return lastSentence > 100 ? cut.slice(0, lastSentence + 1) : cut;
}

function normalizeLocation(loc) {
  if (!loc) return 'Remote';
  const l = stripHtml(loc).trim();
  if (!l || /remote|worldwide|anywhere|global|^-$/i.test(l)) return 'Remote';
  return l.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
}

function formatSalary(min, max, currency = 'USD', period = 'yearly') {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'JPY' ? '¥' : currency === 'BRL' ? 'R$' : '$';
  const fmt = n => Number(n).toLocaleString();
  if (min && max) return `${sym}${fmt(min)} - ${sym}${fmt(max)} / ${period === 'yearly' ? 'year' : period}`;
  if (min) return `${sym}${fmt(min)}+ / year`;
  return 'Not Listed';
}

function get(url, opts = {}) {
  return axios.get(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'WanderWork/1.0 (wanderwork.io)' },
    ...opts,
  });
}

// ── Source fetchers ───────────────────────────────────────────────────────────

async function fetchRemotive(category = null) {
  const params = { limit: 100 };
  if (category) params.category = category;
  const res = await get('https://remotive.com/api/remote-jobs', { params });
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

// Jobicy supports geo: usa, europe, uk, canada, australia, latin-america, asia, worldwide
async function fetchJobicyGeo(geo) {
  const res = await get('https://jobicy.com/api/v2/remote-jobs', { params: { count: 50, geo } });
  return (res.data?.jobs || []).map(j => ({
    title: stripHtml(j.jobTitle),
    company: stripHtml(j.companyName),
    url: j.url,
    salary: formatSalary(j.salaryMin, j.salaryMax, j.salaryCurrency, j.salaryPeriod),
    location: normalizeLocation(j.jobGeo),
    job_type: Array.isArray(j.jobType) ? j.jobType.join(', ') : (j.jobType || 'Full-time'),
    date_posted: j.pubDate ? new Date(j.pubDate) : new Date(),
    description_short: truncateDesc(j.jobDescription),
    source: 'Jobicy',
    tags: Array.isArray(j.jobIndustry) ? j.jobIndustry : [],
  }));
}

async function fetchRemoteOK() {
  const res = await get('https://remoteok.com/api');
  const raw = Array.isArray(res.data) ? res.data.slice(1) : [];
  return raw.map(j => ({
    title: stripHtml(j.position),
    company: stripHtml(j.company),
    url: j.url || `https://remoteok.com/l/${j.slug}`,
    salary: formatSalary(j.salary_min, j.salary_max),
    location: 'Remote',
    job_type: 'Full-time',
    date_posted: j.epoch ? new Date(Number(j.epoch) * 1000) : new Date(),
    description_short: truncateDesc(j.description),
    source: 'RemoteOK',
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 10) : [],
  }));
}

async function fetchArbeitnow() {
  const res = await get('https://www.arbeitnow.com/api/job-board-api');
  return (res.data?.data || []).filter(j => j.remote).map(j => ({
    title: stripHtml(j.title),
    company: stripHtml(j.company_name),
    url: j.url,
    salary: 'Not Listed',
    location: normalizeLocation(j.location) || 'Remote',
    job_type: Array.isArray(j.job_types) && j.job_types.length ? j.job_types.join(', ') : 'Full-time',
    date_posted: j.created_at ? new Date(Number(j.created_at) * 1000) : new Date(),
    description_short: truncateDesc(j.description),
    source: 'Arbeitnow',
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 10) : [],
  }));
}

async function fetchWorkingNomads(category = null) {
  const params = { limit: 50 };
  if (category) params.category = category;
  const res = await get('https://www.workingnomads.com/api/exposed_jobs/', { params });
  const raw = Array.isArray(res.data) ? res.data : (res.data?.jobs || []);
  return raw.map(j => ({
    title: stripHtml(j.title),
    company: stripHtml(j.company_name),
    url: j.url,
    salary: 'Not Listed',
    location: normalizeLocation(j.location),
    job_type: j.job_type || 'Full-time',
    date_posted: j.pub_date ? new Date(j.pub_date) : new Date(),
    description_short: truncateDesc(j.description),
    source: 'WorkingNomads',
    tags: j.tags ? String(j.tags).split(',').map(t => t.trim()).filter(Boolean).slice(0, 10) : [],
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Each entry is { name, fetch } — Jobicy is called once per geo region
const SOURCES = [
  // Remotive — broad mix + every category (covers art direction, advertising, graphic design)
  // Remotive — full category sweep including creative, QA, engineering
  { name: 'Remotive (all)',             fetch: () => fetchRemotive() },
  { name: 'Remotive (software-dev)',    fetch: () => fetchRemotive('software-dev') },
  { name: 'Remotive (design)',          fetch: () => fetchRemotive('design') },
  { name: 'Remotive (marketing)',       fetch: () => fetchRemotive('marketing') },
  { name: 'Remotive (finance-legal)',   fetch: () => fetchRemotive('finance-legal') },
  { name: 'Remotive (mgmt-finance)',    fetch: () => fetchRemotive('management-finance') },
  { name: 'Remotive (customer-svc)',    fetch: () => fetchRemotive('customer-service') },
  { name: 'Remotive (hr)',              fetch: () => fetchRemotive('hr') },
  { name: 'Remotive (sales)',           fetch: () => fetchRemotive('sales') },
  { name: 'Remotive (writing)',         fetch: () => fetchRemotive('writing') },
  { name: 'Remotive (product)',         fetch: () => fetchRemotive('product') },
  { name: 'Remotive (data)',            fetch: () => fetchRemotive('data') },
  { name: 'Remotive (devops)',          fetch: () => fetchRemotive('devops-sysadmin') },
  { name: 'Remotive (qa)',              fetch: () => fetchRemotive('qa') },
  { name: 'Remotive (all-others)',      fetch: () => fetchRemotive('all-others') },

  // Jobicy — geo-based (returns all industries per region)
  { name: 'Jobicy (USA)',        fetch: () => fetchJobicyGeo('usa') },
  { name: 'Jobicy (Europe)',     fetch: () => fetchJobicyGeo('europe') },
  { name: 'Jobicy (UK)',         fetch: () => fetchJobicyGeo('uk') },
  { name: 'Jobicy (APAC)',       fetch: () => fetchJobicyGeo('apac') },
  { name: 'Jobicy (Latin Am.)', fetch: () => fetchJobicyGeo('latam') },
  { name: 'Jobicy (Canada)',    fetch: () => fetchJobicyGeo('canada') },
  { name: 'Jobicy (Australia)', fetch: () => fetchJobicyGeo('australia') },

  // RemoteOK & Arbeitnow — general remote boards
  { name: 'RemoteOK',   fetch: fetchRemoteOK },
  { name: 'Arbeitnow',  fetch: fetchArbeitnow },

  // Working Nomads — category-specific for non-tech roles
  { name: 'WorkingNomads (dev)',         fetch: () => fetchWorkingNomads('back-end-programming') },
  { name: 'WorkingNomads (frontend)',    fetch: () => fetchWorkingNomads('front-end-programming') },
  { name: 'WorkingNomads (accounting)',  fetch: () => fetchWorkingNomads('accounting') },
  { name: 'WorkingNomads (finance)',     fetch: () => fetchWorkingNomads('finance') },
  { name: 'WorkingNomads (legal)',       fetch: () => fetchWorkingNomads('legal') },
  { name: 'WorkingNomads (customer)',    fetch: () => fetchWorkingNomads('customer-support') },
  { name: 'WorkingNomads (sales)',       fetch: () => fetchWorkingNomads('sales') },
  { name: 'WorkingNomads (marketing)',   fetch: () => fetchWorkingNomads('marketing') },
  { name: 'WorkingNomads (management)',  fetch: () => fetchWorkingNomads('management') },
  { name: 'WorkingNomads (proj-mgmt)',   fetch: () => fetchWorkingNomads('project-management') },
  { name: 'WorkingNomads (writing)',     fetch: () => fetchWorkingNomads('content') },
  { name: 'WorkingNomads (design)',      fetch: () => fetchWorkingNomads('design') },
  { name: 'WorkingNomads (ux)',          fetch: () => fetchWorkingNomads('ux') },
  { name: 'WorkingNomads (seo)',         fetch: () => fetchWorkingNomads('seo') },
  { name: 'WorkingNomads (qa)',          fetch: () => fetchWorkingNomads('qa') },
  { name: 'WorkingNomads (mobile)',      fetch: () => fetchWorkingNomads('mobile-programming') },
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

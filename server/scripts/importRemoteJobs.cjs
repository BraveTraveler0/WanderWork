'use strict';
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return '';
  // Entities decoded BEFORE tag-stripping — some sources (e.g. Greenhouse)
  // return doubly-encoded markup (&lt;h2&gt; not <h2>), so stripping tags
  // first finds nothing to strip and the later entity-decode re-creates
  // literal tags that never get removed.
  return String(html)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

// Strip emoji and mojibake (corrupted UTF-8 emoji read as Latin-1)
function stripEmoji(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27FF}]|[\u{2300}-\u{23FF}]|[\u{FE00}-\u{FEFF}]|[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[-¿À-ÿ]{2,}/g, '') // mojibake sequences
    .replace(/\s{2,}/g, ' ').trim();
}

// Detect likely non-English content (German is the main offender from our sources)
function detectLang(text) {
  if (!text) return 'en';
  const t = text.toLowerCase();
  const deWords = ['und ', ' die ', ' der ', ' das ', ' wir ', ' sie ', ' für ', ' mit ', ' von ', ' ist ', ' sind ', ' werden ', 'gmbh', ' auf ', ' des '];
  const matches = deWords.filter(w => t.includes(w)).length;
  return matches >= 3 ? 'de' : 'en';
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

// Resolves company names to their homepage URL.
// Step 1: Clearbit free autocomplete (fast, no cost).
// Step 2: GPT-4o-mini for anything Clearbit misses (reliable, low cost).
// Results cached per import run so each company is only looked up once.
const _companyUrlCache = new Map();

async function resolveCompanyUrls(jobs) {
  const needLookup = new Set(
    jobs.filter(j => !j.apply_url).map(j => j.company).filter(Boolean)
  );
  const toFetch = [...needLookup].filter(c => !_companyUrlCache.has(c.toLowerCase()));
  if (!toFetch.length) {
    return jobs.map(j => ({
      ...j,
      company_url: j.apply_url ? undefined : (_companyUrlCache.get((j.company || '').toLowerCase()) || null),
    }));
  }

  // Step 1 — Clearbit (parallel, free)
  await Promise.all(toFetch.map(async company => {
    const key = company.toLowerCase();
    try {
      const res = await get(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`,
        { timeout: 5000 }
      );
      const domain = (Array.isArray(res.data) ? res.data : [])[0]?.domain || null;
      _companyUrlCache.set(key, domain ? `https://${domain}` : null);
    } catch {
      _companyUrlCache.set(key, null);
    }
  }));

  // Step 2 — GPT-4o-mini for companies Clearbit couldn't find
  if (openai) {
    const stillMissing = toFetch.filter(c => !_companyUrlCache.get(c.toLowerCase()));
    if (stillMissing.length) {
      try {
        const prompt = `For each company below, return its official website URL (homepage only, no paths). Reply with a JSON object mapping company name to URL. If genuinely unknown reply null for that entry.\n\n${stillMissing.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        });
        const raw = res.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(raw);
        for (const company of stillMissing) {
          const key = company.toLowerCase();
          const url = parsed[company] || Object.entries(parsed).find(([k]) => k.toLowerCase() === key)?.[1] || null;
          if (url && /^https?:\/\//.test(url)) _companyUrlCache.set(key, url);
        }
      } catch (e) {
        console.warn('[resolveCompanyUrls] GPT fallback failed:', e.message);
      }
    }
  }

  return jobs.map(j => ({
    ...j,
    company_url: j.apply_url ? undefined : (_companyUrlCache.get((j.company || '').toLowerCase()) || null),
  }));
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

// Remotive's `category` and `limit` params are both ignored server-side as of
// 2026-06 — every request returns the same ~32-job firehose regardless of what's
// asked for (verified: category=software-dev and category=writing return
// byte-identical job IDs). So this is called once, unfiltered; each job still
// carries its own real `category` field for anyone downstream who wants it.
async function fetchRemotive() {
  const res = await get('https://remotive.com/api/remote-jobs', { params: { limit: 100 } });
  return (res.data?.jobs || []).flatMap(j => {
    const desc = truncateDesc(j.description);
    if (detectLang(desc) !== 'en') return [];
    return [{
      title: stripEmoji(stripHtml(j.title)),
      company: stripHtml(j.company_name),
      url: j.url,
      apply_url: null,           // remotive.com URLs are aggregator pages, not direct apply
      company_url: j.company_url || null,
      salary: j.salary ? stripHtml(j.salary) : 'Not Listed',
      location: normalizeLocation(j.candidate_required_location),
      job_type: j.job_type || 'Full-time',
      date_posted: j.publication_date ? new Date(j.publication_date) : new Date(),
      description_short: desc,
      lang: 'en',
      source: 'Remotive',
      ats_direct: false,
      tags: [j.category, ...(Array.isArray(j.tags) ? j.tags : [])].filter(Boolean).slice(0, 10),
    }];
  });
}

// The Muse — free public API. Categories confirmed against their live taxonomy
// (plausible-sounding strings like "Editor and Writer" or "Software and
// Engineering" 404/empty — always verify a category string returns results
// before adding it). "Internship" is a `level` facet, not a category, and
// cuts across all categories. There's no dedicated "Paralegal" category;
// "Legal Services" is the closest match and includes other legal roles too.
// The Muse mixes onsite and remote postings, so remote eligibility is filtered
// by checking for their "Flexible / Remote" location marker.
const MUSE_REMOTE_RE = /flexible|remote|anywhere/i;

async function fetchTheMuse({ category, level } = {}, pages = 3) {
  const allJobs = [];
  for (let page = 0; page < pages; page++) {
    try {
      const res = await get('https://www.themuse.com/api/public/jobs', {
        params: { category, level, page, descending: true },
        timeout: 15000,
      });
      const jobs = (res.data?.results || []).flatMap(j => {
        const rawDesc = j.contents || j.description || '';
        const desc = truncateDesc(rawDesc);
        if (!desc || detectLang(desc) !== 'en') return [];
        const title = stripEmoji(String(j.name || '').trim());
        const company = String(j.company?.name || '').trim();
        const locations = (j.locations || []).map(l => l.name).join(', ');
        if (!title || !company || !MUSE_REMOTE_RE.test(locations)) return [];
        return [{
          title,
          company,
          url: j.refs?.landing_page || '',
          apply_url: null,    // themuse.com is an aggregator landing page
          company_url: null,  // resolved later by resolveCompanyUrls
          salary: 'Not Listed',
          location: 'Remote',
          job_type: 'Full-time',
          date_posted: j.publication_date ? new Date(j.publication_date) : new Date(),
          description_short: desc,
          lang: 'en',
          source: 'TheMuse',
          ats_direct: false,
          tags: (j.categories || []).map(c => c.name).filter(Boolean).slice(0, 5),
        }];
      });
      allJobs.push(...jobs);
      if ((res.data?.results || []).length < 20) break; // no more pages
    } catch (err) {
      console.warn(`[TheMuse] ${category} page ${page} failed:`, err.message);
      break;
    }
  }
  return allJobs;
}


async function fetchWorkingNomads(category = null) {
  const params = { limit: 50 };
  if (category) params.category = category;
  const res = await get('https://www.workingnomads.com/api/exposed_jobs/', { params });
  const raw = Array.isArray(res.data) ? res.data : (res.data?.jobs || []);
  return raw.map(j => {
    const desc = truncateDesc(j.description);
    return {
      title: stripEmoji(stripHtml(j.title)),
      company: stripHtml(j.company_name),
      url: j.url,
      apply_url: null,
      salary: 'Not Listed',
      location: normalizeLocation(j.location),
      job_type: j.job_type || 'Full-time',
      date_posted: j.pub_date ? new Date(j.pub_date) : new Date(),
      description_short: desc,
      lang: detectLang(desc),
      source: 'WorkingNomads',
      tags: j.tags ? String(j.tags).split(',').map(t => t.trim()).filter(Boolean).slice(0, 10) : [],
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Each entry is { name, fetch }. Jobicy and RemoteOK were removed — both route
// applicants through a login wall, which is a bad experience for our users.
const SOURCES = [
  { name: 'Remotive', fetch: () => fetchRemotive() },

  // The Muse — covers roles that tech-company ATS boards rarely post.
  { name: 'TheMuse (PR/Comms)',  fetch: () => fetchTheMuse({ category: 'Media, PR, and Communications' }) },
  { name: 'TheMuse (Marketing)', fetch: () => fetchTheMuse({ category: 'Advertising and Marketing' }) },
  { name: 'TheMuse (Customer Service)', fetch: () => fetchTheMuse({ category: 'Customer Service' }) },
  { name: 'TheMuse (Admin/Assistants)', fetch: () => fetchTheMuse({ category: 'Administration and Office' }) },
  { name: 'TheMuse (Legal/Paralegal)', fetch: () => fetchTheMuse({ category: 'Legal Services' }) },
  { name: 'TheMuse (HR/Recruitment)', fetch: () => fetchTheMuse({ category: 'Human Resources and Recruitment' }) },
  { name: 'TheMuse (Accounting/Finance)', fetch: () => fetchTheMuse({ category: 'Accounting and Finance' }) },
  { name: 'TheMuse (Sales)', fetch: () => fetchTheMuse({ category: 'Sales' }) },
  { name: 'TheMuse (Product Management)', fetch: () => fetchTheMuse({ category: 'Product Management' }) },
  { name: 'TheMuse (Project Management)', fetch: () => fetchTheMuse({ category: 'Project Management' }) },
  { name: 'TheMuse (Writing/Content)', fetch: () => fetchTheMuse({ category: 'Writing and Editing' }) },
  { name: 'TheMuse (Data/AI)', fetch: () => fetchTheMuse({ category: 'Data and Analytics' }) },
  { name: 'TheMuse (Design/UX)', fetch: () => fetchTheMuse({ category: 'Design and UX' }) },
  { name: 'TheMuse (Operations)', fetch: () => fetchTheMuse({ category: 'Business Operations' }) },
  { name: 'TheMuse (Internships)', fetch: () => fetchTheMuse({ level: 'Internship' }) },
  // "Education"/"Healthcare" were tried and dropped — verified live (300+ job
  // sample each) that both categories on The Muse are ~0% remote-eligible;
  // online tutoring and telehealth roles are sourced via ATS company seeds
  // in importAtsJobs.cjs instead (Preply, Cambly, Lyra Health, BetterHelp...).
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

    // Resolve company homepage URLs for jobs without a direct apply link
    jobs = await resolveCompanyUrls(jobs);

    let upserted = 0, updated = 0, skipped = 0, errors = 0;
    for (const job of jobs) {
      try {
        if (!job.title || !job.url || !job.description_short) { skipped++; continue; }
        const urlNormalized = job.url.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
        const result = await col.updateOne(
          { url_normalized: urlNormalized },
          {
            $set: { ...job, url_normalized: urlNormalized, cover_letter: '', updatedAt: new Date() },
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

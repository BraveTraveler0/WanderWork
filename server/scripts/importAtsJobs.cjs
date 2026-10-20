'use strict';
const mongoose = require('mongoose');
const { isBlockedCompany } = require('../config/blockedCompanies');
const { jobSignals, extractSalaryFromText, formatRange, buildSummary, remoteLocation } = require('../utils/jobSignals');
const { upsertJob, normalizeUrl } = require('../utils/jobUpsert');
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
  // Entities decoded BEFORE tag-stripping: Greenhouse's content=true API
  // returns doubly-encoded markup (&lt;h2&gt; not <h2>), so stripping tags
  // first finds nothing to strip and the later entity-decode re-creates
  // literal tags that never get removed.
  return String(html)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}

function generateJobCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  return 'ats_' + (hash >>> 0).toString(36);
}

const REMOTE_RE = /remote|worldwide|anywhere|work.?from.?home|\bwfh\b/i;

// ── Seed lists ────────────────────────────────────────────────────────────────
// Known remote-friendly companies on each ATS. Sitemaps are tried first;
// seeds ensure coverage for platforms whose sitemaps are unavailable.

const SEEDS = {
  // Greenhouse's sitemap 404s (see comment on `lever` below — same underlying
  // issue), so this list was fully revalidated live on 2026-07: of ~277
  // unique seeded companies, only 94 still resolve. Most of the "dead" 66%
  // migrated to Workday, Ashby, or an in-house ATS. Only survivors kept below.
  greenhouse: [
    // Core tech / SaaS
    'stripe', 'airbnb', 'twilio', 'figma', 'hubspot', 'lyft', 'pinterest',
    'mongodb', 'elastic', 'datadog', 'brex', 'checkr', 'lattice', 'airtable',
    'gusto', 'chime', 'carta', 'remote', 'squarespace', 'intercom', 'pagerduty',
    'okta', 'cloudflare', 'fastly', 'asana', 'coinbase', 'instacart', 'glassdoor',
    'gitlab', 'dropbox', 'robinhood', 'faire', 'postman', 'mixpanel', 'amplitude',
    'contentful', 'algolia', 'netlify', 'tailscale', 'klaviyo', 'affirm',
    'betterment', 'calm', 'duolingo', 'coursera', 'udemy', 'masterclass', 'greenhouse',
    // Fintech / payments
    'adyen', 'marqeta', 'gocardless', 'tabapay',
    // Infrastructure / DevOps / security
    'orca', 'exabeam', 'honeycomb',
    // Data / AI / ML
    'databricks', 'fivetran', 'hightouch', 'labelbox',
    // Product / design / marketing tools
    'pendo', 'customerio', 'braze', 'iterable', 'hootsuite', 'later',
    // E-commerce / logistics
    'narvar', 'aftership',
    // Healthcare / biotech
    'oscar', 'veracyte',
    // Telehealth
    'talkspace', 'betterhelp', 'cerebral', 'amwell', 'twochairs',
    // Logistics/ops (moved off Lever)
    'flexport',
    // Education / creator economy
    'outschool', 'thinkific', 'khanacademy', 'goguardian', 'udacity', 'nerdy',
    // Climate / sustainability
    'watershed', 'patch',
    // PR, comms & media
    'cision', 'brandwatch', 'voxmedia', 'buzzfeed', 'axios',
    // Finance / accounting / fintech
    'melio', 'sage', 'akoya', 'pulley',
  ],
  // Lever's sitemap (jobs.lever.co/sitemap.xml) 404s as of 2026-07, so unlike
  // Greenhouse/Ashby there's no auto-discovery fallback — this list is the
  // only source and was fully revalidated live (most of the old list had
  // migrated off Lever entirely and 404'd; only slugs confirmed live below).
  lever: [
    'secureframe', 'toptal', 'instrument', 'greenlight', 'transcarent',
    'netflix', 'ro', 'whoop', 'kraken', 'zoox', 'trinet',
    'lyrahealth', 'includedhealth', 'loadsmart',
  ],
  // Also revalidated live 2026-07: of 94 unique seeded companies, only 45
  // still resolve (Anthropic, PlanetScale, and Sourcegraph among the dead —
  // moved to Greenhouse/in-house). Only survivors kept below.
  ashby: [
    'linear', 'vercel', 'supabase', 'neon', 'hightouch', 'polytomic',
    'airbyte', 'motherduck', 'weaviate', 'pinecone',
    'replit', 'graphite', 'posthog',
    'incident', 'opslevel', 'launchdarkly',
    'merge', 'nango', 'kombo',
    'runway', 'pika', 'krea', 'ideogram', 'resend',
    // Design tools / creative on Ashby
    'loom', 'miro', 'mural', 'ghost', 'substack',
    // Finance / accounting on Ashby
    'deel', 'sequoia', 'mercury', 'rho', 'found', 'clearco', 'capchase',
    // Online tutoring / language teaching on Ashby
    'preply', 'cambly', 'multiverse', 'babbel', 'brainly', 'brightwheel',
    // Telehealth on Ashby
    'headway', 'grow-therapy', 'sondermind',
  ],
  smartrecruiters: [
    'bosch', 'visa', 'linkedin', 'ericsson', 'koninklijke', 'sap',
    'siemens', 'philips', 'klm', 'heineken', 'booking', 'takeaway',
    'adyen', 'mollie', 'messagebird', 'sendcloud', 'picnic', 'coolblue',
    'spotify', 'king', 'mojang', 'paradox', 'izettle', 'klarna',
  ],
  // Workable has no sitemap and job URLs (apply.workable.com/j/<shortcode>)
  // don't embed the company slug, so unlike the other ATS providers this list
  // is the *only* discovery mechanism — there's no sitemap/DB fallback to grow
  // it automatically. Each slug below was verified live against Workable's
  // public widget API (fake slugs 404; these all returned real accounts).
  workable: [
    'typeform', 'deliveroo', 'babbel', 'wagestream', 'paddle', 'blablacar',
    'truelayer', 'onfido', 'thoughtmachine', 'trivago', 'tide', 'marshmallow',
    'cleo', 'curve', 'multiverse', 'hopin', 'bloomandwild', 'treatwell',
    'photobox', 'moneybox', 'capdesk', 'zopa', 'bulb', 'farewill', 'personio',
    'depop', 'n26', 'monzo', 'wise', 'starling', 'revolut', 'skyscanner',
    'algolia', 'zego',
  ],
  // Recruitee/Breezy/Personio have no public sitemap either, so like Workable
  // these seeds were verified live against each platform's public API before
  // being added (fake/former slugs 404 or redirect to the platform homepage).
  recruitee: ['channable', 'sendcloud', 'bunq', 'personio'],
  breezy: ['vetsez', '20four7va', 'bettersource', 'urrly', 'drips', 'new-incentives'],
  personio: ['personio', 'deskbird', 'pitch', 'wolt', 'clark'],
};

// ── Sitemap discovery ─────────────────────────────────────────────────────────

const SITEMAP_CONFIGS = {
  greenhouse: {
    url: 'https://boards.greenhouse.io/sitemap.xml',
    extract: url => {
      if (url.includes('/jobs/')) return null; // skip individual job pages
      const m = url.match(/boards\.greenhouse\.io\/([a-z0-9_-]+)/i);
      return m ? m[1].toLowerCase() : null;
    },
  },
  lever: {
    url: 'https://jobs.lever.co/sitemap.xml',
    extract: url => {
      // UUID in URL = individual job, not company board
      if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(url)) return null;
      const m = url.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
      return m ? m[1].toLowerCase() : null;
    },
  },
  ashby: {
    url: 'https://jobs.ashbyhq.com/sitemap.xml',
    extract: url => {
      if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(url)) return null;
      const m = url.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i);
      return m ? m[1].toLowerCase() : null;
    },
  },
};

async function fetchSitemapSlugs(atsName) {
  const cfg = SITEMAP_CONFIGS[atsName];
  if (!cfg) return new Set();
  try {
    const res = await get(cfg.url, { timeout: 20000 });
    const xml = String(res.data);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

    // Handle sitemap index (points to sub-sitemaps) — no cap, fetch all
    if (xml.includes('<sitemapindex')) {
      const subSlugs = new Set();
      // Fetch sub-sitemaps in parallel batches of 20
      for (let i = 0; i < locs.length; i += 20) {
        const batch = locs.slice(i, i + 20);
        await Promise.all(batch.map(async subUrl => {
          try {
            const sub = await get(subUrl, { timeout: 15000 });
            const subLocs = [...String(sub.data).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
            for (const u of subLocs) { const s = cfg.extract(u); if (s) subSlugs.add(s); }
          } catch {}
        }));
      }
      return subSlugs;
    }

    const slugs = new Set();
    for (const u of locs) { const s = cfg.extract(u); if (s) slugs.add(s); }
    return slugs;
  } catch (e) {
    console.warn(`[importAtsJobs] ${atsName} sitemap failed: ${e.message}`);
    return new Set();
  }
}

// ── DB discovery ──────────────────────────────────────────────────────────────

const DISCOVER_RES = {
  greenhouse:      /boards\.greenhouse\.io\/([a-z0-9_-]+)/i,
  lever:           /jobs\.lever\.co\/([a-z0-9_-]+)/i,
  ashby:           /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i,
  smartrecruiters: /jobs\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i,
  recruitee:       /([a-z0-9_-]+)\.recruitee\.com/i,
  breezy:          /([a-z0-9_-]+)\.breezy\.hr/i,
  personio:        /([a-z0-9_-]+)\.jobs\.personio\.(?:de|com)/i,
};

async function discoverSlugsFromDb(col) {
  const slugs = {
    greenhouse: new Set(), lever: new Set(), ashby: new Set(), smartrecruiters: new Set(),
    recruitee: new Set(), breezy: new Set(), personio: new Set(),
  };
  const jobs = await col.find(
    { $or: [
      { apply_url: { $regex: 'greenhouse\\.io|lever\\.co|ashbyhq\\.com|smartrecruiters\\.com|recruitee\\.com|breezy\\.hr|jobs\\.personio\\.', $options: 'i' } },
      { url:       { $regex: 'greenhouse\\.io|lever\\.co|ashbyhq\\.com|smartrecruiters\\.com|recruitee\\.com|breezy\\.hr|jobs\\.personio\\.', $options: 'i' } },
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

async function discoverAllSlugs(col) {
  console.log('[importAtsJobs] Discovering slugs from sitemaps + DB...');
  const [dbSlugs, ghSitemap, leverSitemap, ashbySitemap] = await Promise.all([
    discoverSlugsFromDb(col),
    fetchSitemapSlugs('greenhouse'),
    fetchSitemapSlugs('lever'),
    fetchSitemapSlugs('ashby'),
  ]);

  console.log(`[importAtsJobs] Sitemap slugs — Greenhouse: ${ghSitemap.size}, Lever: ${leverSitemap.size}, Ashby: ${ashbySitemap.size}`);

  return {
    greenhouse:      new Set([...ghSitemap,     ...SEEDS.greenhouse,      ...(dbSlugs.greenhouse || [])]),
    lever:           new Set([...leverSitemap,  ...SEEDS.lever,           ...(dbSlugs.lever || [])]),
    ashby:           new Set([...ashbySitemap,  ...SEEDS.ashby,           ...(dbSlugs.ashby || [])]),
    smartrecruiters: new Set([...SEEDS.smartrecruiters, ...(dbSlugs.smartrecruiters || [])]),
    recruitee:       new Set([...SEEDS.recruitee, ...(dbSlugs.recruitee || [])]),
    breezy:          new Set([...SEEDS.breezy,    ...(dbSlugs.breezy || [])]),
    personio:        new Set([...SEEDS.personio,  ...(dbSlugs.personio || [])]),
    // Seed-only — no sitemap, and job URLs don't embed the slug so DB discovery can't grow it.
    workable:        new Set(SEEDS.workable),
  };
}

// ── Company name resolution ───────────────────────────────────────────────────

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
//
// Each fetcher returns { jobs, boardSize }: the remote jobs to store, and how
// many postings the board returned in total. boardSize > 0 proves the board
// answered, so stored jobs missing from `jobs` (closed, or no longer remote)
// can be pruned even when a company has no remote openings left.

// Hybrid and on-site roles are not remote, even when a location also says
// "remote" ("Hybrid - Remote eligible", "Remote or on-site in Austin").
const NOT_REMOTE_RE = /\bhybrid\b|\bon-?site\b|\bin[- ]office\b|\boffice[- ]based\b/i;

function isRemoteText(text) {
  const t = String(text || '');
  return REMOTE_RE.test(t) && !NOT_REMOTE_RE.test(t);
}

function inferJobType(title, fallback) {
  const t = String(title || '');
  if (/\bintern(ship)?\b|\bco-?op\b/i.test(t)) return 'Internship';
  if (/\bcontract(or)?\b|\bfreelance\b|\b1099\b|\btemporary\b|\btemp\b/i.test(t)) return 'Contract';
  if (/\bpart[- ]time\b/i.test(t)) return 'Part-time';
  return fallback || 'Full-time';
}

// Adds who-can-apply, time zone, pay, job type and a role-first summary,
// computed from every location field and the FULL posting text.
function finalizeJob(job, { locationTexts = [], fullText = '', salary = null }) {
  const locs = locationTexts.filter(Boolean);
  const signals = jobSignals({ title: job.title, locationTexts: locs, fullText });
  return {
    ...job,
    location: remoteLocation(locs.find(l => /remote/i.test(l)) || locs[0], signals.remote_scope),
    ...signals,
    salary: salary || extractSalaryFromText(fullText) || job.salary || 'Not Listed',
    job_type: inferJobType(job.title, job.job_type),
    description_short: buildSummary(fullText, job.title) || `${job.title} at ${job.company}.`,
    desc_source: fullText,
  };
}

async function fetchGreenhouse(slug, company) {
  const res = await get(`https://boards.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  const all = res.data?.jobs || [];
  const now = Date.now();
  const jobs = all
    .map(j => ({ j, text: stripHtml(j.content || '') }))
    .filter(({ j, text }) => {
      const loc = j.location?.name || '';
      // No location at all: only keep it if the posting itself says remote.
      return loc ? isRemoteText(loc) : isRemoteText(text.slice(0, 3000));
    })
    // Skip postings whose application deadline has passed.
    .filter(({ j }) => !j.application_deadline || new Date(j.application_deadline).getTime() >= now)
    .map(({ j, text }) => finalizeJob({
      title: stripHtml(j.title),
      company,
      url: j.absolute_url,
      apply_url: j.absolute_url,
      job_type: 'Full-time',
      // first_published is when the job went live. updated_at changes on any
      // edit, which made months-old postings look new and dodge the 90-day purge.
      date_posted: new Date(j.first_published || j.updated_at || Date.now()),
      lang: 'en',
      source: 'Greenhouse',
      ats: 'greenhouse',
      ats_direct: true,
      tags: (j.departments || []).map(d => d.name).filter(Boolean).slice(0, 3),
    }, {
      locationTexts: [j.location?.name, ...(j.offices || []).map(o => o.name)],
      fullText: text,
    }));
  return { jobs, boardSize: all.length };
}

async function fetchLever(slug, company) {
  // Lever's postings API has no remote filter (a `remote=true` param is
  // silently ignored), so every on-site and hybrid role used to be imported.
  // workplaceType is the authoritative signal.
  const res = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  const all = Array.isArray(res.data) ? res.data : [];
  const jobs = all
    .filter(j => j.workplaceType === 'remote'
      || ((!j.workplaceType || j.workplaceType === 'unspecified') && isRemoteText(j.categories?.location)))
    .map(j => {
      const sr = j.salaryRange;
      const fullText = [
        j.descriptionPlain,
        ...(j.lists || []).map(l => `${l.text}: ${stripHtml(l.content)}`),
        j.additionalPlain,
        j.salaryDescriptionPlain,
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ');
      return finalizeJob({
        title: stripHtml(j.text),
        company,
        url: j.hostedUrl,
        apply_url: j.applyUrl || j.hostedUrl,
        job_type: j.categories?.commitment || 'Full-time',
        date_posted: j.createdAt ? new Date(j.createdAt) : new Date(),
        lang: 'en',
        source: 'Lever',
        ats: 'lever',
        ats_direct: true,
        tags: j.categories?.team ? [j.categories.team] : [],
      }, {
        locationTexts: [j.categories?.location, ...(j.categories?.allLocations || []), j.country],
        fullText,
        salary: sr ? formatRange(sr.min, sr.max, sr.currency, sr.interval) : null,
      });
    });
  return { jobs, boardSize: all.length };
}

async function fetchAshby(slug, company) {
  const res = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
  const org = res.data?.organization?.name || company;
  // Ashby's response field is `jobs` (verified live 2026-07). Its isRemote
  // flag is also true for hybrid roles, so workplaceType decides.
  const all = res.data?.jobs || [];
  const jobs = all
    .filter(j => j.isListed !== false)
    .filter(j => j.workplaceType ? j.workplaceType === 'Remote' : (j.isRemote && !NOT_REMOTE_RE.test(j.location || '')))
    .map(j => {
      const pay = j.compensation?.compensationTierSummary || j.compensation?.scrapeableCompensationSalarySummary;
      return finalizeJob({
        title: stripHtml(j.title),
        company: org,
        url: j.jobUrl || j.applyUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
        apply_url: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
        job_type: j.employmentType === 'PartTime' ? 'Part-time' : j.employmentType === 'Contract' ? 'Contract' : j.employmentType === 'Intern' ? 'Internship' : 'Full-time',
        date_posted: j.publishedAt ? new Date(j.publishedAt) : new Date(),
        lang: 'en',
        source: 'Ashby',
        ats: 'ashby',
        ats_direct: true,
        tags: j.department ? [j.department] : [],
      }, {
        locationTexts: [j.location, ...(j.secondaryLocations || []).map(s => s.location), j.address?.postalAddress?.addressCountry],
        fullText: j.descriptionPlain ? String(j.descriptionPlain).replace(/\s+/g, ' ') : stripHtml(j.descriptionHtml || ''),
        salary: pay ? String(pay).split('•')[0].trim() : null,
      });
    });
  return { jobs, boardSize: all.length };
}

// Workable's own `telecommuting` flag is the remote signal. Some companies
// also mark traveling/field roles as telecommuting, so an empty `city` (i.e.
// not tied to one office) is used as the stronger "actually remote" signal —
// when a city is present we keep it as the location instead of mislabeling
// the job "Remote".
async function fetchWorkable(slug, company) {
  const res = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
  const org = res.data?.name || company;
  const all = res.data?.jobs || [];
  const jobs = all
    .filter(j => j.telecommuting)
    .map(j => {
      const loc = j.locations?.[0] || {};
      const where = loc.city ? [loc.city, loc.country].filter(Boolean).join(', ') : ['Remote', loc.country].filter(Boolean).join(' - ');
      return finalizeJob({
        title: stripHtml(j.title),
        company: org,
        url: j.url,
        apply_url: j.application_url || j.url,
        job_type: j.employment_type || 'Full-time',
        date_posted: j.published_on ? new Date(j.published_on) : new Date(),
        lang: 'en',
        source: 'Workable',
        ats: 'workable',
        ats_direct: true,
        tags: j.department ? [j.department] : [],
      }, {
        locationTexts: [where, ...(j.locations || []).slice(1).map(l => [l.city, l.country].filter(Boolean).join(', '))],
        fullText: stripHtml(j.description || ''),
      });
    });
  return { jobs, boardSize: all.length };
}

async function fetchSmartRecruiters(slug, company) {
  // The list endpoint has no description; the per-posting detail call is one
  // request per job, so only location-based signals are used here.
  const res = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
  const all = res.data?.content || [];
  const jobs = all
    .filter(j => (j.location?.remote && !j.location?.hybrid) || isRemoteText(j.location?.city || ''))
    .map(j => finalizeJob({
      title: stripHtml(j.name),
      company: j.company?.name || company,
      url: j.ref || `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      apply_url: j.ref || `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      job_type: j.typeOfEmployment?.label || 'Full-time',
      date_posted: j.releasedDate ? new Date(j.releasedDate) : new Date(),
      lang: 'en',
      source: 'SmartRecruiters',
      ats: 'smartrecruiters',
      ats_direct: true,
      tags: j.department?.label ? [j.department.label] : [],
    }, {
      locationTexts: [['Remote', j.location?.country?.toUpperCase?.() === 'US' ? 'United States' : j.location?.country].filter(Boolean).join(' - '), [j.location?.city, j.location?.region].filter(Boolean).join(', ')],
      fullText: `${j.name} at ${j.company?.name || company}.`,
    }));
  return { jobs, boardSize: all.length };
}

async function fetchRecruitee(slug, company) {
  const res = await get(`https://${slug}.recruitee.com/api/offers/`);
  const all = res.data?.offers || [];
  const jobs = all
    .filter(j => (j.remote === true && !j.hybrid) || isRemoteText([j.city, j.state_name].filter(Boolean).join(' ')))
    .map(j => finalizeJob({
      title: stripHtml(j.title),
      company: j.company_name || company,
      url: j.careers_url,
      apply_url: j.careers_apply_url || j.careers_url,
      job_type: j.employment_type_code || 'Full-time',
      date_posted: j.published_at ? new Date(j.published_at) : new Date(),
      lang: 'en',
      source: 'Recruitee',
      ats: 'recruitee',
      ats_direct: true,
      tags: j.department ? [j.department] : [],
    }, {
      locationTexts: [j.remote ? ['Remote', j.country].filter(Boolean).join(' - ') : [j.city, j.country].filter(Boolean).join(', '), j.location],
      fullText: stripHtml(`${j.description || ''} ${j.requirements || ''}`),
    }));
  return { jobs, boardSize: all.length };
}

async function fetchBreezy(slug, company) {
  const res = await get(`https://${slug}.breezy.hr/json?verbose=true`, {
    maxRedirects: 0,
    validateStatus: s => s === 200,
  });
  const all = Array.isArray(res.data) ? res.data : [];
  const jobs = all
    .filter(j => j.location?.is_remote || isRemoteText(j.location?.name || ''))
    .map(j => finalizeJob({
      title: stripHtml(j.name),
      company: j.company?.name || company,
      url: j.url,
      apply_url: j.url,
      job_type: j.type?.name || 'Full-time',
      salary: j.salary ? stripHtml(j.salary) : null,
      date_posted: j.published_date ? new Date(j.published_date) : new Date(),
      lang: 'en',
      source: 'BreezyHR',
      ats: 'breezy',
      ats_direct: true,
      tags: j.department ? [j.department] : [],
    }, {
      locationTexts: [j.location?.name, j.location?.country?.name, ...(j.locations || []).map(l => l.name)],
      fullText: stripHtml(j.description || ''),
      salary: j.salary ? stripHtml(j.salary) : null,
    }));
  return { jobs, boardSize: all.length };
}

// Personio only exposes an XML export (no JSON API), and unlike the other
// ATS providers doesn't put company jobs behind a single "offers" array —
// each <position> block's description is split across several <jobDescription>
// sections (e.g. "Your mission", "Your profile") that get concatenated below.
function extractXmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}
function decodeXmlEntities(str) {
  return String(str)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function fetchPersonio(slug, company) {
  const res = await get(`https://${slug}.jobs.personio.de/xml`, {
    maxRedirects: 0,
    validateStatus: s => s === 200,
  });
  const xml = String(res.data);
  const blocks = [...xml.matchAll(/<position>([\s\S]*?)<\/position>/g)].map(m => m[1]);
  const jobs = blocks.flatMap(block => {
    const id = extractXmlTag(block, 'id');
    const office = decodeXmlEntities(extractXmlTag(block, 'office'));
    // A job's primary office can be "Hybrid - Paris" while its
    // <additionalOffices> lists a remote option — checking only `office`
    // wrongly excludes those, so both get tested for the remote signal.
    const additionalOffices = decodeXmlEntities(extractXmlTag(block, 'additionalOffices'));
    const title = decodeXmlEntities(extractXmlTag(block, 'name'));
    const department = decodeXmlEntities(extractXmlTag(block, 'department'));
    const employmentType = extractXmlTag(block, 'employmentType');
    const createdAt = extractXmlTag(block, 'createdAt');
    const remoteOffice = [office, ...additionalOffices.split(/<\/?office>|,/)].map(s => stripHtml(s)).find(s => REMOTE_RE.test(s));
    if (!title || !id || !remoteOffice) return [];
    const descParts = [...block.matchAll(/<value>([\s\S]*?)<\/value>/g)]
      .map(m => stripHtml(decodeXmlEntities(m[1])));
    return [finalizeJob({
      title: stripHtml(title),
      company,
      url: `https://${slug}.jobs.personio.de/job/${id}`,
      apply_url: `https://${slug}.jobs.personio.de/job/${id}`,
      job_type: employmentType === 'part-time' ? 'Part-time' : employmentType === 'intern' ? 'Internship' : employmentType === 'freelance' ? 'Contract' : 'Full-time',
      date_posted: createdAt ? new Date(createdAt) : new Date(),
      lang: 'en',
      source: 'Personio',
      ats: 'personio',
      ats_direct: true,
      tags: department ? [department] : [],
    }, {
      // Personio boards are mostly European companies; the office name
      // ("Remote Germany") usually carries the country.
      locationTexts: [remoteOffice, office],
      fullText: descParts.join(' ') || `${title}, ${department}`,
    })];
  });
  return { jobs, boardSize: blocks.length };
}

const ATS_FETCHERS = {
  greenhouse:      { fetch: fetchGreenhouse,      urlFragment: s => `greenhouse.io/${s}` },
  lever:           { fetch: fetchLever,           urlFragment: s => `lever.co/${s}` },
  ashby:           { fetch: fetchAshby,           urlFragment: s => `ashbyhq.com/${s}` },
  smartrecruiters: { fetch: fetchSmartRecruiters, urlFragment: s => `smartrecruiters.com/${s}` },
  recruitee:       { fetch: fetchRecruitee,       urlFragment: s => `${s}.recruitee.com` },
  breezy:          { fetch: fetchBreezy,          urlFragment: s => `${s}.breezy.hr` },
  personio:        { fetch: fetchPersonio,        urlFragment: s => `${s}.jobs.personio.` },
  // Workable job URLs (apply.workable.com/j/<shortcode>) don't contain the slug,
  // so a real urlFragment here would match every Workable job in the DB and return
  // an unrelated company's name. fetchWorkable resolves the name from the API
  // response itself, so this fragment is deliberately unmatchable.
  workable:        { fetch: fetchWorkable,        urlFragment: s => `workable.com/__unused__/${s}` },
};

// ── Main ──────────────────────────────────────────────────────────────────────

// Max companies to attempt per ATS per import cycle.
// Seeds always run; remaining slots are filled from sitemap discovery in random order
// so the full catalogue rotates across every few import cycles.
const PER_CYCLE_CAP = {
  greenhouse:      600,
  lever:           200,
  ashby:           150,
  smartrecruiters: 80,
  workable:        SEEDS.workable.length,
  recruitee:       200,
  breezy:          200,
  personio:        200,
};

const CONCURRENCY = 12; // parallel company fetches per batch

async function upsertJobs(col, jobs) {
  let added = 0, updated = 0, errors = 0;
  await Promise.all(jobs.map(async job => {
    try {
      if (!job.title || !job.url) return;
      if (isBlockedCompany(job.company, job.url)) return;
      const r = await upsertJob(col, job, generateJobCode(normalizeUrl(job.url)));
      if (r.upsertedCount) added++; else updated++;
    } catch (err) {
      errors++;
      if (errors <= 3) console.warn(`[importAtsJobs] upsert failed: ${err.message}`);
    }
  }));
  return { added, updated, errors };
}

// A board that fetched cleanly is the source of truth for that company: any job
// we stored from it that is no longer among its remote listings was closed by
// the employer or is not remote (on-site and hybrid roles imported before the
// Lever/Ashby filters were fixed). Only runs when the board returned postings,
// so an empty or odd API response can never wipe a company's listings.
async function pruneClosedJobs(col, atsName, slug, liveJobs, boardSize) {
  if (!boardSize) return [];
  const live = liveJobs.map(j => normalizeUrl(j.url));
  const filter = { ats: atsName, ats_slug: slug, url_normalized: { $nin: live } };
  const closed = await col.find(filter, { projection: { _id: 1, title: 1, company: 1 } }).toArray();
  if (closed.length) await col.deleteMany({ _id: { $in: closed.map(j => j._id) } });
  return closed;
}

async function importAtsJobs() {
  const col = mongoose.connection.collection('jobseeker.jobs');
  const slugsByAts = await discoverAllSlugs(col);

  let totalNew = 0, totalUpdated = 0, totalErrors = 0;
  const removedJobs = [];

  for (const [atsName, slugSet] of Object.entries(slugsByAts)) {
    const seeds = new Set(SEEDS[atsName] || []);
    const allSlugs = [...slugSet];
    const cap = PER_CYCLE_CAP[atsName] || 200;

    // Seeds always first, then shuffle the rest and fill up to cap
    const seedSlugs = allSlugs.filter(s => seeds.has(s));
    const otherSlugs = allSlugs.filter(s => !seeds.has(s)).sort(() => Math.random() - 0.5);
    const slugs = [...new Set([...seedSlugs, ...otherSlugs])].slice(0, cap);

    if (!slugs.length) continue;
    console.log(`[importAtsJobs] ${atsName}: ${allSlugs.length} discovered → processing ${slugs.length} this cycle`);
    const { fetch, urlFragment } = ATS_FETCHERS[atsName];

    // Process in parallel batches
    for (let i = 0; i < slugs.length; i += CONCURRENCY) {
      const batch = slugs.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async slug => {
        try {
          const company = await resolveCompanyName(col, urlFragment(slug), slug);
          const seenAt = new Date();
          // ats_slug ties each job to its board for pruning; last_seen_at marks
          // it as still listed so feeds can leave out jobs no longer seen.
          const { jobs: fetched, boardSize } = await fetch(slug, company);
          const jobs = fetched.filter(j => j.url).map(j => ({ ...j, ats_slug: slug, last_seen_at: seenAt }));
          if (jobs.length) console.log(`  ${atsName}/${slug}: ${jobs.length} remote of ${boardSize} jobs`);
          try {
            const closed = await pruneClosedJobs(col, atsName, slug, jobs, boardSize);
            if (closed.length) {
              removedJobs.push(...closed);
              console.log(`  ${atsName}/${slug}: removed ${closed.length} closed jobs`);
            }
          } catch (pruneErr) {
            console.warn(`  ${atsName}/${slug} prune failed: ${pruneErr.message}`);
          }
          return jobs;
        } catch (err) {
          if (err.response?.status !== 404) {
            console.warn(`  ${atsName}/${slug} failed: ${err.message}`);
          }
          totalErrors++;
          return [];
        }
      }));

      const allJobs = batchResults.flat();
      if (allJobs.length) {
        const { added, updated, errors } = await upsertJobs(col, allJobs);
        totalNew += added; totalUpdated += updated; totalErrors += errors;
      }

      // Small pause between batches to avoid rate limiting
      if (i + CONCURRENCY < slugs.length) await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log(`[importAtsJobs] Done. new=${totalNew} updated=${totalUpdated} removed=${removedJobs.length} errors=${totalErrors}`);
  return { totalNew, totalUpdated, totalErrors, removedJobs };
}

if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URI)
    .then(() => importAtsJobs())
    .then(r => { console.log('Done', r); mongoose.disconnect(); })
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { importAtsJobs, _fetchers: ATS_FETCHERS };

/**
 * Airtable Sync API Routes
 * Endpoints to manage and trigger Airtable syncing
 */

const express = require('express');
const crypto = require('crypto');
const { triggerSync, getSyncStatus } = require('../airtable-scheduler');
const {
  syncRecruiters,
  upsertRecruiters,
  dedupeRecruiters,
  reclassifyRecruiterSpecialties,
} = require('../services/recruiterSyncService');
const { runRecruiterApifyPipeline } = require('../services/apifyRecruiterService');

const router = express.Router();

async function aiCompanyDescription(companyName) {
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Write a 2-3 sentence professional description of the company "${companyName}". Be factual and concise. Return only the description text, nothing else.` }],
      temperature: 0.3,
      max_tokens: 120,
    });
    return response.choices[0].message.content.trim();
  } catch {
    return '';
  }
}

function getSyncSecret() {
  return process.env.N8N_SYNC_SECRET || process.env.SYNC_ADMIN_KEY || process.env.IMPORT_ADMIN_KEY || '';
}

function requireSyncSecret(req, res, next) {
  const configuredSecret = getSyncSecret();
  const providedSecret = req.headers['x-n8n-secret'] || req.headers['x-admin-key'];

  if (!configuredSecret) {
    return res.status(503).json({
      success: false,
      error: 'Sync secret is not configured. Set N8N_SYNC_SECRET on the server.',
    });
  }

  const provided = Buffer.from(String(providedSecret || ''));
  const expected = Buffer.from(String(configuredSecret));
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

function stripHtml(str) {
  return String(str || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function firstText(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const joined = value.filter(Boolean).join(', ').trim();
      if (joined) return joined;
      continue;
    }
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeJobType(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ').trim();
  return String(value || '').trim();
}

function normalizeLocation(value) {
  const text = stripHtml(value || 'Remote').trim();
  if (!text) return 'Remote';
  if (/remote/i.test(text)) return 'Remote';
  return text.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
}

function generateJobCode(urlNormalized) {
  return `J${crypto.createHash('sha1').update(String(urlNormalized || '')).digest('hex').slice(0, 7).toUpperCase()}`;
}

async function upsertJobs(records) {
  const col = require('mongoose').connection.collection('jobseeker.jobs');
  let upserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of records) {
    try {
      const url = String(r.url || r.id || '').trim();
      if (!url) { skipped++; continue; }

      const urlNormalized = url.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
      const title = stripHtml(firstText(r.title, r.positionName, r.jobTitle, r.job_title, r.name));
      if (!title) { skipped++; continue; }

      const company = stripHtml(firstText(r.company, r.companyName, r.employer, 'Unknown'));
      const descriptionRaw = firstText(
        r.description,
        r.description_short,
        r.descriptionShort,
        r.jobDescription,
        r.job_description,
        r.companyInfo?.companyDescription
      );
      const fallbackDescription = `${title} at ${company}. Full details are available through the job posting link.`;
      const descFull = stripHtml(descriptionRaw);
      const descriptionShort = (() => {
        if (!descFull) return (process.env.OPENAI_API_KEY ? null : '') || fallbackDescription;
        if (descFull.length <= 500) return descFull;
        const cut = descFull.slice(0, 500);
        const lastSentence = cut.search(/[.!?][^.!?]*$/);
        return lastSentence > 100 ? cut.slice(0, lastSentence + 1) : cut;
      })() || (process.env.OPENAI_API_KEY ? await aiCompanyDescription(company) : '') || fallbackDescription;
      const dateRaw = firstText(r.datePosted, r.date_posted, r.postedAt, r.postedDate, r.rawDate);
      const parsedDate = dateRaw ? new Date(dateRaw) : new Date();
      const providedJobCode = firstText(r.jobCode, r.job_code, r.code);

      const doc = {
        title,
        company,
        url,
        url_normalized: urlNormalized,
        salary: String(r.salary || 'Not Listed').trim(),
        location: normalizeLocation(r.location),
        job_type: normalizeJobType(r.jobType || r.job_type || r.type),
        date_posted: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        description_short: descriptionShort,
        source: String(r.source || 'n8n').trim(),
        score: 0,
        tags: [],
        cover_letter: '',
        updatedAt: new Date(),
      };

      const update = {
        $set: doc,
        $setOnInsert: {
          job_code: providedJobCode || generateJobCode(urlNormalized),
          createdAt: new Date(),
        },
      };
      if (providedJobCode) update.$set.job_code = providedJobCode;

      const result = await col.updateOne({ url_normalized: urlNormalized }, update, { upsert: true });
      if (result.upsertedCount) upserted++;
      else updated++;
    } catch (err) {
      console.error('[SyncJobs] Error upserting job:', err.message);
      errors++;
    }
  }

  console.log(`[SyncJobs] Done. Upserted: ${upserted}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  return { upserted, updated, skipped, total: records.length, errors };
}

function recordsFromBody(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.records)) return body.records;
  if (body && typeof body === 'object') return [body];
  return [];
}

/**
 * POST /api/sync/airtable
 * Manually trigger an Airtable sync
 */
router.post('/airtable', requireSyncSecret, async (req, res) => {
  try {
    console.log('📥 Manual Airtable sync requested...');
    await triggerSync();

    let recruiterResult = {
      skipped: true,
      reason: 'Airtable recruiter sync disabled. Use POST /sync/recruiters from n8n.',
    };

    if (process.env.ENABLE_AIRTABLE_RECRUITER_SYNC === 'true') {
      recruiterResult = await syncRecruiters().catch((e) => ({ error: e.message }));
    }

    res.json({
      success: true,
      message: 'Airtable sync completed',
      recruiters: recruiterResult,
      timestamp: new Date().toISOString(),
      status: getSyncStatus(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/sync/status
 * Get the current sync status
 */
router.get('/status', requireSyncSecret, (req, res) => {
  res.json({
    success: true,
    status: getSyncStatus(),
  });
});

/**
 * GET /api/sync/airtable/test
 * Test Airtable connection
 */
router.get('/airtable/test', requireSyncSecret, async (req, res) => {
  try {
    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!token || !baseId) {
      return res.status(400).json({
        success: false,
        error: 'Airtable credentials not configured',
      });
    }

    const jobsTable = process.env.AIRTABLE_JOBS_TABLE_ID || process.env.AIRTABLE_JOBS_TABLE || 'FreshJobs';
    const jobsView = process.env.AIRTABLE_JOBS_VIEW_ID || process.env.AIRTABLE_JOBS_VIEW || '';
    const params = new URLSearchParams({ maxRecords: '1' });
    if (jobsView) params.append('view', jobsView);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(jobsTable)}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        message: 'Airtable connection successful',
        recordCount: data.records?.length || 0,
      });
    } else {
      res.status(response.status).json({
        success: false,
        error: `Airtable API error: ${response.status} ${response.statusText}`,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});



router.post('/recruiters', requireSyncSecret, async (req, res) => {
  const records = recordsFromBody(req.body);
  if (!records.length) return res.status(400).json({ success: false, error: 'Recruiter record or records array required' });
  try {
    const result = await upsertRecruiters(records);
    res.json({
      success: true,
      message: 'Recruiters upserted into MongoDB',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/recruiters/apify', requireSyncSecret, (req, res) => {
  // The Apify run + polling can take many minutes — respond immediately so the
  // request doesn't sit open long enough for Cloudflare/Render to reset the connection.
  res.json({ success: true, message: 'Recruiter Apify sync started in the background', timestamp: new Date().toISOString() });
  runRecruiterApifyPipeline(req.body?.existingRunId)
    .then((result) => console.log('[RecruiterApify] Manual sync completed:', result))
    .catch((err) => console.error('[RecruiterApify] Manual sync failed:', err.message));
});

router.get('/recruiters/apify/status', requireSyncSecret, async (req, res) => {
  try {
    const Recruiter = require('../models/JobSeeker/jobSeeker.Recruiter');
    const [total, fromApify, mostRecent] = await Promise.all([
      Recruiter.countDocuments({}),
      Recruiter.countDocuments({ source: 'apify_linkedin_recruiters' }),
      Recruiter.findOne({ source: 'apify_linkedin_recruiters' }).sort({ lastSeenAt: -1 }).select('name company lastSeenAt sourceRunId').lean(),
    ]);
    res.json({ success: true, total, fromApify, mostRecent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/recruiters/maintenance', requireSyncSecret, async (req, res) => {
  try {
    const dedupe = await dedupeRecruiters();
    const reclassify = await reclassifyRecruiterSpecialties();
    res.json({
      success: true,
      message: 'Recruiter maintenance completed',
      dedupe,
      reclassify,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/import-recruiters', requireSyncSecret, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'records required' });
  try { res.json({ success: true, ...await upsertRecruiters(records) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/jobs', requireSyncSecret, async (req, res) => {
  const records = recordsFromBody(req.body);
  if (!records.length) return res.status(400).json({ success: false, error: 'Job record or records array required' });
  try {
    const result = await upsertJobs(records);
    res.json({ success: true, message: 'Jobs upserted into MongoDB', ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

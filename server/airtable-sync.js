#!/usr/bin/env node

/**
 * Airtable to MongoDB Sync Script
 * Syncs jobs and candidates from Airtable to MongoDB
 * Usage: node airtable-sync.js [--jobs] [--candidates] [--all]
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Configuration
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_JOBS_TABLE = process.env.AIRTABLE_JOBS_TABLE_ID || process.env.AIRTABLE_JOBS_TABLE || 'FreshJobs';
const AIRTABLE_JOBS_VIEW = process.env.AIRTABLE_JOBS_VIEW_ID || process.env.AIRTABLE_JOBS_VIEW || '';
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const MONGO_URI = process.env.DATABASE_URI || 'mongodb://localhost:27017/aon';
const crypto = require('crypto');

const validateAirtableConfig = () => {
  const missing = [];
  if (!AIRTABLE_BASE_ID) missing.push('AIRTABLE_BASE_ID');
  if (!AIRTABLE_TOKEN) missing.push('AIRTABLE_TOKEN');
  if (missing.length) {
    throw new Error(`${missing.join(', ')} environment variable${missing.length > 1 ? 's are' : ' is'} required for Airtable sync`);
  }
};

const normalizeUrl = (raw) => {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const first = trimmed.split(/\s+/)[0];
  try {
    const url = new URL(first.startsWith('http') ? first : `https://${first}`);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return '';
  }
};

const parseJobDate = (job) => {
  const raw = job?.date_posted || job?.datePosted || job?.postedAt || job?.postedDate || job?.prepared_at || job?.preparedAt || job?.createdAt;
  if (!raw) return 0;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  if (typeof raw === 'string') {
    const withZ = new Date(`${raw}Z`);
    if (!Number.isNaN(withZ.getTime())) return withZ.getTime();
  }
  if (!Number.isNaN(Number(raw))) {
    const asNum = new Date(Number(raw));
    if (!Number.isNaN(asNum.getTime())) return asNum.getTime();
  }
  return 0;
};

const hashValue = (value) => {
  if (!value) return '';
  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const splitLines = (text) =>
  String(text || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const extractSection = (text, headings) => {
  const lines = splitLines(text);
  if (!lines.length) return '';
  const headingSet = new Set(headings.map((h) => h.toLowerCase()));
  const headerRegex = new RegExp(`^(${headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(\\s*:)?$`, 'i');
  const stopRegex = /^(summary|skills|experience|work experience|professional experience|education|projects|certifications|additional|about|profile|highlights)\\b/i;

  let startIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const lower = lines[i].toLowerCase().replace(/:$/, '');
    if (headingSet.has(lower) || headerRegex.test(lines[i])) {
      startIndex = i + 1;
      break;
    }
  }
  if (startIndex === -1) return '';

  const collected = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (stopRegex.test(line) && collected.length > 0) break;
    collected.push(line);
    if (collected.length >= 6) break;
  }

  return collected.join(' ').trim();
};

const extractSkillsList = (text) => {
  const section = extractSection(text, ['skills', 'technical skills', 'core skills', 'skills & tools', 'tools']);
  if (!section) return [];
  return section
    .split(/[,•·|\u2022]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
};

const inferSeniorityFromText = (text) => {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('principal')) return 'principal';
  if (lower.includes('staff')) return 'staff';
  if (lower.includes('lead')) return 'lead';
  if (lower.includes('senior')) return 'senior';
  if (lower.includes('junior')) return 'junior';
  if (lower.includes('entry level') || lower.includes('entry-level')) return 'entry';
  return '';
};

const deriveResumeFields = (resumeText) => {
  if (!resumeText) return {};
  const education = extractSection(resumeText, ['education', 'education and training']);
  const work_experience = extractSection(resumeText, ['experience', 'work experience', 'professional experience', 'employment history']);
  const skills_2 = extractSkillsList(resumeText);
  const seniority = inferSeniorityFromText(resumeText);

  return {
    education,
    work_experience,
    skills_2,
    seniority,
  };
};

const updateAirtableCandidateFields = async (recordId, fields) => {
  const token = AIRTABLE_TOKEN;
  if (!AIRTABLE_BASE_ID) return { updated: false, reason: 'missing_base_id' };
  if (!token) return { updated: false, reason: 'missing_token' };
  if (!recordId || !fields || !Object.keys(fields).length) return { updated: false, reason: 'no_fields' };

  const response = await fetch(`${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${TABLES.CANDIDATES}/${recordId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    return { updated: false, reason: `airtable_error_${response.status}` };
  }

  return { updated: true };
};

// Table names and IDs in Airtable
const TABLES = {
  JOBS: AIRTABLE_JOBS_TABLE,
  CANDIDATES: 'Candidates',
  APPLICATIONS: 'Applications',
  SUBMISSIONS_LOG: 'SubmissionsLog',
  APPLY_QUEUE: 'ApplyQueue',
  CONTACTS: 'Contacts',
};

const TABLE_VIEWS = {
  [TABLES.JOBS]: AIRTABLE_JOBS_VIEW,
};

/**
 * Fetch records from Airtable with pagination
 */
async function fetchFromAirtable(tableName) {
  validateAirtableConfig();

  const records = [];
  let offset = null;
  const url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

  try {
    do {
      const params = new URLSearchParams();
      params.append('pageSize', '100');
      const view = TABLE_VIEWS[tableName];
      if (view) params.append('view', view);
      if (offset) params.append('offset', offset);

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      records.push(...data.records);
      offset = data.offset;

      // Rate limiting: Airtable allows 5 requests per second
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (offset);

    console.log(`✓ Fetched ${records.length} records from Airtable table: ${tableName}`);
    return records.map(record => ({
      airtableId: record.id,
      fields: record.fields,
    }));
  } catch (error) {
    console.error(`✗ Error fetching from Airtable (${tableName}):`, error.message);
    throw error;
  }
}

/**
 * Transform Airtable job record to MongoDB format
 */
function transformJob(airtableRecord) {
  const fields = airtableRecord.fields;

  const url = fields['url'] || '';

  return {
    job_code: fields['job_code'] || airtableRecord.airtableId,
    id: fields['id'],
    title: fields['title'] || '',
    company: fields['company'] || '',
    location: fields['location'] || '',
    salary: fields['salary'] || '',
    job_type: fields['job_type'] || '',
    url,
    url_normalized: normalizeUrl(url),
    date_posted: fields['date_posted'] || null,
    score: parseInt(fields['score']) || 0,
    description_short: fields['description_short'] || '',
    cover_letter: fields['cover_letter'] || '',
    tags: Array.isArray(fields['tags']) ? fields['tags'] : 
          (fields['tags'] ? fields['tags'].split(/[,;]/).map(s => s.trim()) : []),
    airtableId: airtableRecord.airtableId,
    source: 'airtable',
  };
}

/**
 * Transform Airtable candidate record to MongoDB format
 */
function transformCandidate(airtableRecord) {
  const fields = airtableRecord.fields;
  const resumeLink =
    fields['resume_link'] ||
    (Array.isArray(fields['resume']) && fields['resume'][0]?.url) ||
    '';
  const skills2Field = fields['skills 2'] || fields['skills_2'] || fields['skills2'];
  const skills2 = Array.isArray(skills2Field)
    ? skills2Field
    : (skills2Field ? String(skills2Field).split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []);

  return {
    candidate_id: fields['candidate_id'] || airtableRecord.airtableId,
    first_name: fields['first_name'] || '',
    last_name: fields['last_name'] || '',
    email: fields['email'] || '',
    phone: fields['phone'] || '',
    location: fields['location'] || '',
    target_role: fields['target_role'] || '',
    seniority: fields['seniority'] || '',
    skills: Array.isArray(fields['skills']) ? fields['skills'] : 
            (fields['skills'] ? fields['skills'].split(/[,;]/).map(s => s.trim()) : []),
    linkedin_url: fields['linkedin_url'] || '',
    portfolio_url: fields['portfolio_url'] || '',
    calendly_url: fields['calendly_url'] || '',
    status: fields['status'] || 'processing',
    paid_until: fields['paid_until'] || '',
    tokens_balance: parseInt(fields['tokens_balance']) || 100,
    tokens_used: parseInt(fields['tokens_used']) || 0,
    resume_link: resumeLink,
    resume_text: fields['resume_text'] || '',
    resume_updated_at: fields['resume_updated_at'] || fields['resume_updatedAt'] || '',
    resume_hash: fields['resume_hash'] || '',
    education: fields['education'] || '',
    work_experience: fields['work_experience'] || fields['work experience'] || '',
    skills_2: skills2,
    synced: fields['Synced'] || false,
    airtableId: airtableRecord.airtableId,
    source: 'airtable',
  };
}

/**
 * Transform Airtable application record to MongoDB format
 */
function transformApplication(airtableRecord) {
  const fields = airtableRecord.fields;

  return {
    key: fields['key'] || airtableRecord.airtableId,
    job_id: fields['job_id'] || '',
    email: fields['email'] || '',
    job_title: fields['job_title'] || '',
    company: fields['company'] || '',
    url: fields['url'] || '',
    location: fields['location'] || '',
    date_posted: fields['date_posted'],
    prepared_at: fields['prepared_at'] || '',
    status: fields['status'] || 'pending',
    resume_text: fields['resume_text'] || '',
    note: fields['note'] || '',
    job_description: fields['Job Description'] || '',
    airtableId: airtableRecord.airtableId,
    source: 'airtable',
  };
}

/**
 * Transform Airtable submissions log record to MongoDB format
 */
function transformSubmissionLog(airtableRecord) {
  const fields = airtableRecord.fields;

  return {
    submitted_at: fields['submitted_at'] || airtableRecord.airtableId,
    job_id: fields['job_id'] || '',
    email: fields['email'] || '',
    job_title: fields['job_title'] || '',
    company: fields['company'] || '',
    url: fields['url'] || '',
    location: fields['location'] || '',
    date_posted: fields['date_posted'],
    prepared_at: fields['prepared_at'],
    submit_status: fields['submit_status'] || 'applied',
    submit_note: fields['submit_note'] || '',
    application_id: fields['application_id'],
    airtableId: airtableRecord.airtableId,
    source: 'airtable',
  };
}

/**
 * Transform Airtable apply queue record to MongoDB format
 */
function transformApplyQueue(airtableRecord) {
  const fields = airtableRecord.fields;

  return {
    key: fields['key'] || airtableRecord.airtableId,
    job_id: fields['job_id'] || '',
    email: fields['email'] || '',
    paired_at: fields['paired_at'],
    status: fields['status'] || 'pending',
    job_title: fields['job_title'] || '',
    company: fields['company'] || '',
    url: fields['url'] || '',
    location: fields['location'] || '',
    date_posted: fields['date_posted'],
    prepared_at: fields['prepared_at'] || '',
    resume_text: fields['resume_text'] || '',
    airtableId: airtableRecord.airtableId,
    source: 'airtable',
  };
}

/**
 * Transform Airtable contact record to MongoDB format
 */
function transformContact(airtableRecord) {
  const fields = airtableRecord.fields;

  return {
    company: fields['company'] || airtableRecord.airtableId,
    name: fields['name'] || '',
    title: fields['title'] || '',
    email: fields['email'] || '',
    confidence: parseFloat(fields['confidence']) || 0,
    source: fields['source'] || 'unknown',
    last_verified_at: fields['last_verified_at'],
    airtableId: airtableRecord.airtableId,
    source_system: 'airtable',
  };
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    throw error;
  }
}

async function dedupeJobs() {
  const Job = mongoose.models.Job ||
    mongoose.model('Job', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }));

  const jobs = await Job.find({}, {
    job_code: 1,
    url: 1,
    url_normalized: 1,
    title: 1,
    company: 1,
    date_posted: 1,
    datePosted: 1,
    postedAt: 1,
    prepared_at: 1,
    preparedAt: 1,
    createdAt: 1
  }).lean().exec();

  const seen = new Map();
  const duplicates = [];

  for (const job of jobs) {
    const urlKey = job.url_normalized || normalizeUrl(job.url);
    const codeKey = job.job_code ? String(job.job_code).trim().toLowerCase() : '';
    const titleKey = job.title ? String(job.title).trim().toLowerCase() : '';
    const companyKey = job.company ? String(job.company).trim().toLowerCase() : '';
    const key = urlKey
      ? `url:${urlKey}`
      : codeKey
        ? `code:${codeKey}`
        : titleKey && companyKey
          ? `title:${titleKey}::${companyKey}`
          : '';

    if (!key) continue;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, job);
      continue;
    }

    const existingDate = parseJobDate(existing);
    const currentDate = parseJobDate(job);
    if (currentDate >= existingDate) {
      duplicates.push(existing._id);
      seen.set(key, job);
    } else {
      duplicates.push(job._id);
    }
  }

  if (!duplicates.length) {
    console.log('✓ Dedup: no duplicates found');
    return { removed: 0 };
  }

  const chunks = [];
  while (duplicates.length) {
    chunks.push(duplicates.splice(0, 500));
  }

  let removed = 0;
  for (const chunk of chunks) {
    const res = await Job.deleteMany({ _id: { $in: chunk } });
    removed += res.deletedCount || 0;
  }

  console.log(`✓ Dedup: removed ${removed} duplicate jobs`);
  return { removed };
}

async function purgeOldJobs(days = 60) {
  const Job = mongoose.models.Job ||
    mongoose.model('Job', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }));

  const jobs = await Job.find({}, {
    date_posted: 1,
    datePosted: 1,
    postedAt: 1,
    postedDate: 1,
    prepared_at: 1,
    preparedAt: 1,
    createdAt: 1
  }).lean().exec();

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const expiredIds = [];

  for (const job of jobs) {
    const ts = parseJobDate(job);
    if (!ts) continue;
    if (ts < cutoff) {
      expiredIds.push(job._id);
    }
  }

  if (!expiredIds.length) {
    console.log('✓ Purge Jobs: none older than cutoff');
    return { removed: 0 };
  }

  const chunks = [];
  while (expiredIds.length) {
    chunks.push(expiredIds.splice(0, 500));
  }

  let removed = 0;
  for (const chunk of chunks) {
    const res = await Job.deleteMany({ _id: { $in: chunk } });
    removed += res.deletedCount || 0;
  }

  console.log(`✓ Purge Jobs: removed ${removed} jobs older than ${days} days`);
  return { removed };
}

async function expireOldApplications(days = 30) {
  const Application = mongoose.models.Application ||
    mongoose.model('Application', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.applications' }));

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const apps = await Application.find({
    status: { $ne: 'expired' },
    $or: [
      { prepared_at: { $exists: true } },
      { preparedAt: { $exists: true } },
      { paired_at: { $exists: true } },
      { pairedAt: { $exists: true } }
    ]
  }).lean().exec();

  const expiredIds = [];
  for (const app of apps) {
    const raw = app.prepared_at || app.preparedAt || app.paired_at || app.pairedAt || '';
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < cutoff) {
      expiredIds.push(app._id);
    }
  }

  if (!expiredIds.length) {
    console.log('✓ Expire Applications: none expired');
    return { expired: 0 };
  }

  const res = await Application.updateMany(
    { _id: { $in: expiredIds } },
    { $set: { status: 'expired', expired_at: new Date().toISOString() } }
  );

  console.log(`✓ Expire Applications: ${res.modifiedCount || 0} marked expired`);
  return { expired: res.modifiedCount || 0 };
}

/**
 * Sync jobs from Airtable to MongoDB
 */
async function syncJobs() {
  try {
    console.log('\n📥 Syncing jobs from Airtable...');
    const airtableJobs = await fetchFromAirtable(TABLES.JOBS);

    if (airtableJobs.length === 0) {
      console.log('ℹ No jobs to sync');
      return { created: 0, updated: 0, total: 0 };
    }

    // Get the Job model - using dynamic schema since we don't have the model defined
    const Job = mongoose.models.Job || 
                mongoose.model('Job', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }));

    let created = 0;
    let updated = 0;
    let skippedOld = 0;
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (const airtableJob of airtableJobs) {
      const jobData = transformJob(airtableJob);
      const ts = parseJobDate(jobData);
      if (ts && ts < cutoff) {
        skippedOld++;
        continue;
      }

      try {
        const query = { $or: [] };
        if (jobData.airtableId) query.$or.push({ airtableId: jobData.airtableId });
        if (jobData.job_code) query.$or.push({ job_code: jobData.job_code });
        if (jobData.url_normalized) query.$or.push({ url_normalized: jobData.url_normalized });
        if (jobData.url && !jobData.url_normalized) query.$or.push({ url: jobData.url });

        if (!query.$or.length) {
          query.$or.push({ _id: jobData.airtableId });
        }

        const result = await Job.findOneAndUpdate(
          query,
          jobData,
          { upsert: true, new: true, runValidators: false }
        );

        if (!result.__v || result.__v === 0) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.warn(`⚠ Error syncing job ${jobData.job_code}:`, error.message);
      }
    }

    console.log(`✓ Synced jobs: ${created} created, ${updated} updated (${skippedOld} skipped old, Total: ${airtableJobs.length})`);
    return { created, updated, total: airtableJobs.length, skippedOld };
  } catch (error) {
    console.error('✗ Error syncing jobs:', error.message);
    throw error;
  }
}

/**
 * Sync candidates from Airtable to MongoDB
 */
async function syncCandidates() {
  try {
    console.log('\n📥 Syncing candidates from Airtable...');
    const airtableCandidates = await fetchFromAirtable(TABLES.CANDIDATES);

    if (airtableCandidates.length === 0) {
      console.log('ℹ No candidates to sync');
      return { created: 0, updated: 0, total: 0 };
    }

    const Candidate = mongoose.models.Candidate || 
                      mongoose.model('Candidate', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.candidates' }));

    let created = 0;
    let updated = 0;

    for (const airtableCandidate of airtableCandidates) {
      const candidateData = transformCandidate(airtableCandidate);

      try {
        const lookupQuery = { $or: [] };
        if (candidateData.airtableId) lookupQuery.$or.push({ airtableId: candidateData.airtableId });
        if (candidateData.email) lookupQuery.$or.push({ email: candidateData.email });
        if (!lookupQuery.$or.length) lookupQuery.$or.push({ _id: candidateData.candidate_id });

        // MongoDB is the source of truth for candidate profile data.
        // For existing candidates: only sync airtableId for record linking.
        // For new candidates (upsert insert): seed all Airtable fields.
        const seedPayload = { ...candidateData };
        const incomingText = candidateData.resume_text || '';
        if (incomingText) {
          const derived = deriveResumeFields(incomingText);
          if (!seedPayload.education && derived.education) seedPayload.education = derived.education;
          if (!seedPayload.work_experience && derived.work_experience) seedPayload.work_experience = derived.work_experience;
          if ((!seedPayload.skills_2 || !seedPayload.skills_2.length) && derived.skills_2?.length) seedPayload.skills_2 = derived.skills_2;
          if (!seedPayload.seniority && derived.seniority) seedPayload.seniority = derived.seniority;
          seedPayload.resume_hash = candidateData.resume_hash || hashValue(incomingText);
        }

        const result = await Candidate.findOneAndUpdate(
          lookupQuery,
          {
            // Always update airtableId so we can link records
            $set: { airtableId: candidateData.airtableId },
            // Only set profile fields on first insert — never overwrite user's MongoDB data
            $setOnInsert: seedPayload,
          },
          { upsert: true, new: false, runValidators: false }
        );

        if (!result) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.warn(`⚠ Error syncing candidate ${candidateData.candidateId}:`, error.message);
      }
    }

    console.log(`✓ Synced candidates: ${created} created, ${updated} updated (Total: ${airtableCandidates.length})`);
    return { created, updated, total: airtableCandidates.length };
  } catch (error) {
    console.error('✗ Error syncing candidates:', error.message);
    throw error;
  }
}

/**
 * Sync applications from Airtable to MongoDB
 */
async function syncApplications() {
  try {
    console.log('\n📥 Syncing applications from Airtable...');
    const airtableApplications = await fetchFromAirtable(TABLES.APPLICATIONS);

    if (airtableApplications.length === 0) {
      console.log('ℹ No applications to sync');
      return { created: 0, updated: 0, total: 0 };
    }

    const Application = mongoose.models.Application || 
                        mongoose.model('Application', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.applications' }));

    let created = 0;
    let updated = 0;

    for (const airtableApp of airtableApplications) {
      const appData = transformApplication(airtableApp);

      try {
        const result = await Application.findOneAndUpdate(
          { airtableId: appData.airtableId },
          appData,
          { upsert: true, new: true, runValidators: false }
        );

        if (!result.__v || result.__v === 0) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.warn(`⚠ Error syncing application ${appData.key}:`, error.message);
      }
    }

    console.log(`✓ Synced applications: ${created} created, ${updated} updated (Total: ${airtableApplications.length})`);
    return { created, updated, total: airtableApplications.length };
  } catch (error) {
    console.error('✗ Error syncing applications:', error.message);
    throw error;
  }
}

/**
 * Sync submission logs from Airtable to MongoDB
 */
async function syncSubmissionLogs() {
  try {
    console.log('\n📥 Syncing submission logs from Airtable...');
    const airtableLogs = await fetchFromAirtable(TABLES.SUBMISSIONS_LOG);

    if (airtableLogs.length === 0) {
      console.log('ℹ No submission logs to sync');
      return { created: 0, updated: 0, total: 0 };
    }

    const SubmissionLog = mongoose.models.SubmissionLog || 
                          mongoose.model('SubmissionLog', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.submissionlogs' }));

    let created = 0;
    let updated = 0;

    for (const airtableLog of airtableLogs) {
      const logData = transformSubmissionLog(airtableLog);

      try {
        const result = await SubmissionLog.findOneAndUpdate(
          { airtableId: logData.airtableId },
          logData,
          { upsert: true, new: true, runValidators: false }
        );

        if (!result.__v || result.__v === 0) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.warn(`⚠ Error syncing submission log:`, error.message);
      }
    }

    console.log(`✓ Synced submission logs: ${created} created, ${updated} updated (Total: ${airtableLogs.length})`);
    return { created, updated, total: airtableLogs.length };
  } catch (error) {
    console.error('✗ Error syncing submission logs:', error.message);
    throw error;
  }
}

/**
 * Sync apply queue from Airtable to MongoDB
 */
async function syncApplyQueue() {
  try {
    console.log('\n📥 Syncing apply queue from Airtable...');
    const airtableQueue = await fetchFromAirtable(TABLES.APPLY_QUEUE);

    if (airtableQueue.length === 0) {
      console.log('ℹ No apply queue items to sync');
      return { created: 0, updated: 0, total: 0 };
    }

    const ApplyQueue = mongoose.models.ApplyQueue || 
                       mongoose.model('ApplyQueue', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.applyqueue' }));

    let created = 0;
    let updated = 0;

    for (const airtableItem of airtableQueue) {
      const queueData = transformApplyQueue(airtableItem);

      try {
        const result = await ApplyQueue.findOneAndUpdate(
          { airtableId: queueData.airtableId },
          queueData,
          { upsert: true, new: true, runValidators: false }
        );

        if (!result.__v || result.__v === 0) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.warn(`⚠ Error syncing apply queue item ${queueData.key}:`, error.message);
      }
    }

    console.log(`✓ Synced apply queue: ${created} created, ${updated} updated (Total: ${airtableQueue.length})`);
    return { created, updated, total: airtableQueue.length };
  } catch (error) {
    console.error('✗ Error syncing apply queue:', error.message);
    throw error;
  }
}

/**
 * Sync contacts from Airtable to MongoDB
 */
async function syncContacts() {
  try {
    console.log('\n📥 Syncing contacts from Airtable...');
    const airtableContacts = await fetchFromAirtable(TABLES.CONTACTS);

    if (airtableContacts.length === 0) {
      console.log('ℹ No contacts to sync');
      return { created: 0, updated: 0, total: 0 };
    }

    const Contact = mongoose.models.Contact || 
                    mongoose.model('Contact', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.contacts' }));

    let created = 0;
    let updated = 0;

    for (const airtableContact of airtableContacts) {
      const contactData = transformContact(airtableContact);

      try {
        const result = await Contact.findOneAndUpdate(
          { airtableId: contactData.airtableId },
          contactData,
          { upsert: true, new: true, runValidators: false }
        );

        if (!result.__v || result.__v === 0) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.warn(`⚠ Error syncing contact ${contactData.company}:`, error.message);
      }
    }

    console.log(`✓ Synced contacts: ${created} created, ${updated} updated (Total: ${airtableContacts.length})`);
    return { created, updated, total: airtableContacts.length };
  } catch (error) {
    console.error('✗ Error syncing contacts:', error.message);
    throw error;
  }
}

/**
 * Backfill application links after Airtable sync.
 * Ensures application docs have candidateId + jobId for UI matching.
 */
async function backfillApplicationLinks() {
  const db = mongoose.connection.db;
  const candidatesCol = db.collection('jobseeker.candidates');
  const jobsCol = db.collection('jobseeker.jobs');
  const appsCol = db.collection('jobseeker.applications');

  const [candidates, jobs] = await Promise.all([
    candidatesCol.find({}, { projection: { _id: 1, email: 1 } }).toArray(),
    jobsCol.find({}, { projection: { _id: 1, job_code: 1, airtableId: 1 } }).toArray(),
  ]);

  const candidateByEmail = new Map(
    candidates
      .filter((c) => c?.email)
      .map((c) => [String(c.email).toLowerCase(), c._id])
  );

  const jobByKey = new Map();
  for (const job of jobs) {
    if (job?.airtableId) jobByKey.set(String(job.airtableId), job._id);
    if (job?.job_code) jobByKey.set(String(job.job_code), job._id);
  }

  const cursor = appsCol.find({
    $or: [{ candidateId: { $exists: false } }, { jobId: { $exists: false } }],
  });

  let updated = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    const app = await cursor.next();
    if (!app) break;

    const email = String(app.email || '').toLowerCase();
    const candidateId = candidateByEmail.get(email);
    const jobKey = app.job_id || app.jobId || app.job_code || app.airtableId;
    const jobId = jobKey ? jobByKey.get(String(jobKey)) : null;

    if (!candidateId || !jobId) {
      skipped++;
      continue;
    }

    const res = await appsCol.updateOne(
      { _id: app._id },
      { $set: { candidateId, jobId } }
    );

    if (res.modifiedCount === 1) updated++;
  }

  console.log(`✓ Backfilled applications: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
}

/**
 * Main sync function
 */
async function sync(options = {}) {
  let results = { 
    jobs: null, 
    candidates: null, 
    applications: null,
    submissions: null,
    queue: null,
    contacts: null,
    applicationLinks: null,
  };

  try {
    await connectDB();
    console.log('\n🔄 Starting Airtable sync...');
    console.log(`📍 Airtable Base: ${AIRTABLE_BASE_ID}`);

    // Default to all if nothing specified
    if (!options.jobs && !options.candidates && !options.applications && !options.submissions && !options.queue && !options.contacts && !options.all) {
      options.all = true;
    }

    // Sync each table independently - continue even if one fails
    if (options.all || options.jobs) {
      try {
        results.jobs = await syncJobs();
      } catch (error) {
        console.error(`⚠️  Jobs sync failed: ${error.message}`);
      }
    }

    if (options.all || options.candidates) {
      try {
        results.candidates = await syncCandidates();
      } catch (error) {
        console.error(`⚠️  Candidates sync failed: ${error.message}`);
      }
    }

    if (options.all || options.applications) {
      try {
        results.applications = await syncApplications();
      } catch (error) {
        console.error(`⚠️  Applications sync failed: ${error.message}`);
      }
    }

    if (options.all || options.submissions) {
      try {
        results.submissions = await syncSubmissionLogs();
      } catch (error) {
        console.error(`⚠️  Submission logs sync failed: ${error.message}`);
      }
    }

    if (options.all || options.queue) {
      try {
        results.queue = await syncApplyQueue();
      } catch (error) {
        console.error(`⚠️  Apply queue sync failed: ${error.message}`);
      }
    }

    if (options.all || options.contacts) {
      try {
        results.contacts = await syncContacts();
      } catch (error) {
        console.error(`⚠️  Contacts sync failed: ${error.message}`);
      }
    }

    try {
      results.applicationLinks = await backfillApplicationLinks();
    } catch (error) {
      console.error(`⚠️  Application link backfill failed: ${error.message}`);
    }

    console.log('\n✅ Sync completed!');
    console.log(`\n📊 Summary:`);
    Object.entries(results).forEach(([key, value]) => {
      if (value) {
        if (key === 'applicationLinks') {
          const pluralKey = key.charAt(0).toUpperCase() + key.slice(1);
          console.log(`  - ${pluralKey}: ${value.updated} updated, ${value.skipped} skipped`);
          return;
        }
        const pluralKey = key.charAt(0).toUpperCase() + key.slice(1);
        console.log(`  - ${pluralKey}: ${value.created} created, ${value.updated} updated (${value.total} total)`);
      } else {
        const pluralKey = key.charAt(0).toUpperCase() + key.slice(1);
        console.log(`  - ${pluralKey}: ⚠️  Failed to sync`);
      }
    });

    return results;
  } catch (error) {
    console.error('\n❌ Critical error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    all: args.includes('--all'),
    jobs: args.includes('--jobs'),
    candidates: args.includes('--candidates'),
    applications: args.includes('--applications'),
    submissions: args.includes('--submissions'),
    queue: args.includes('--queue'),
    contacts: args.includes('--contacts'),
  };

  sync(options).then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { sync, syncJobs, syncCandidates, syncApplications, syncSubmissionLogs, syncApplyQueue, syncContacts, backfillApplicationLinks, dedupeJobs, purgeOldJobs, expireOldApplications };

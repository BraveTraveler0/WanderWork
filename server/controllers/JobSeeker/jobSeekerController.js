const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const dbUtils = require('../../utils/dbUtils.js');
const Candidates = require('../../models/JobSeeker/jobSeeker.Candidate.js');
const Jobs = require('../../models/JobSeeker/jobSeeker.Job.js');
const Contacts = require('../../models/JobSeeker/jobSeekerContact.js');
const Applications = require('../../models/JobSeeker/jobSeeker.Application.js');
const CandidateJobPairings = require('../../models/JobSeeker/jobSeeker.CandidateJobPairing.js');
const ContactJobPairings = require('../../models/JobSeeker/jobSeekerContactJobPairing.js');
const { pairCandidateJobs, pairAllCandidates } = require('../../services/jobPairingService.js');
// ── Junk job detection (shared between read-time filter and DB purge) ─────────
function isJunkJobRecord(job) {
    // Check all possible title field names used by scrapers
    const title = (job.title || job.job_title || job.name || '').trim()
    // "7,000+ Digital Designer jobs in United States" / "13,000+ Marketing Designer jobs"
    if (/^\d[\d,]*\+?\s+.+\bjobs?\b/i.test(title)) return true
    // "Best Remote UX Designer Jobs in NYC, NY 2026"
    if (/\bbest\b.+\bjobs?\b/i.test(title)) return true
    // Any title containing "jobs in [place]" with a 4-digit year — search listing pages
    if (/\bjobs?\b.+\bin\b.+\d{4}/i.test(title)) return true
    // Aggregator headings starting with a digit: "13,000 Marketing jobs"
    if (/\bjobs?\s+in\b/i.test(title) && /^\d/.test(title)) return true
    // "Job Application for [role]" — fake aggregator titles
    if (/^job\s+application\s+for\b/i.test(title)) return true
    const desc = [job.description_short, job.shortDescription, job.summary, job.description, job.why_matched].filter(Boolean).join(' ')
    if (/skip\s+to\s+main\s+content/i.test(desc)) return true
    if (/why\s+you\s+were\s+matched/i.test(desc)) return true
    // "Reposted/Posted 16 Days AgoSave/AgoSaved" — metadata bleeding into description
    if (/(?:re)?posted\s+\d+\s+days?\s+ago\s*saved?\b/i.test(desc)) return true
    if (/\d+\s+days?\s+ago\s*saved?\b/i.test(desc)) return true
    // "Any time (N,NNN)" — LinkedIn search facet text
    if (/\bany\s+time\s+\(\d[\d,]+\)/i.test(desc)) return true
    // Cookie/privacy/terms policy pages scraped instead of a real job description
    if (/\bthis\s+(?:cookie|privacy)\s+policy\b/i.test(desc)) return true
    if (/\bterms\s+(?:of\s+service|and\s+conditions)\b.{0,200}applies\s+to/i.test(desc)) return true
    // Three or more facet-count patterns "(13,334)" "(10,745)"
    const facetCounts = (desc.match(/\(\d[\d,]{2,}\)/g) || []).length
    if (facetCounts >= 3) return true
    return false
}

// ── Resume field extraction — used at startup backfill and per-request ────────
function deriveResumeFields(resumeText) {
    if (!resumeText) return { workExperience: '', education: '' }
    const lines = resumeText.split(/\r?\n/)
    const WORK_HEADINGS = [
        'experience', 'work experience', 'professional experience', 'employment history',
        'employment', 'work history', 'career history', 'relevant experience',
    ]
    const EDU_HEADINGS = [
        'education', 'education and training', 'academic background',
        'academic history', 'qualifications',
    ]
    const ALL_HEADINGS = [
        ...WORK_HEADINGS, ...EDU_HEADINGS,
        'summary', 'professional summary', 'objective', 'profile', 'about', 'highlights',
        'skills', 'technical skills', 'core competencies', 'key skills',
        'projects', 'portfolio', 'certifications', 'licenses', 'credentials',
        'awards', 'achievements', 'honors', 'publications', 'references', 'additional',
        'volunteer', 'languages', 'interests', 'activities',
    ]
    const makeRe = (arr) => new RegExp(
        `^(?:${arr.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:\\-]?\\s*$`,
        'i'
    )
    const allSectionRe = makeRe(ALL_HEADINGS)
    const extract = (headingRe) => {
        let start = -1
        for (let i = 0; i < lines.length; i++) {
            if (headingRe.test(lines[i].trim())) { start = i + 1; break }
        }
        if (start < 0) return ''
        const out = []
        for (let i = start; i < lines.length; i++) {
            const trimmed = lines[i].trim()
            // Stop only at exact section headings — not at content that starts with those words
            if (out.length > 0 && allSectionRe.test(trimmed) && !headingRe.test(trimmed)) break
            out.push(lines[i])
        }
        while (out.length && !out[out.length - 1].trim()) out.pop()
        return out.join('\n').trim()
    }
    return {
        workExperience: extract(makeRe(WORK_HEADINGS)),
        education: extract(makeRe(EDU_HEADINGS)),
    }
}

// Extracts work_experience and education from resume_text for candidates missing those fields.
async function backfillCandidateResumeFields() {
    try {
        const candidates = await Candidates.find(
            { resume_text: { $exists: true, $ne: '' } },
            { _id: 1, resume_text: 1, work_experience: 1, education: 1 }
        ).lean().exec()
        let updated = 0
        for (const candidate of candidates) {
            if (candidate.work_experience && candidate.education) continue
            const { workExperience, education } = deriveResumeFields(candidate.resume_text)
            const update = {}
            if (workExperience && !candidate.work_experience) update.work_experience = workExperience
            if (education && !candidate.education) update.education = education
            if (!Object.keys(update).length) continue
            await Candidates.updateOne({ _id: candidate._id }, { $set: update })
            updated++
        }
        if (updated > 0) console.log(`[backfillCandidateResumeFields] Updated ${updated} candidate(s) with extracted resume fields`)
    } catch (e) {
        console.warn('[backfillCandidateResumeFields] Failed:', e.message)
    }
}

// Deletes all junk jobs from the DB — call once at startup.
async function purgeJunkJobs() {
    try {
        const JobDynamic = mongoose.models.JobDynamic ||
            mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }))
        const all = await JobDynamic.find({}, { _id: 1, title: 1, description_short: 1, shortDescription: 1, summary: 1, description: 1 }).lean().exec()
        const junkIds = all.filter(isJunkJobRecord).map((j) => j._id)
        if (junkIds.length === 0) return
        const result = await JobDynamic.deleteMany({ _id: { $in: junkIds } })
        console.log(`[purgeJunkJobs] Deleted ${result.deletedCount} junk job record(s)`)
    } catch (e) {
        console.warn('[purgeJunkJobs] Failed:', e.message)
    }
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const RESUME_EXTRACT_WEBHOOK = process.env.N8N_RESUME_EXTRACT_WEBHOOK_URL || '';
const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 8000}`;
const CUSTOM_REQUEST_WEBHOOK = process.env.N8N_CUSTOM_REQUEST_WEBHOOK_URL || '';

async function updateAirtableCandidateSkills(candidate, skills) {
    if (!AIRTABLE_TOKEN) return { updated: false, reason: 'missing_token' };
    if (!AIRTABLE_BASE_ID) return { updated: false, reason: 'missing_base_id' };
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Candidates`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    const fields = { skills };
    const recordId = candidate.airtableId;

    if (recordId) {
        const response = await fetch(`${baseUrl}/${recordId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'airtableId' };
    }

    if (candidate.email) {
        const filter = encodeURIComponent(`LOWER({email})=LOWER('${candidate.email}')`);
        const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
        if (!lookup.ok) {
            return { updated: false, reason: `airtable_lookup_${lookup.status}` };
        }
        const data = await lookup.json();
        const first = data?.records?.[0];
        if (!first?.id) return { updated: false, reason: 'airtable_not_found' };
        const response = await fetch(`${baseUrl}/${first.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'email_lookup' };
    }

    return { updated: false, reason: 'missing_identifier' };
}

async function updateAirtableCandidateResume(candidate, resumeLink) {
    if (!AIRTABLE_TOKEN) return { updated: false, reason: 'missing_token' };
    if (!candidate) return { updated: false, reason: 'missing_candidate' };
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Candidates`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    const fields = {
        resume_link: resumeLink || '',
        resume_text: ''
    };

    if (candidate.airtableId) {
        const response = await fetch(`${baseUrl}/${candidate.airtableId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'airtableId' };
    }

    if (candidate.email) {
        const filter = encodeURIComponent(`LOWER({email})=LOWER('${candidate.email}')`);
        const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
        if (!lookup.ok) {
            return { updated: false, reason: `airtable_lookup_${lookup.status}` };
        }
        const data = await lookup.json();
        const first = data?.records?.[0];
        if (!first?.id) return { updated: false, reason: 'airtable_not_found' };
        const response = await fetch(`${baseUrl}/${first.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'email_lookup' };
    }

    return { updated: false, reason: 'missing_identifier' };
}

const UNKNOWN_COMPANY_VALUES = new Set([
    'unknown', 'n/a', 'na', 'none', 'null', 'undefined', '-', 'company', 'company name', 'join',
    'creative agency', 'agency', 'ai', 'salary', 'compensation', 'benefits', 'pay', 'not specified',
    'not available', 'name'
]);

const GENERIC_COMPANY_WORDS = new Set([
    'unknown', 'company', 'agency', 'creative', 'studio', 'firm', 'startup', 'team', 'remote',
    'hybrid', 'ai', 'design', 'designer', 'developer', 'engineer', 'manager', 'director', 'lead',
    'senior', 'junior', 'staff', 'principal', 'freelance', 'contract', 'full', 'time', 'part',
    'position', 'role', 'job', 'careers', 'opportunity', 'ui', 'ux', 'salary', 'compensation',
    'benefits', 'pay'
]);

const TECH_STACK_WORDS = new Set([
    'javascript', 'typescript', 'react', 'reactjs', 'vue', 'angular', 'node', 'nodejs', 'deno',
    'express', 'next', 'nextjs', 'nuxt', 'svelte', 'sveltekit', 'jquery', 'bootstrap', 'tailwind',
    'webpack', 'vite', 'rollup', 'babel', 'graphql', 'rest', 'api', 'aws', 'azure', 'gcp', 'docker',
    'kubernetes', 'terraform', 'python', 'java', 'c', 'c++', 'c#', 'php', 'ruby', 'rails', 'go',
    'golang', 'rust', 'swift', 'kotlin', 'dart', 'flutter', 'ios', 'android', 'figma', 'sketch',
    'adobe', 'photoshop', 'illustrator', 'xd', 'sql', 'postgres', 'postgresql', 'mysql', 'mongodb'
]);

const ATS_PLATFORMS = new Set([
    'greenhouse', 'lever', 'workday', 'myworkdayjobs', 'ashbyhq', 'ashby', 'smartrecruiters',
    'applytojob', 'jobvite', 'icims', 'jazz', 'recruitee', 'bamboohr', 'indeed', 'linkedin',
    'glassdoor', 'monster', 'ziprecruiter', 'wellfound', 'angellist', 'careers', 'jobs',
    'workable', 'personio', 'teamtailor'
]);

const isRomanNumeral = (value) => /^[IVXLCDM]+$/i.test(value);

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ');

const normalizeText = (value) => stripHtml(value).replace(/\s+/g, ' ').trim();

const splitWords = (value) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const hasEnoughLetters = (value) => {
    const letters = (value.match(/[A-Za-z]/g) || []).length;
    const digits = (value.match(/\d/g) || []).length;
    if (letters === 0) return false;
    if (digits > letters) return false;
    return true;
};

const stripCompanyLabels = (value) => {
    if (!value) return '';
    let cleaned = String(value).trim();
    const nameIndex = cleaned.search(/company\s*name\s*[:\-]/i);
    if (nameIndex >= 0) {
        cleaned = cleaned.slice(nameIndex).replace(/company\s*name\s*[:\-]\s*/i, '').trim();
    } else {
        const labelMatch = cleaned.match(/^(?:company\s*name|company|name)\s*[:\-]\s*(.+)$/i);
        if (labelMatch) {
            cleaned = String(labelMatch[1] || '').trim();
        }
    }
    cleaned = cleaned.replace(/^(?:salary|compensation|benefits|pay)\s*[:\-]\s*/i, '').trim();
    const cutoff = cleaned.match(/^(.*?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i);
    if (cutoff) {
        cleaned = String(cutoff[1] || '').trim();
    }
    return cleaned;
};

const getJobDescription = (job) => {
    const candidates = [
        job.description,
        job.shortDescription,
        job.jobDescription,
        job.summary,
        job.description_short,
        job.descriptionShort,
        job.longDescription,
        job.job_description,
        job.description_text,
        job.jobDescriptionText,
        job.Job_Description
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate === 'string') {
            const normalized = normalizeText(candidate);
            if (normalized.length >= 10) return normalized;
        }
        if (Array.isArray(candidate)) {
            const normalized = normalizeText(candidate.filter(Boolean).join(' '));
            if (normalized.length >= 10) return normalized;
        }
        if (candidate && typeof candidate === 'object') {
            const values = Object.values(candidate).filter((v) => typeof v === 'string');
            const normalized = normalizeText(values.join(' '));
            if (normalized.length >= 10) return normalized;
        }
    }
    return '';
};

const looksLikeCompany = (value, titleWords) => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.length < 3 && !/^[A-Z]{2,3}$/.test(trimmed)) return false;
    if (isRomanNumeral(trimmed)) return false;
    if (!hasEnoughLetters(trimmed)) return false;
    if (/\bday\s+week\b/i.test(trimmed)) return false;
    if (/\bsalary\b|\bcompensation\b|\bbenefits\b|\bpay\b/i.test(trimmed)) return false;
    if (/[\\/]/.test(trimmed)) return false;
    const words = splitWords(trimmed);
    if (!words.length) return false;
    if (words.every((word) => GENERIC_COMPANY_WORDS.has(word))) return false;
    if (words.every((word) => TECH_STACK_WORDS.has(word))) return false;
    if (titleWords && words.every((word) => titleWords.has(word))) return false;
    return true;
};

const normalizeCompanyValue = (value, titleWords) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    let cleaned = trimmed.replace(/^[\"'“”‘’]+|[\"'“”‘’,.;:]+$/g, '').trim();
    cleaned = stripCompanyLabels(cleaned);
    const lowered = cleaned.toLowerCase();
    if (UNKNOWN_COMPANY_VALUES.has(lowered)) return '';
    if (isRomanNumeral(cleaned)) return '';
    if (!hasEnoughLetters(cleaned)) return '';
    if (/^\d+$/.test(cleaned)) return '';
    if (/\bday\s+week\b/i.test(cleaned)) return '';
    if (/\bsalary\b|\bcompensation\b|\bbenefits\b|\bpay\b/i.test(cleaned)) return '';
    if (/[\\/]/.test(cleaned)) return '';
    const joinMatch = cleaned.match(/^(?:join|at|with)\s+(.+)$/i);
    if (joinMatch && looksLikeCompany(joinMatch[1], titleWords)) {
        return joinMatch[1].trim();
    }
    return cleaned;
};

const isUnknownCompany = (value, title) => {
    if (!value) return true;
    const trimmed = value.trim();
    if (!trimmed) return true;
    const lowered = trimmed.toLowerCase();
    if (/^company\s*name\b/.test(lowered) || /^company\b/.test(lowered)) return true;
    if (UNKNOWN_COMPANY_VALUES.has(lowered)) return true;
    if (isRomanNumeral(trimmed)) return true;
    if (!hasEnoughLetters(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (/\bday\s+week\b/i.test(trimmed)) return true;
    if (/\bsalary\b|\bcompensation\b|\bbenefits\b|\bpay\b/i.test(trimmed)) return true;
    if (/[\\/]/.test(trimmed)) return true;
    const words = splitWords(trimmed);
    if (!words.length) return true;
    const titleWords = new Set(splitWords(title || ''));
    if (words.every((word) => GENERIC_COMPANY_WORDS.has(word) || titleWords.has(word))) return true;
    if (words.every((word) => TECH_STACK_WORDS.has(word) || titleWords.has(word))) return true;
    return false;
};

const inferCompanyFromUrl = (url) => {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./i, '');
        const parts = host.split('.').filter(Boolean);
        if (!parts.length) return '';
        const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        if (ATS_PLATFORMS.has(root.toLowerCase())) return '';
        return root
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    } catch {
        return '';
    }
};

const inferCompanyFromDescription = (description, title) => {
    if (!description) return '';
    const text = normalizeText(description);
    if (!text) return '';

    const titleWords = new Set(splitWords(title || ''));

    const patterns = [
        /(?:^|[.!?\n]\s*)(?:at|with|join)\s+([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})/,
        /company\s*name\s*[:\-]\s*([A-Za-z0-9][^.\n\r]+?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i,
        /company\s*[:\-]\s*([A-Za-z0-9][^.\n\r]+?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i,
        /name\s*[:\-]\s*([A-Za-z0-9][^.\n\r]+?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i,
        /\b([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})\s+as\s+(?:a|an|the)\b/,
        /(?:^|[.!?\n]\s*)(?:company|company overview|about)\s*[:\-]?\s*([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})/,
        /\b([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})\s+(?:is|are|was|were)\s+(?:a|an|the)\b/,
        /\b([A-Z]{2,}(?:\s+[A-Z]{2,}){0,3})\b/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const candidate = normalizeCompanyValue(match[1], titleWords);
            if (candidate && looksLikeCompany(candidate, titleWords)) return candidate;
        }
    }

    const counts = new Map();
    const capsPattern = /\b([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,3})\b/g;
    let found = capsPattern.exec(text);
    while (found) {
        const candidate = normalizeCompanyValue(found[1], titleWords);
        if (candidate && looksLikeCompany(candidate, titleWords)) {
            counts.set(candidate, (counts.get(candidate) || 0) + 1);
        }
        found = capsPattern.exec(text);
    }

    let best = '';
    let bestCount = 0;
    for (const [candidate, count] of counts.entries()) {
        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    }

    return best;
};

const inferCompanyName = (job) => {
    const title = job?.title || '';
    const titleWords = new Set(splitWords(title));
    const normalizedCompany = normalizeCompanyValue(job?.company || '', titleWords);
    if (normalizedCompany && normalizedCompany !== job?.company?.trim()) return normalizedCompany;
    if (!isUnknownCompany(job?.company, title)) return job?.company?.trim() || '';
    const description = getJobDescription(job);
    const fromDescription = inferCompanyFromDescription(description, title);
    if (fromDescription) return fromDescription;
    const fromUrl = inferCompanyFromUrl(job?.url || '');
    if (fromUrl) return fromUrl;
    return job?.company?.trim() || 'Unknown';
};

const escapeAirtableValue = (value) => String(value || '').replace(/'/g, "\\'");

async function updateAirtableJobCompany(job, company) {
    if (!AIRTABLE_TOKEN) return { updated: false, reason: 'missing_token' };
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/FreshJobs`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    const fields = { company };

    if (job?.airtableId) {
        const response = await fetch(`${baseUrl}/${job.airtableId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'airtableId' };
    }

    const jobCode = job?.job_code || job?.jobCode || '';
    const jobId = job?.id || job?.job_id || '';
    const jobUrl = job?.url || '';
    if (!jobCode && !jobId && !jobUrl) {
        return { updated: false, reason: 'missing_identifier' };
    }

    const parts = [];
    if (jobCode) parts.push(`{job_code}='${escapeAirtableValue(jobCode)}'`);
    if (jobId) parts.push(`{id}='${escapeAirtableValue(jobId)}'`);
    if (jobUrl) parts.push(`{url}='${escapeAirtableValue(jobUrl)}'`);
    const filter = encodeURIComponent(`OR(${parts.join(',')})`);
    const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
    if (!lookup.ok) {
        return { updated: false, reason: `airtable_lookup_${lookup.status}` };
    }
    const data = await lookup.json();
    const first = data?.records?.[0];
    if (!first?.id) return { updated: false, reason: 'airtable_not_found' };
    const response = await fetch(`${baseUrl}/${first.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields })
    });
    if (!response.ok) {
        return { updated: false, reason: `airtable_error_${response.status}` };
    }
    return { updated: true, method: 'lookup' };
}

async function backfillJobCompanies(jobs) {
    if (!Array.isArray(jobs) || !jobs.length) return;
    const updates = [];
    const maxUpdates = 50;

    for (const job of jobs) {
        const inferred = inferCompanyName(job);
        if (!inferred) continue;
        const current = job.company ? String(job.company).trim() : '';
        if (current && current.toLowerCase() === inferred.toLowerCase()) continue;
        job.company = inferred;
        updates.push({ job, company: inferred });
        if (updates.length >= maxUpdates) break;
    }

    for (const entry of updates) {
        try {
            await Jobs.updateOne({ _id: entry.job._id }, { company: entry.company });
        } catch (error) {
            console.warn('Failed to update job company in MongoDB', error.message);
        }
        try {
            await updateAirtableJobCompany(entry.job, entry.company);
        } catch (error) {
            console.warn('Failed to update job company in Airtable', error.message);
        }
    }
}

const getEverything = asyncHandler(async (req, res) => {
    try {
        const [Applications, Candidates, Jobs, Contacts, CandidateJobPairing, ContactJobPairing] = await Promise.all([
            getAllApplicationsPure(),
            getAllCandidatesPure(),
            getAllJobsPure(),
            getAllContactsPure(),
            getAllCandidateJobPairingsPure(),
            getAllContactJobPairingsPure(),
        ]);
        res.json({ Applications, Candidates, Jobs, Contacts, CandidateJobPairing, ContactJobPairing });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'An error occurred collecting data.' });
    }
});

const getAllCandidates = asyncHandler(async (req, res) => {
    const results = await getAllCandidatesPure();
    res.json(results);
});

const getAllJobs = asyncHandler(async (req, res) => {
    const results = await getAllJobsPure();
    res.json(results);
});

const getAllApplications = asyncHandler(async (req, res) => {
    const results = await getAllApplicationsPure();
    res.json(results);
});

const getAllContacts = asyncHandler(async (req, res) => {
    const results = await getAllContactsPure();
    res.json(results);
});

const getAllCandidateJobPairings = asyncHandler(async (req, res) => {
    const results = await getAllCandidateJobPairingsPure();
    res.json(results);
});

const getAllContactJobPairings = asyncHandler(async (req, res) => {
    const results = await getAllContactJobPairingsPure();
    res.json(results);
});

const PLAN_MAX_CONTACTS = { free: 10, upgraded: 20, premium: 30 }

async function getAllCandidatesPure() {
    const candidates = await Candidates.find().lean().exec()
    const now = Date.now()
    return candidates.map((c) => {
        const max = PLAN_MAX_CONTACTS[c.plan || 'free'] || 10
        const left = c.recruiterContactsLeft ?? max
        const updatedAt = c.recruiterContactsUpdatedAt ? new Date(c.recruiterContactsUpdatedAt).getTime() : 0
        const daysElapsed = Math.floor((now - updatedAt) / 86400000)
        const effectiveLeft = Math.min(left + daysElapsed, max)
        return { ...c, recruiterContactsLeft: effectiveLeft, recruiterContactsMax: max }
    })
}

async function getAllJobsPure() {
    const JobDynamic = mongoose.models.JobDynamic ||
        mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }));
    const jobs = await JobDynamic.find().lean().exec();
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;

    const parseJobDate = (job) => {
        const raw = job?.date_posted || job?.datePosted || job?.postedAt || job?.postedDate || job?.rawDate;
        if (!raw) return null;
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
        return null;
    };

    const filtered = jobs.filter((job) => {
        if (isJunkJobRecord(job)) return false
        const ts = parseJobDate(job);
        if (!ts) return true;
        return ts >= cutoff;
    });

    for (const job of filtered) {
        const inferred = inferCompanyName(job);
        if (inferred && job.company !== inferred) {
            job.company = inferred;
        }
    }

    setImmediate(() => {
        backfillJobCompanies(filtered).catch((error) => {
            console.warn('Backfill job companies failed', error.message);
        });
    });
    return filtered;
}

async function getAllApplicationsPure() {
    return await Applications.find().lean().exec();
}

async function getAllContactsPure() {
    return await Contacts.find().lean().exec();
}

async function getAllCandidateJobPairingsPure() {
    return await CandidateJobPairings.find().lean().exec();
}

async function getAllContactJobPairingsPure() {
    return await ContactJobPairings.find().lean().exec();
}

const getCandidateById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.statusCode(400).json({message: 'Candidate ID must be supplied.'});
    }
    try
    {
        const results = Candidates.FindById(id);
        if (!results?.length) {
            return res.statusCode(400).json({message: 'No Candidate found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.statusCode(500).json({message: 'An error occurred when trying to collect Candidate ' + id});
    }
});

const getJobById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.statusCode(400).json({message: 'Job ID must be supplied'});
    }
    try
    {
        const results = Jobs.FindById(id);
        if(!results?.length) {
            return res.statusCode(400).json({message: 'No Job found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.statusCode(500).json({message: 'An error occured when trying to collect Job ' + id});
    }
});

const getApplicationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.statusCode(400).json({message: 'Application ID must be supplied.'});
    }
    try
    {
        const results = Applications.FindById(id);
        if(!results?.length) {
            return res.statusCode(400).json({message: 'No Application found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.statusCode(500).json({message: 'An error occured when trying to collect Application ' + id});
    }
});

const getCandidateJobPariringById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.statusCode(400).json({message: 'A candidate+job pairing ID must be supplied.'});
    }
    try
    {
        const results = CandidateJobPairings.FindById(id);
        if(!results?.length) {
            return res.statusCode(400).json({message: 'No Candidate+Job pairing found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.statusCode(500).json({message: 'An error occured when trying to collect Candidate+Job pairing ' + id});
    }
});

const getContactById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.statusCode(400).json({message: 'A Contact ID must be supplied.'});
    }
    try
    {
        const results = Contacts.FindById(id);
        if(!results?.length) {
            return res.statusCode(400).json({message: 'No contact found.'});
        }
        res.json(results)
    }
    catch(Error)
    {
        console.error(Error);
        res.statusCode(500).json({message: 'An error occured when trying to collect Contact ' + id});
    }
});

const getContactJobPairingById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.statusCode(400).json({message: 'A Contact+Job pairing ID must be supplied.'});
    }
    try
    {
        const results = ContactJobPairings.FindById(id);
        if(!results?.length) {
            return res.statusCode(400).json({message: 'No Contact+Job pairing found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.statusCode(500).json({message: 'An error occured when trying to collect Contact+Job Pairing ' + id});
    }
});

const updateCandidateSkills = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { skills } = req.body || {};

    if (!id) {
        return res.status(400).json({ message: 'Candidate ID must be supplied.' });
    }
    if (!skills) {
        return res.status(400).json({ message: 'Skills must be supplied.' });
    }

    const normalizedSkills = Array.isArray(skills)
        ? skills.map((s) => String(s).trim()).filter(Boolean)
        : String(skills).split(',').map((s) => s.trim()).filter(Boolean);

    try {
        const candidate = await Candidates.findByIdAndUpdate(
            id,
            { skills: normalizedSkills },
            { new: true }
        );
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found.' });
        }

        let applyQueueUpdated = 0;
        if (candidate.email) {
            const ApplyQueue = mongoose.models.ApplyQueue ||
                mongoose.model('ApplyQueue', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.applyqueue' }));
            const result = await ApplyQueue.updateMany(
                { email: candidate.email },
                { $set: { candidate_skills: normalizedSkills, updated_at: new Date().toISOString() } }
            );
            applyQueueUpdated = result.modifiedCount || 0;
        }

        let airtable = { updated: false };
        try {
            airtable = await updateAirtableCandidateSkills(candidate, normalizedSkills);
        } catch (err) {
            airtable = { updated: false, reason: err.message };
        }

        let pairing = { updated: false };
        try {
            pairing = await pairCandidateJobs(candidate._id);
        } catch (err) {
            pairing = { updated: false, reason: err.message };
        }

        res.json({ candidate, applyQueueUpdated, airtable, pairing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update candidate skills.' });
    }
});

const pairCandidateJobsHandler = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit, minScore } = req.body || {};
    if (!id) return res.status(400).json({ message: 'Candidate ID must be supplied.' });

    try {
        const result = await pairCandidateJobs(id, { limit, minScore });
        return res.json(result);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ message: err.message || 'Failed to pair candidate jobs.' });
    }
});

const pairAllCandidatesHandler = asyncHandler(async (req, res) => {
    const { limit, minScore } = req.body || {};
    const results = await pairAllCandidates({ limit, minScore });
    res.json({ candidates: results.length, results });
});

const updateCandidateResume = asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    const file = req.file;

    if (!email) {
        return res.status(400).json({ message: 'Email must be supplied.' });
    }
    if (!file) {
        return res.status(400).json({ message: 'Resume file must be supplied.' });
    }

    const candidate = await Candidates.findOne({ email: String(email).toLowerCase() });
    if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found.' });
    }

    const creditBalance = Number.isFinite(candidate.tokenBalance) ? candidate.tokenBalance
        : Number.isFinite(candidate.creditsBalance) ? candidate.creditsBalance
            : 0;
    if (creditBalance <= 0) {
        return res.status(402).json({ message: 'Insufficient credits to re-upload resume.' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${candidate._id}-${Date.now()}${ext || ''}`;
    const targetPath = path.join(file.destination, safeName);
    try {
        fs.renameSync(file.path, targetPath);
    } catch (err) {
        console.warn('Failed to rename resume file', err);
    }

    const resumeLink = `${PUBLIC_SERVER_URL}/uploads/resumes/${safeName}`;
    const resumeMeta = {
        filename: safeName,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: resumeLink
    };

    const nextTokenBalance = Number.isFinite(candidate.tokenBalance)
        ? Math.max(0, (candidate.tokenBalance || 0) - 1)
        : candidate.tokenBalance;
    const nextCreditsBalance = Number.isFinite(candidate.creditsBalance)
        ? Math.max(0, (candidate.creditsBalance || 0) - 1)
        : candidate.creditsBalance;

    candidate.resumeLink = resumeLink;
    candidate.resume = resumeMeta;
    candidate.resume_text = '';
    candidate.resume_hash = '';
    candidate.resume_updated_at = new Date();
    if (Number.isFinite(candidate.tokenBalance)) {
        candidate.tokenBalance = nextTokenBalance;
        candidate.tokensUsed = (candidate.tokensUsed || 0) + 1;
    }
    if (Number.isFinite(candidate.creditsBalance)) {
        candidate.creditsBalance = nextCreditsBalance;
        candidate.creditsUsed = (candidate.creditsUsed || 0) + 1;
    }

    await candidate.save();

    let airtable = { updated: false };
    try {
        airtable = await updateAirtableCandidateResume(candidate, resumeLink);
    } catch (err) {
        airtable = { updated: false, reason: err.message };
    }

    if (RESUME_EXTRACT_WEBHOOK) {
        try {
            await fetch(RESUME_EXTRACT_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: candidate.email,
                    resume_url: resumeLink
                })
            });
        } catch (err) {
            console.warn('Resume extract webhook failed', err.message || err);
        }
    }

    let pairing = { updated: false };
    try {
        pairing = await pairCandidateJobs(candidate._id);
    } catch (err) {
        pairing = { updated: false, reason: err.message };
    }

    res.json({
        candidate,
        credits: {
            tokenBalance: candidate.tokenBalance,
            tokensUsed: candidate.tokensUsed,
            creditsBalance: candidate.creditsBalance,
            creditsUsed: candidate.creditsUsed
        },
        airtable,
        pairing
    });
});

// ── Shared OpenAI helper ─────────────────────────────────────────────────────
const updateCandidateCoverLetter = asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    const file = req.file;

    if (!email) {
        return res.status(400).json({ message: 'Email must be supplied.' });
    }
    if (!file) {
        return res.status(400).json({ message: 'Cover letter file must be supplied.' });
    }

    const candidate = await Candidates.findOne({ email: String(email).toLowerCase() });
    if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found.' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${candidate._id}-${Date.now()}${ext || ''}`;
    const targetPath = path.join(file.destination, safeName);
    try {
        fs.renameSync(file.path, targetPath);
    } catch (err) {
        console.warn('Failed to rename cover letter file', err);
    }

    const coverLetterLink = `${PUBLIC_SERVER_URL}/uploads/cover-letters/${safeName}`;
    const coverLetterMeta = {
        filename: safeName,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: coverLetterLink
    };

    candidate.coverLetterLink = coverLetterLink;
    candidate.coverLetter = coverLetterMeta;
    candidate.coverLetter_updated_at = new Date();
    await candidate.save();

    res.json({ candidate });
});

function buildDocumentEmailHtml({ greeting, docLabel, jobTitle, company, content, hasAttachment }) {
    const PRIMARY = '#306770'
    const BG = '#F2F4F8'
    const safeContent = (content || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:'Manrope',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td style="padding-bottom:28px;">
          <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1A1A2E;font-family:'Manrope',Arial,sans-serif;line-height:1.2;">
            Hi ${greeting}, here is your ${docLabel}.
          </h1>
          <p style="margin:0;font-size:15px;color:#555;font-family:'Manrope',Arial,sans-serif;">
            Tailored for <strong style="color:#1A1A2E;">${jobTitle}</strong> at <strong style="color:#1A1A2E;">${company}</strong>
          </p>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E4E8EE;">
          <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#2D2D2D;">${safeContent}</pre>
        </td></tr>
        ${hasAttachment ? `
        <tr><td style="padding-top:16px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#888;font-family:'Manrope',Arial,sans-serif;">
            Your ${docLabel} is attached to this email — open or save it directly from here.
          </p>
        </td></tr>` : ''}
        <tr><td style="padding-top:36px;text-align:center;border-top:1px solid #E4E8EE;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#999;font-family:'Manrope',Arial,sans-serif;">
            Good luck with your application!<br>
            <strong style="color:${PRIMARY};">Wander/Work Team</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function callOpenAI(systemPrompt, userPrompt, maxTokens = 1500) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return null
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: maxTokens,
            },
            { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        )
        return response.data?.choices?.[0]?.message?.content?.trim() || null
    } catch (e) {
        console.warn('OpenAI call failed:', e.message)
        return null
    }
}

const submitCustomRequest = asyncHandler(async (req, res) => {
    const payload = req.body || {};
    // JWT email takes precedence — client-supplied email is only a fallback for dev/testing
    const email = req.user?.email || payload.email
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const { firstName, lastName, jobId, jobTitle, company, jobUrl, resume, coverLetter } = payload;
    const totalCost = (resume ? 1 : 0) + (coverLetter ? 1 : 0);
    if (totalCost === 0) return res.status(400).json({ message: 'No items requested.' });

    // Atomic token check + deduction — same pattern as recruiter sendEmail
    const prevCandidate = await Candidates.findOneAndUpdate(
        {
            email: { $regex: new RegExp(`^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            tokenBalance: { $gte: totalCost },
        },
        { $inc: { tokenBalance: -totalCost, tokensUsed: totalCost } },
        { new: false }
    )

    if (!prevCandidate) {
        const exists = await Candidates.exists({ email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } })
        return res.status(exists ? 402 : 404).json({
            message: exists ? 'Insufficient tokens' : 'Candidate not found',
        })
    }

    const tokensRemaining = (prevCandidate.tokenBalance ?? totalCost) - totalCost

    // Fetch job description from MongoDB for better AI context
    let jobDescription = ''
    let jobDoc = null
    if (jobId) {
        try {
            jobDoc = await Jobs.findById(String(jobId)).lean().catch(() => null)
                ?? await Jobs.findOne({ job_code: String(jobId) }).lean()
            if (jobDoc) jobDescription = jobDoc.description || jobDoc.summary || jobDoc.shortDescription || ''
        } catch {}
    }

    const candidateName = `${prevCandidate.firstName || firstName || ''} ${prevCandidate.lastName || lastName || ''}`.trim()
    const candidateGreeting = prevCandidate.firstName || firstName || 'there'
    const skillsList = [...(prevCandidate.skills || []), ...(prevCandidate.skills_2 || [])].filter(Boolean).slice(0, 20).join(', ')
    const rolesList = (prevCandidate.targetRoles || []).slice(0, 5).join(', ')
    const resumeText = prevCandidate.resume_text || ''

    // Collect real contact details so the AI never needs to use placeholders
    const candidatePhone = prevCandidate.phone || ''
    const candidateLocation = [
        prevCandidate.location?.[0]?.city,
        prevCandidate.location?.[0]?.state,
        prevCandidate.location?.[0]?.locationName,
    ].filter(Boolean).join(', ')
    const candidateLinkedIn = prevCandidate.urls?.find((u) => u.urlName === 'LinkedIn')?.urlAddress || ''
    const candidatePortfolio = prevCandidate.urls?.find((u) => u.urlName === 'Portfolio')?.urlAddress || ''
    const candidateGitHub = prevCandidate.urls?.find((u) => u.urlName === 'GitHub')?.urlAddress || ''
    const contactBlock = [
        candidateName,
        candidateLocation,
        email,
        candidatePhone,
        candidateLinkedIn,
        candidatePortfolio,
        candidateGitHub,
    ].filter(Boolean).join('\n')

    // Use structured fields first; fall back to deriving from resume_text if empty
    let workExperience = prevCandidate.work_experience || ''
    let education = prevCandidate.education || ''
    if (resumeText && (!workExperience || !education)) {
        const derived = deriveResumeFields(resumeText)
        if (!workExperience && derived.workExperience) workExperience = derived.workExperience
        if (!education && derived.education) education = derived.education
        // Persist derived fields so future requests don't re-derive
        if (derived.workExperience || derived.education) {
            Candidates.updateOne({ _id: prevCandidate._id }, { $set: { work_experience: workExperience, education } }).catch(() => {})
        }
    }

    const jobContext = `Job Title: ${jobTitle}\nCompany: ${company}${jobDescription ? '\n\nJob Description:\n' + jobDescription.slice(0, 3000) : ''}`
    const candidateContext = [
        `== CANDIDATE CONTACT INFO (copy verbatim into resume header — never use brackets or placeholders) ==`,
        contactBlock,
        `\nTarget roles: ${rolesList}`,
        `Skills: ${skillsList}`,
        workExperience ? `\n== WORK EXPERIENCE (use this section exactly — real employers, titles, and dates) ==\n${workExperience.slice(0, 3000)}` : '',
        education ? `\n== EDUCATION (use this section exactly) ==\n${education.slice(0, 1000)}` : '',
        resumeText && !workExperience ? `\n== FULL RESUME TEXT ==\n${resumeText.slice(0, 4000)}` : '',
    ].filter(Boolean).join('\n')

    // Post-process: strip every [bracket placeholder] the AI might still emit
    const fillPlaceholders = (text) => {
        if (!text) return text
        return text
            .replace(/\[Your (E-?mail)\]/gi, email || '')
            .replace(/\[Your Phone( Number)?\]/gi, candidatePhone || '')
            .replace(/\[City,?\s*State,?\s*(Zip)?\]/gi, candidateLocation || '')
            .replace(/\[Your Address\]/gi, candidateLocation || '')
            .replace(/\[LinkedIn( Profile| URL)?\]/gi, candidateLinkedIn || '')
            .replace(/\[Portfolio( URL)?\]/gi, candidatePortfolio || '')
            .replace(/\[GitHub( URL)?\]/gi, candidateGitHub || '')
            // Remove any remaining [bracket placeholder] lines entirely
            .replace(/^\s*\[.*?\]\s*$/gm, '')
            // Collapse 3+ blank lines to 2
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    // RTF builder — opens natively in Word, Pages, Google Docs
    const textToRtf = (text) => {
        const rtfEsc = (s) => s
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0)}?`)
        const lines = text.split('\n').map((line) => {
            const escaped = rtfEsc(line)
                .replace(/\*\*(.+?)\*\*/g, (_, m) => `{\\b ${m}}`)
                .replace(/\*(.+?)\*/g, (_, m) => `{\\i ${m}}`)
            return escaped + '\\par'
        }).join('\n')
        return `{\\rtf1\\ansi\\ansicpg1252\\deff0` +
            `{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}` +
            `{\\colortbl ;\\red48\\green103\\blue112;}` +
            `\\f0\\fs22\\sa120\\sl276\\slmult1 ` +
            lines + `}`
    }

    // Generate AI content in parallel
    const [resumeRaw, coverLetterRaw] = await Promise.all([
        resume ? callOpenAI(
            'You are an ATS-safe resume writer. Write the full resume using ONLY real facts provided — never invent or use bracket placeholders like [Your Email], [Previous Employer], [Your Degree], [Month, Year], etc. If a piece of information (employer, date, degree) is not provided, omit that line entirely rather than using a placeholder. Use the candidate\'s contact info, work experience, and education exactly as given. Output plain text only.',
            `${jobContext}\n\n${candidateContext}\n\nWrite the complete tailored resume. Use real data only. Omit any section where you have no real data rather than leaving placeholders.`,
            2000
        ) : Promise.resolve(null),
        coverLetter ? callOpenAI(
            "You are a professional cover letter writer. Write a concise, tailored cover letter using the candidate's real background. Start with 'Dear Hiring Manager,'. Use 3-4 short paragraphs. No header block. Do not use placeholder text. Plain text only.",
            `${jobContext}\n\n${candidateContext}\n\nWrite the cover letter.`,
            800
        ) : Promise.resolve(null),
    ])

    const resumeContent = fillPlaceholders(resumeRaw)
    const coverLetterContent = fillPlaceholders(coverLetterRaw)

    let application = null
    if (jobDoc?._id && (resumeContent || coverLetterContent)) {
        application = await Applications.findOneAndUpdate(
            { jobId: jobDoc._id, candidateId: prevCandidate._id },
            {
                $set: {
                    preparedAt: new Date(),
                    status: 'prepared',
                    jobTitle: jobTitle || jobDoc.title || '',
                    company: company || jobDoc.company || '',
                    resume: resumeContent
                        ? {
                            type: 'generated',
                            content: resumeContent,
                            jobTitle: jobTitle || jobDoc.title || '',
                            company: company || jobDoc.company || '',
                            createdAt: new Date()
                        }
                        : {},
                    coverLetter: coverLetterContent || ''
                }
            },
            { new: true, upsert: true }
        )
    }

    // Send emails via SMTP if configured
    const smtpUser = process.env.EMAIL_SMTP_USER
    const smtpPass = process.env.EMAIL_SMTP_PASS
    const adminEmail = process.env.ADMIN_EMAIL || smtpUser

    if (smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.EMAIL_SMTP_PORT) || 587,
            secure: false,
            auth: { user: smtpUser, pass: smtpPass },
        })

        const sends = []

        const safeCompany = company.replace(/[^a-z0-9]/gi, '-').toLowerCase()

        if (resume) {
            const subject = `Your Resume — ${jobTitle} at ${company}`
            if (resumeContent) {
                sends.push(transporter.sendMail({
                    from: `"Wander/Work" <${smtpUser}>`,
                    to: email,
                    subject,
                    text: `Hi ${candidateGreeting},\n\nHere is your tailored resume for ${jobTitle} at ${company}:\n\n${'─'.repeat(60)}\n\n${resumeContent}\n\n${'─'.repeat(60)}\n\nGood luck!\nWander/Work Team`,
                    html: buildDocumentEmailHtml({ greeting: candidateGreeting, docLabel: 'tailored resume', jobTitle, company, content: resumeContent, hasAttachment: true }),
                    attachments: [{ filename: `resume-${safeCompany}.rtf`, content: textToRtf(resumeContent), contentType: 'text/rtf', encoding: 'utf8' }],
                }))
            } else {
                sends.push(transporter.sendMail({
                    from: `"Wander/Work" <${smtpUser}>`,
                    to: email,
                    subject,
                    text: `Hi ${candidateGreeting},\n\nYour resume request for ${jobTitle} at ${company} has been received.\n\nWe'll have it ready and sent to your email in minutes!\n\nWander/Work Team`,
                }))
            }
        }

        if (coverLetter) {
            const subject = `Your Cover Letter — ${jobTitle} at ${company}`
            if (coverLetterContent) {
                sends.push(transporter.sendMail({
                    from: `"Wander/Work" <${smtpUser}>`,
                    to: email,
                    subject,
                    text: `Hi ${candidateGreeting},\n\nHere is your cover letter for ${jobTitle} at ${company}:\n\n${'─'.repeat(60)}\n\n${coverLetterContent}\n\n${'─'.repeat(60)}\n\nGood luck!\nWander/Work Team`,
                    html: buildDocumentEmailHtml({ greeting: candidateGreeting, docLabel: 'cover letter', jobTitle, company, content: coverLetterContent, hasAttachment: true }),
                    attachments: [{ filename: `cover-letter-${safeCompany}.rtf`, content: textToRtf(coverLetterContent), contentType: 'text/rtf', encoding: 'utf8' }],
                }))
            } else {
                sends.push(transporter.sendMail({
                    from: `"Wander/Work" <${smtpUser}>`,
                    to: email,
                    subject,
                    text: `Hi ${candidateGreeting},\n\nYour cover letter request for ${jobTitle} at ${company} has been received.\n\nWe'll have it ready and sent to your email in minutes!\n\nWander/Work Team`,
                }))
            }
        }

        if (adminEmail) {
            const requested = [resume && 'Resume', coverLetter && 'Cover Letter'].filter(Boolean).join(' + ')
            const adminBody = [
                `Request: ${requested} | ${candidateName} <${email}>`,
                `Job: ${jobTitle} at ${company}`,
                `URL: ${jobUrl || 'N/A'}`,
                `Tokens used: ${totalCost} | Remaining: ${tokensRemaining}`,
                resumeContent ? `\n== RESUME ==\n${resumeContent}` : '',
                coverLetterContent ? `\n== COVER LETTER ==\n${coverLetterContent}` : '',
            ].filter(Boolean).join('\n')
            sends.push(transporter.sendMail({ from: smtpUser, to: adminEmail, subject: `[Wanderwork] ${requested} — ${candidateName}`, text: adminBody }))
        }

        try {
            await Promise.all(sends)
            console.log('[CustomRequest] Emails sent to', email)
        } catch (e) {
            console.error('[CustomRequest] Email send failed:', e.message)
            // Still return ok — tokens were deducted, content was generated
        }
    } else {
        console.warn('[CustomRequest] SMTP not configured — EMAIL_SMTP_USER and EMAIL_SMTP_PASS required')
        console.log('[CustomRequest] Generated:', { candidateName, email, resume: !!resumeContent, coverLetter: !!coverLetterContent, jobTitle, company })
    }

    return res.json({ ok: true, tokensRemaining, application })
});

const UpdateAllData = asyncHandler(async (req, res) => {
    const {data} = req.body;
    
    await Promise.all([
        dbUtils.bulkUpsert('JobSeeker.Applications', data.Applications),
        dbUtils.bulkUpsert('JobSeeker.Candidates', data.Candidates),
        dbUtils.bulkUpsert('JobSeeker.Jobs', data.Jobs),
        dbUtils.bulkUpsert('JobSeeker.Contacts', data.Contacts),
        dbUtils.bulkUpsert('JobSeeker.CandidateJobPairing', data.CandidateJobPairing || data.CandidateJobPairings),
        dbUtils.bulkUpsert('JobSeeker.ContactJobPairing', data.ContactJobPairing || data.ContactJobPairings)
    ]);

    const candidateIds = new Set();
    if (Array.isArray(data.Candidates)) {
        data.Candidates.forEach((candidate) => {
            if (candidate?._id) candidateIds.add(String(candidate._id));
        });
    }

    let pairing = { updated: false };
    try {
        if (candidateIds.size > 0) {
            const results = [];
            for (const candidateId of candidateIds) {
                results.push(await pairCandidateJobs(candidateId));
            }
            pairing = { updated: true, results };
        } else if (Array.isArray(data.Jobs) && data.Jobs.length > 0) {
            const results = await pairAllCandidates();
            pairing = { updated: true, results };
        }
    } catch (err) {
        pairing = { updated: false, reason: err.message };
    }

    res.status(200).json({ message: 'Update process completed.', pairing });
});

const ImportData = asyncHandler(async (req, res) => {
    const {data} = req.body;

    let applications = [];
    let candidates = [];
    let candidateJobPairings = [];
    let jobs = [];
    let contacts = [];
    let contactJobPairings = [];

    for (var i = 0; i < data.Candidates.length; i += 1) {
        Candidates.findOne({email: data.Canddiates[i].email}).lean()
            .then(async(foundCandidate) => {
                if (foundCandidate) {
                    foundCandidate.firstName = data.Candidates[i].firstName;
                    foundCandidate.lastName = data.Candidates[i].lastName;
                    foundCandidate.phone = data.Candidates[i].phone;
                    foundCandidate.location = data.Candidates[i].location;
                    foundCandidate.targetRole = data.Candidates[i].targetRole;
                    foundCandidate.seniority = data.Candidates[i].seniority;
                    foundCandidate.skills = data.Candidates[i].skills;
                    foundCandidate.urls = data.Candidates[i].urls;
                    foundCandidate.resume = data.Candidates[i].resume;
                    foundCandidate.resumeLink = data.Candidates[i].resumeLink;
                    foundCandidate.status = data.Candidates[i].status;
                    foundCandidate.paidUntil = data.Candidates[i].paidUntil;
                    foundCandidate.graceDays = data.Candidates[i].graceDays;
                    foundCandidate.tokenBalance = data.Candidates[i].tokenBalance;
                    foundCandidate.tokensUsed = data.Candidates[i].tokensUsed;
                    foundCandidate.creditsBalance = data.Candidates[i].creditsBalance;
                    foundCandidate.creditsUsed = data.Candidates[i].creditsUsed;

                    await foundCandidate.save();
                }
                else {
                    const currentCandidate = new Candidates({
                        firstName: data.Candidates[i].firstName,
                        lastName: data.Candidates[i].lastName,
                        email: data.Candidates[i].email,
                        phone: data.Candidates[i].phone,
                        location: data.Candidates[i].location,
                        targetRoles: data.Candidates[i].targetRoles,
                        seniority: data.Candidates[i].seniority,
                        skills: data.Candidates[i].skills,
                        urls: data.Candidates[i].urls,
                        resume: data.Candidates[i].resume,
                        resumeLink: data.Candidates[i].resumeLink,
                        status: data.Candidates[i].status,
                        paidUntil: data.Candidates[i].paidUntil,
                        graceDays: data.Canddiates[i].graceDays,
                        tokenBalance: data.Candidates[i].tokenBalance,
                        tokensUsed: data.Candidates[i].tokensUsed,
                        creditsBalance: data.Candidates[i].creditsBalance,
                        creditsUsed: data.Candidates[i].creditsUsed
                    });
                    await currentCandidate.save();
                }
            });
    }

    for (var i = 0; i < data.Jobs.length; i += 1) {
        Jobs.findOne({job_code: data.Jobs[i].job_code}).lean()
            .then(async (foundJob) => {
                if (foundJob) {
                    foundJob.job_code = data.Jobs[i].job_code;
                    foundJob.title = data.Jobs[i].title;
                    foundJob.company = data.Jobs[i].company;
                    foundJob.salary = data.Jobs[i].salary;
                    foundJob.location = data.Jobs[i].location;
                    foundJob.url = data.Jobs[i].url;
                    foundJob.jobType = data.Jobs[i].jobType;
                    foundJob.datePosted = data.Jobs[i].datePosted;
                    foundJob.shortDescription = data.Jobs[i].shortDescription;
                    foundJob.tags = data.Jobs[i].tags;

                    await foundJob.save();
                }
                else {
                    const currentJob = new Jobs({
                        job_code: data.Jobs[i].job_code,
                        title: data.Jobs[i].title,
                        company: data.Jobs[i].company,
                        salary: data.Jobs[i].salary,
                        location: data.Jobs[i].location,
                        url: data.Jobs[i].url,
                        jobType: data.Jobs[i].jobType,
                        datePosted: data.Jobs[i].datePosted,
                        shortDescription: data.Jobs[i].shortDescription,
                        tags: data.Jobs[i].tags
                    });

                    await currentJob.save()
                }
            });
    }

    for (var i = 0; i < data.Contacts.length; i += 1) {
        Contacts.findOne({company: data.Contacts[i].company, email: data.Contacts[i].email})
            .then(async (foundContact) => {
                if (foundContact) {
                    foundContact.name = data.Contacts[i].name;
                    foundContact.title = data.Contacts[i].title;
                    foundContact.source = data.Contacts[i].source;
                    foundContact.lastVerified = data.Contacts[i].lastVerified;

                    foundContact.save();
                }
                else {
                    const currentContact = new Contacts({
                        company: data.Contacts[i].company,
                        name: data.Contacts[i].name,
                        title: data.Contacts[i].title,
                        email: data.Contacts[i].email,
                        source: data.Contacts[i].source,
                        lastVerified: data.Contacts[i].lastVerified
                    });

                    await currentContact.save();
                }
            });
    }

    candidates = Candidates.find().lean();
    jobs = Jobs.find().lean();
    contacts = Contacts.find().lean();

    for (var i = 0; i < data.Applications.length; i += 1) {
        currentJob = jobs.find(x => x.job_code === data.Applications[i].jobId);
        currentCandidate = candidates.find(x => x.email === data.Applications[i].email);

        if (!currentJob) {
            console.log("No job found for application.");
            continue;
        }
        if (!currentCandidate) {
            console.log("No candidate found for application.")
        }

        Applications.findOne({job_code: currentJob.jobId, email: currentCandidate.email})
            .then(async (foundApplication) => {
                if (foundApplication) {
                    console.log("Application already present, skipping.");
                }
                else {
                    const currentApplication = new Applications({
                        jobId: currentJob._Id,
                        candidateId: currentCandidate._Id,
                        preparedAt: data.Applications[i].preparedAt,
                        status: data.Applications[i].status,
                        resume: data.Applications[i].resume,
                        coverLetter: data.Applications[i].coverLetter
                    });

                    currentApplication.save();
                }
            });
    }

    for (var i = 0; i < data.CandidateJobPairings.length; i += 1) {
        currentJob = jobs.find(x=> x.job_id === data.CandidateJobPairings[i].job_id);
        currentCandidate = candidates.find(x => x.email === data.CandidateJobPairings[i].email);

        if (!curentJob) {
            console.log("No job found for candidate + job pairing.");
            continue;
        }
        if (!currentCandidate) {
            console.log("No candidate found for candidate + job pairing.");
            continue;
        }

        CandidateJobPairings.findOne({jobId: currentJob.jobId, canddiateId: currentCandidate.email})
            .then(async (foundPairing) => {
                if (foundPairing) {
                    console.log("Current candidate + job pairing already present, skipping.");
                }
                else {
                    const currentPairing = new CandidateJobPairing({
                        jobId: currentJob._Id,
                        candidateId: currentCandidate.candidate._Id,
                        score: data.CandidateJobPairings[i].score
                    });

                    currentPairing.save();
                }
            });
    }

    for (var i = 0; i < data.ContactJobPairing.length; i += 1) {
        currentContact = contacts.find(x => x.email == data.ContactJobPairing[i].email);
        currentJob = jobs.find(x => x.job_code == data.ContactJobPairing[i].job_id);

        if (!currentContact) {
            console.log("No contact found for contact + job pairing.");
            continue;
        }
        if (!currentJob) {
            console.log("No job found for contact + job pairing.");
        }

        ContactJobPairings.findOne({jobId: currentJob.jobId, email: currentContact.email})
            .then(async (foundPairing) => {
                if (foundPairing) {
                    console.console.log("Current contact + job pairing already present.skipping.");
                }
                else {
                    const currentPairing = new ContactJobPairing({
                        contactId: currentContact._Id,
                        jobId: currentJob._Id,
                        confidence: data.ContactJobPairing[i].confidence
                    });

                    currentPairing.save();
                }
            });
    }

    res.statusCode(200).json({message: 'Import process completed.'});
});


module.exports =
{
    getEverything,
    getAllCandidates,
    getAllJobs,
    getAllApplications,
    getAllContacts,
    getAllCandidateJobPairings,
    getAllContactJobPairings,
    getCandidateById,
    getJobById,
    getApplicationById,
    getCandidateJobPariringById,
    getContactById,
    getContactJobPairingById,
    updateCandidateSkills,
    pairCandidateJobsHandler,
    pairAllCandidatesHandler,
    updateCandidateResume,
    updateCandidateCoverLetter,
    submitCustomRequest,
    UpdateAllData,
    ImportData,
    purgeJunkJobs,
    backfillCandidateResumeFields,
}

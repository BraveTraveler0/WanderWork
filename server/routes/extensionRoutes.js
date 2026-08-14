const express = require('express');
const router = express.Router();
const cors = require('cors');
const crypto = require('crypto');
const User = require('../models/User');
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate');
const Application = require('../models/JobSeeker/jobSeeker.Application');
const Job = require('../models/JobSeeker/jobSeeker.Job');
const { requireAuth } = require('../middleware/requireAuth');
const {
  getRecruitersForCompany,
  normalizeCompany,
} = require('../services/recruiterCompanyPairingService');

// This router is mounted BEFORE global CORS in server.js so content scripts
// calling from ATS origins (greenhouse.io, lever.co, etc.) aren't rejected.
// Wildcard origin is safe because every route requires x-extension-key auth.
const extensionCors = cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'x-extension-key'],
  methods: ['GET', 'POST', 'OPTIONS'],
});
router.use(extensionCors);
router.options('*', extensionCors);

// Body parser — must be local because this router runs before global express.json()
router.use(express.json({ limit: '1mb' }));

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeJobTitle(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b(?:job|position|opening|role)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(left, right) {
  const a = normalizeJobTitle(left);
  const b = normalizeJobTitle(right);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 8 && (a.includes(b) || b.includes(a)));
}

function canonicalJobUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return `${url.origin}${url.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseEducationProfile(value) {
  const block = String(value || '').split(/\n{2,}/).map(part => part.trim()).find(Boolean) || '';
  const lines = block.split(/\r?\n/).map(cleanText).filter(Boolean);
  const school = lines[0] || '';
  const degree = lines.find((line, index) => index > 0 && !/^\s*(?:19|20)\d{2}/.test(line)) || '';
  let major = degree
    .replace(/^(?:b\.?a\.?|b\.?s\.?|b\.?f\.?a\.?|m\.?a\.?|m\.?s\.?|m\.?f\.?a\.?)\s*[,\-:]?\s*/i, '')
    .replace(/^(?:associate|bachelor|master|doctor)(?:'s)?(?:\s+degree)?\s+(?:of|in)\s+/i, '')
    .replace(/^(?:arts|science|fine arts|business administration)\s+in\s+/i, '')
    .trim();
  if (!major || major.toLowerCase() === degree.toLowerCase()) {
    const match = degree.match(/(?:\bin\b|[,|])\s*([^,|]+)$/i);
    major = cleanText(match?.[1] || degree);
  }
  return { school, university: school, degree, major, fieldOfStudy: major };
}

function parseCurrentExperience(value) {
  const block = String(value || '').split(/\n{2,}/).map(part => part.trim()).find(Boolean) || '';
  const lines = block.split(/\r?\n/).map(cleanText).filter(Boolean);
  return {
    currentTitle: lines[0] || '',
    currentCompany: lines[1]?.split(/\s*(?:\u00b7|\|| - )\s*/)[0] || '',
  };
}

function coverLetterBody(value) {
  const lines = String(value || '').split(/\r?\n/).map(line => line.trim());
  return lines
    .filter(line => line && !/^dear\s+.+[, :]?$/i.test(line) && !/^(?:sincerely|best|regards|thank you)[, ]*$/i.test(line))
    .join('\n\n')
    .trim();
}

function whyCompanyFromCoverLetter(value) {
  const body = coverLetterBody(value);
  if (!body) return '';
  const paragraph = body.split(/\n{2,}/).find(part => part.trim().length >= 40) || body;
  return paragraph.trim();
}

async function findMatchingCoverLetter(candidateId, context = {}) {
  const company = cleanText(context.company);
  const jobTitle = cleanText(context.jobTitle);
  const jobUrl = canonicalJobUrl(context.jobUrl);
  if (!company && !jobTitle && !jobUrl) return null;

  const applications = await Application.find({
    candidateId,
    coverLetter: { $type: 'string', $ne: '' },
  }).sort({ preparedAt: -1 }).limit(50).lean();
  if (!applications.length) return null;

  const jobs = await Job.find({ _id: { $in: applications.map(application => application.jobId).filter(Boolean) } })
    .select('_id title company url apply_url').lean();
  const jobsById = new Map(jobs.map(job => [String(job._id), job]));
  const targetCompany = normalizeCompany(company);

  let best = null;
  for (const application of applications) {
    const job = jobsById.get(String(application.jobId)) || {};
    const savedCompany = cleanText(application.company || job.company);
    const savedTitle = cleanText(application.jobTitle || job.title);
    const savedUrls = [job.url, job.apply_url].map(canonicalJobUrl).filter(Boolean);
    const urlMatch = Boolean(jobUrl && savedUrls.includes(jobUrl));
    const companyMatch = Boolean(targetCompany && normalizeCompany(savedCompany) === targetCompany);
    const titleMatch = titlesMatch(jobTitle, savedTitle);
    if (!urlMatch && !(companyMatch && titleMatch)) continue;

    const score = (urlMatch ? 20 : 0) + (companyMatch ? 8 : 0) + (titleMatch ? 8 : 0);
    if (!best || score > best.score) {
      best = { application, score, savedCompany, savedTitle, urlMatch };
    }
  }

  if (!best) return null;
  return {
    coverLetter: best.application.coverLetter,
    coverLetterBody: coverLetterBody(best.application.coverLetter),
    whyCompany: whyCompanyFromCoverLetter(best.application.coverLetter),
    matchedCompany: best.savedCompany,
    matchedJobTitle: best.savedTitle,
    matchedBy: best.urlMatch ? 'url' : 'company-and-title',
  };
}

async function findMatchingJob(context = {}) {
  const rawUrl = cleanText(context.jobUrl);
  const jobUrl = canonicalJobUrl(rawUrl);
  if (rawUrl) {
    const exactUrl = await Job.findOne({ url: rawUrl }).select('_id title company url').lean();
    if (exactUrl) return exactUrl;

    if (jobUrl) {
      const urlPattern = new RegExp(`^${escapeRegex(jobUrl)}/?(?:[?#].*)?$`, 'i');
      const urlMatches = await Job.find({ url: urlPattern }).sort({ datePosted: -1 }).limit(10).lean();
      const canonicalMatch = urlMatches.find(job => canonicalJobUrl(job.url) === jobUrl);
      if (canonicalMatch) return canonicalMatch;
    }
  }

  const company = cleanText(context.company);
  const jobTitle = cleanText(context.jobTitle);
  if (!company || !jobTitle) return null;
  const titleWords = normalizeJobTitle(jobTitle).split(' ').filter(word => word.length > 2).slice(0, 3);
  const titlePattern = titleWords.length
    ? new RegExp(titleWords.map(escapeRegex).join('.*'), 'i')
    : new RegExp(escapeRegex(jobTitle), 'i');
  const candidates = await Job.find({ title: titlePattern }).sort({ datePosted: -1 }).limit(100).lean();
  const targetCompany = normalizeCompany(company);
  return candidates.find(job =>
    normalizeCompany(job.company) === targetCompany && titlesMatch(jobTitle, job.title)
  ) || null;
}

// GET /extension/key — returns (or generates) the extension key for the authenticated premium user
router.get('/key', requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!['pro', 'premium'].includes(user.plan) && !user.isAdmin) {
    return res.status(403).json({ message: 'The autofill extension requires a Pro or Premium plan.' });
  }

  if (!user.extensionKey) {
    user.extensionKey = crypto.randomBytes(32).toString('hex');
    await user.save();
  }

  res.json({ extensionKey: user.extensionKey });
});

// POST /extension/key/regenerate — generates a new key (invalidates old one)
router.post('/key/regenerate', requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!['pro', 'premium'].includes(user.plan) && !user.isAdmin) {
    return res.status(403).json({ message: 'The autofill extension requires a Pro or Premium plan.' });
  }

  user.extensionKey = crypto.randomBytes(32).toString('hex');
  await user.save();
  res.json({ extensionKey: user.extensionKey });
});

// GET /extension/profile — validates extension key and returns autofill profile data
router.get('/profile', async (req, res) => {
  const key = req.headers['x-extension-key'] || req.query.key;
  if (!key) return res.status(401).json({ message: 'Extension key required.' });

  const user = await User.findOne({ extensionKey: key });
  if (!user) return res.status(401).json({ message: 'Invalid extension key.' });
  if (!['pro', 'premium'].includes(user.plan) && !user.isAdmin) return res.status(403).json({ message: 'Pro or Premium plan required.' });

  const candidate = await Candidate.findOne({ email: user.email.toLowerCase() }).sort({ createdAt: -1 });
  if (!candidate) return res.status(404).json({ message: 'Profile not found. Complete your Wander/Work profile first.' });

  const loc = candidate.location?.[0] || {};
  const linkedin = candidate.urls?.find(u => /linkedin/i.test(u.urlName))?.urlAddress || '';
  const portfolio = candidate.urls?.find(u => /portfolio/i.test(u.urlName))?.urlAddress
    || candidate.urls?.find(u => /website|personal/i.test(u.urlName))?.urlAddress
    || '';
  const github = candidate.urls?.find(u => /github/i.test(u.urlName))?.urlAddress || '';
  const knownUrls = new Set([linkedin, portfolio, github].filter(Boolean));
  const otherWebsite = candidate.urls?.find(u => u.urlAddress && !knownUrls.has(u.urlAddress))?.urlAddress || '';
  const education = parseEducationProfile(candidate.education);
  const experience = parseCurrentExperience(candidate.work_experience);
  const documentContext = await findMatchingCoverLetter(candidate._id, {
    company: req.query.company,
    jobTitle: req.query.jobTitle,
    jobUrl: req.query.jobUrl,
  });

  res.json({
    firstName: candidate.firstName || '',
    lastName: candidate.lastName || '',
    email: candidate.contactEmail || candidate.email || '',
    phone: candidate.phone || '',
    city: loc.city || '',
    state: loc.state || '',
    postalCode: loc.postalCode || '',
    location: [loc.city, loc.state].filter(Boolean).join(', '),
    linkedin,
    portfolio,
    github,
    otherWebsite,
    websites: (candidate.urls || []).map(url => ({
      label: cleanText(url.urlName),
      url: cleanText(url.urlAddress),
    })).filter(url => url.url),
    ...education,
    educationRaw: candidate.education || '',
    ...experience,
    workExperience: candidate.work_experience || '',
    targetRole: candidate.targetRoles?.[0] || '',
    summary: candidate.summary || '',
    resumeLink: candidate.resumeLink || '',
    coverLetter: documentContext?.coverLetter || '',
    coverLetterBody: documentContext?.coverLetterBody || '',
    whyCompany: documentContext?.whyCompany || '',
    coverLetterMatch: documentContext ? {
      company: documentContext.matchedCompany,
      jobTitle: documentContext.matchedJobTitle,
      matchedBy: documentContext.matchedBy,
    } : null,
    plan: user.plan,
    tokens: candidate.tokenBalance ?? 0,
    avatar: candidate.profileImage || '',
  });
});

// POST /extension/request-document — request resume/cover letter from the extension
// Uses extension key instead of JWT. Deducts tokens and triggers email delivery.
router.post('/request-document', async (req, res) => {
  try {
    const key = req.headers['x-extension-key'] || req.query.key;
    if (!key) return res.status(401).json({ message: 'Extension key required.' });

    const user = await User.findOne({ extensionKey: key });
    if (!user) return res.status(401).json({ message: 'Invalid extension key.' });
    if (!['pro', 'premium'].includes(user.plan) && !user.isAdmin) {
      return res.status(403).json({ message: 'Pro or Premium plan required.' });
    }

    const { jobTitle, company, jobUrl, resume = true, coverLetter = false, fileFormat = 'pdf' } = req.body || {};
    const DOCUMENT_TOKEN_COST = 2;
    const totalCost = (resume ? DOCUMENT_TOKEN_COST : 0) + (coverLetter ? DOCUMENT_TOKEN_COST : 0);
    if (totalCost === 0) return res.status(400).json({ message: 'Select at least one document.' });

    // Resolve this posting to a saved job so generated documents are stored on
    // the candidate's application and can be reused by autofill later.
    const matchedJob = await findMatchingJob({ jobTitle, company, jobUrl });

    // Re-use submitCustomRequest logic via internal controller call
    const { submitCustomRequest } = require('../controllers/JobSeeker/jobSeekerController');
    req.user = { _id: user._id, email: user.email };
    req.body = {
      email: user.email,
      firstName: '',
      lastName: '',
      jobTitle: jobTitle || 'Position',
      company: company || 'Company',
      jobUrl: jobUrl || '',
      jobId: matchedJob?._id || null,
      resume: !!resume,
      coverLetter: !!coverLetter,
      fileFormat: fileFormat || 'pdf',
    };

    return submitCustomRequest(req, res);
  } catch (err) {
    console.error('[extension/request-document]', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// GET /extension/recruiters?company=X — returns recruiters paired to a company
router.get('/recruiters', async (req, res) => {
  try {
    const key = req.headers['x-extension-key'] || req.query.key;
    if (!key) return res.status(401).json({ recruiters: [] });
    const user = await User.findOne({ extensionKey: key });
    if (!user) return res.status(401).json({ recruiters: [] });

    const company = String(req.query.company || '').trim();
    if (!company) return res.json({ recruiters: [] });

    const normalizedCompany = normalizeCompany(company);
    if (normalizedCompany.length < 3) return res.json({ recruiters: [] });

    // Use the same vetted recruiter/job pairings as the main app. The exact
    // normalized-company check is a final guard against close-name matches.
    const matched = (await getRecruitersForCompany(company, { limit: 15 }))
      .filter((recruiter) => normalizeCompany(recruiter.company) === normalizedCompany)
      .slice(0, 5)
      .map((recruiter) => ({
        _id: recruiter._id,
        name: recruiter.name,
        firstName: recruiter.firstName,
        lastName: recruiter.lastName,
        company: recruiter.company,
        jobTitle: recruiter.jobTitle,
        specialty: recruiter.specialty,
      }));

    res.json({ recruiters: matched });
  } catch (err) {
    console.error('[extension/recruiters]', err.message);
    res.json({ recruiters: [] });
  }
});

module.exports = router;

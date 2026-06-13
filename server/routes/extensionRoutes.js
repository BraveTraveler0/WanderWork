const express = require('express');
const router = express.Router();
const cors = require('cors');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate');
const { requireAuth } = require('../middleware/requireAuth');

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

function normalizeCompany(s) {
  return String(s || '').toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|technologies|solutions|group|holdings)\b\.?/gi, '')
    .replace(/[^a-z0-9]/g, '');
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
  const portfolio = candidate.urls?.find(u => /portfolio|website|personal/i.test(u.urlName))?.urlAddress || '';
  const github = candidate.urls?.find(u => /github/i.test(u.urlName))?.urlAddress || '';

  res.json({
    firstName: candidate.firstName || '',
    lastName: candidate.lastName || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    city: loc.city || '',
    state: loc.state || '',
    postalCode: loc.postalCode || '',
    linkedin,
    portfolio,
    github,
    summary: candidate.summary || '',
    resumeLink: candidate.resumeLink || '',
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
    const totalCost = (resume ? 1 : 0) + (coverLetter ? 1 : 0);
    if (totalCost === 0) return res.status(400).json({ message: 'Select at least one document.' });

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
      jobId: null,
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

    const normTarget = normalizeCompany(company);
    if (normTarget.length < 3) return res.json({ recruiters: [] });

    const recruiterCol = mongoose.connection.collection('jobseeker.recruiters');
    const all = await recruiterCol.find(
      { company: { $exists: true, $ne: '' } },
      { projection: { name: 1, firstName: 1, lastName: 1, company: 1, jobTitle: 1, specialty: 1, email: 1 } }
    ).toArray();

    const matched = all.filter(r => {
      const norm = normalizeCompany(r.company);
      return norm === normTarget || norm.includes(normTarget) || normTarget.includes(norm);
    }).slice(0, 5);

    res.json({ recruiters: matched });
  } catch (err) {
    console.error('[extension/recruiters]', err.message);
    res.json({ recruiters: [] });
  }
});

module.exports = router;

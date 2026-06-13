const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate');
const { requireAuth } = require('../middleware/requireAuth');

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

    const { jobTitle, company, jobUrl, resume = true, coverLetter = false } = req.body || {};
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
      fileFormat: 'pdf',
    };

    return submitCustomRequest(req, res);
  } catch (err) {
    console.error('[extension/request-document]', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;

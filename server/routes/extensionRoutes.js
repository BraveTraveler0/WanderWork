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
  if (user.plan !== 'premium') {
    return res.status(403).json({ message: 'The autofill extension requires a Premium plan.' });
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
  if (user.plan !== 'premium') {
    return res.status(403).json({ message: 'The autofill extension requires a Premium plan.' });
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
  if (user.plan !== 'premium') return res.status(403).json({ message: 'Premium plan required.' });

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

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');
const jwtUtils = require('../utils/jwtUtils');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendWelcomeEmail } = require('../utils/welcomeEmail');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SERVER_URL = process.env.PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 8000}`;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

async function resolveGoogleIdentity({ credential, accessToken }) {
  if (credential && process.env.GOOGLE_CLIENT_ID) {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    return {
      email: normalizeEmail(payload.email),
      name: payload.name || '',
      picture: payload.picture || '',
    };
  }

  if (accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Invalid Google access token');
    const payload = await response.json();
    return {
      email: normalizeEmail(payload.email),
      name: payload.name || '',
      picture: payload.picture || '',
    };
  }

  throw new Error('Google credential is required');
}

// ── LinkedIn OAuth (manual flow, no passport) ────────────────────────────────
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  const LINKEDIN_CALLBACK = `${SERVER_URL}/oauth/linkedin/callback`;

  // Step 1: redirect user to LinkedIn authorization page
  router.get('/linkedin', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    // Build params without scope so we can append it with %20 encoding.
    // URLSearchParams encodes spaces as + which LinkedIn rejects.
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: LINKEDIN_CALLBACK,
      state,
    });
    res.redirect(
      `https://www.linkedin.com/oauth/v2/authorization?${params}&scope=openid%20profile%20email`
    );
  });

  // Step 2: handle LinkedIn callback, exchange code for token, fetch user info
  router.get('/linkedin/callback', async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      if (error === 'invalid_scope' || (String(error_description || '')).toLowerCase().includes('scope')) {
        return res.redirect(`${APP_URL}?error=linkedin_scope`);
      }
      return res.redirect(`${APP_URL}?login=true&error=linkedin`);
    }

    if (!code) return res.redirect(`${APP_URL}?login=true&error=linkedin`);

    try {
      // Exchange authorization code for access token
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: LINKEDIN_CALLBACK,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error('LinkedIn token exchange failed:', tokenData);
        return res.redirect(`${APP_URL}?login=true&error=linkedin`);
      }

      const accessToken = tokenData.access_token;

      // Fetch user info from OIDC endpoint
      const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoRes.ok) {
        console.error('LinkedIn userinfo failed:', userInfoRes.status);
        return res.redirect(`${APP_URL}?login=true&error=linkedin`);
      }

      const userInfo = await userInfoRes.json();
      const email = normalizeEmail(userInfo.email);

      if (!email) return res.redirect(`${APP_URL}?login=true&error=linkedin`);

      const linkedinData = {
        firstName: userInfo.given_name || '',
        lastName: userInfo.family_name || '',
        displayName: userInfo.name || '',
        photo: userInfo.picture || '',
        profileUrl: userInfo.sub || '',
      };

      // Find or create User document
      let user = await User.findOne({ email });
      if (!user) {
        const randomPass = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
        user = await User.create({
          email,
          displayName: linkedinData.displayName || `${linkedinData.firstName} ${linkedinData.lastName}`.trim(),
          password: randomPass,
          verified: true,
        });
      }

      if (user.active === false) {
        return res.redirect(`${APP_URL}?login=true&error=linkedin`);
      }

      // Upsert Candidate document
      try {
        const linkedinUrl = linkedinData.profileUrl
          ? `https://www.linkedin.com/in/${linkedinData.profileUrl}`
          : '';

        const existing = await Candidates.findOneAndUpdate(
          { email },
          {
            $setOnInsert: {
              email,
              firstName: linkedinData.firstName || linkedinData.displayName?.split(' ')[0] || email.split('@')[0],
              lastName: linkedinData.lastName || linkedinData.displayName?.split(' ').slice(1).join(' ') || '',
              phone: '',
              location: [],
              targetRoles: [],
              seniority: [],
              skills: [],
              urls: linkedinUrl ? [{ urlName: 'LinkedIn', urlAddress: linkedinUrl }] : [],
              resume: {},
              status: 'active',
              paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              tokenBalance: 30,
              recruiterContactsLeft: 10,
              recruiterContactsUpdatedAt: new Date(),
              ...(linkedinData.photo ? { profileImage: linkedinData.photo } : {}),
            },
          },
          { upsert: true, new: false }
        );

        if (!existing) {
          setImmediate(() => {
            sendWelcomeEmail({ email, firstName: linkedinData.firstName }).catch(() => {});
          });
        } else {
          const setFields = {};
          if (!existing.firstName && linkedinData.firstName) setFields.firstName = linkedinData.firstName;
          if (!existing.lastName && linkedinData.lastName) setFields.lastName = linkedinData.lastName;
          if (!existing.profileImage && linkedinData.photo) setFields.profileImage = linkedinData.photo;
          const hasLinkedInUrl = (existing.urls || []).some(u => u.urlName === 'LinkedIn');
          if (!hasLinkedInUrl && linkedinUrl) {
            await Candidates.updateOne({ email }, {
              ...(Object.keys(setFields).length ? { $set: setFields } : {}),
              $push: { urls: { urlName: 'LinkedIn', urlAddress: linkedinUrl } },
            });
          } else if (Object.keys(setFields).length) {
            await Candidates.updateOne({ email }, { $set: setFields });
          }
        }
      } catch (e) {
        console.warn('LinkedIn candidate upsert failed:', e.message);
      }

      const token = jwtUtils.generateToken(user);
      const userData = encodeURIComponent(JSON.stringify({ ...user._doc, password: undefined }));
      res.redirect(`${APP_URL}?token=${token}&user=${userData}&source=linkedin`);
    } catch (err) {
      console.error('LinkedIn OAuth error:', err);
      res.redirect(`${APP_URL}?login=true&error=linkedin`);
    }
  });
} else {
  router.get('/linkedin', (req, res) => {
    res.status(503).json({ message: 'LinkedIn OAuth is not configured.' });
  });
}

// ── Google token verify (used by frontend @react-oauth/google) ───────────────
router.post('/google', async (req, res) => {
  const { credential, accessToken } = req.body || {};

  try {
    if (!credential && !accessToken) return res.status(400).json({ message: 'Google credential is required' });

    const googleIdentity = await resolveGoogleIdentity({ credential, accessToken });
    const googleEmail = googleIdentity.email;
    const googleName = googleIdentity.name;
    const googlePicture = googleIdentity.picture;

    if (!googleEmail) return res.status(400).json({ message: 'Could not verify Google identity' });

    let user = await User.findOne({ email: googleEmail });
    if (!user) {
      const randomPass = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      user = await User.create({
        email: googleEmail,
        displayName: googleName || googleEmail.split('@')[0],
        password: randomPass,
        verified: true,
      });
    }

    if (user.active === false) {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    const nameParts = (googleName || '').trim().split(' ').filter(Boolean);
    const existingCandidate = await Candidates.findOneAndUpdate(
      { email: googleEmail },
      {
        $setOnInsert: {
          email: googleEmail,
          firstName: nameParts[0] || googleEmail.split('@')[0],
          lastName: nameParts.slice(1).join(' ') || '',
          phone: '',
          location: [],
          targetRoles: [],
          seniority: [],
          skills: [],
          urls: [],
          resume: {},
          status: 'active',
          paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          tokenBalance: 30,
          recruiterContactsLeft: 10,
          recruiterContactsUpdatedAt: new Date(),
          ...(googlePicture ? { profileImage: googlePicture } : {}),
        },
      },
      { upsert: true, new: false }
    ).catch((e) => { console.warn('Candidate upsert failed:', e.message); return null; });

    if (googlePicture && existingCandidate && !existingCandidate.profileImage) {
      Candidates.updateOne({ email: googleEmail }, { $set: { profileImage: googlePicture } }).catch(() => {});
    }

    if (!existingCandidate) {
      setImmediate(() => {
        sendWelcomeEmail({ email: googleEmail, firstName: nameParts[0] || googleEmail.split('@')[0] }).catch(() => {});
      });
    }

    const token = jwtUtils.generateToken(user);
    res.json({ user: { ...user._doc, password: undefined }, token });
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;

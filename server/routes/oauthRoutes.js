const express = require('express');
const router = express.Router();
const passport = require('passport');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
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

// ── LinkedIn Strategy ────────────────────────────────────────────────────────
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  const https = require('https');

  const linkedInStrategy = new LinkedInStrategy({
    clientID: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackURL: `${SERVER_URL}/oauth/linkedin/callback`,
    scope: ['openid', 'profile', 'email'],
    state: true,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = (profile.emails?.[0]?.value || profile._json?.email || '').toLowerCase();
      if (!email) return done(new Error('No email from LinkedIn'), null);

      let user = await User.findOne({ email });
      const linkedinData = {
        firstName: profile.name?.givenName || profile._json?.given_name || '',
        lastName: profile.name?.familyName || profile._json?.family_name || '',
        displayName: profile.displayName || profile._json?.name || '',
        photo: profile.photos?.[0]?.value || profile._json?.picture || '',
        profileUrl: profile.profileUrl || profile._json?.sub || '',
        accessToken,
      };

      if (!user) {
        const randomPass = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
        user = await User.create({
          email,
          displayName: linkedinData.displayName || `${linkedinData.firstName} ${linkedinData.lastName}`.trim(),
          password: randomPass,
          verified: true,
        });
      }

      return done(null, { user, linkedinData });
    } catch (err) {
      return done(err, null);
    }
  });

  // Fix: Node's querystring.stringify encodes spaces as '+' but LinkedIn OAuth requires '%20'
  const _origGetAuthorizeUrl = linkedInStrategy._oauth2.getAuthorizeUrl.bind(linkedInStrategy._oauth2);
  linkedInStrategy._oauth2.getAuthorizeUrl = function(params) {
    return _origGetAuthorizeUrl(params).replace(/(?<=scope=)[^&]+/, (s) => s.replace(/\+/g, '%20'));
  };

  // Override passport-linkedin-oauth2's hardcoded /v2/me call with the OIDC userinfo endpoint
  linkedInStrategy.userProfile = function(accessToken, done) {
    const req = https.request({
      hostname: 'api.linkedin.com',
      path: '/v2/userinfo',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          done(null, {
            provider: 'linkedin',
            id: json.sub || '',
            displayName: json.name || '',
            name: { givenName: json.given_name || '', familyName: json.family_name || '' },
            emails: json.email ? [{ value: json.email }] : [],
            photos: json.picture ? [{ value: json.picture }] : [],
            _json: json,
          });
        } catch (e) {
          done(new Error('Failed to parse LinkedIn userinfo: ' + e.message));
        }
      });
    });
    req.on('error', done);
    req.end();
  };

  passport.use(linkedInStrategy);
  passport.serializeUser((data, done) => done(null, data));
  passport.deserializeUser((data, done) => done(null, data));

  router.get('/linkedin', passport.authenticate('linkedin'));

  router.get('/linkedin/callback',
    (req, res, next) => {
      // Catch scope errors (app missing "Sign In with LinkedIn using OpenID Connect" product)
      if (req.query.error === 'invalid_scope' || (req.query.error_description || '').toLowerCase().includes('scope')) {
        return res.redirect(`${APP_URL}?error=linkedin_scope`);
      }
      passport.authenticate('linkedin', { session: false, failureRedirect: `${APP_URL}?login=true&error=linkedin` })(req, res, next);
    },
    async (req, res) => {
      try {
        const { user, linkedinData } = req.user;
        const token = jwtUtils.generateToken(user);

        // Ensure a Candidate document exists; on insert seed defaults, on update sync name/photo if missing
        try {
          const linkedinUrl = linkedinData.profileUrl || '';
          const existing = await Candidates.findOneAndUpdate(
            { email: user.email },
            {
              $setOnInsert: {
                email: user.email,
                firstName: linkedinData.firstName || linkedinData.displayName?.split(' ')[0] || user.email.split('@')[0],
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
          // New user: send welcome email directly (non-blocking)
          if (!existing) {
            setImmediate(() => {
              sendWelcomeEmail({ email: user.email, firstName: linkedinData.firstName }).catch(() => {});
            });
          }

          // For existing candidates: sync name if blank, photo if missing, add LinkedIn URL if absent
          if (existing) {
            const setFields = {};
            if (!existing.firstName && linkedinData.firstName) setFields.firstName = linkedinData.firstName;
            if (!existing.lastName && linkedinData.lastName) setFields.lastName = linkedinData.lastName;
            if (!existing.profileImage && linkedinData.photo) setFields.profileImage = linkedinData.photo;
            const hasLinkedInUrl = (existing.urls || []).some(u => u.urlName === 'LinkedIn');
            if (!hasLinkedInUrl && linkedinUrl) {
              await Candidates.updateOne({ email: user.email }, {
                ...(Object.keys(setFields).length ? { $set: setFields } : {}),
                $push: { urls: { urlName: 'LinkedIn', urlAddress: linkedinUrl } },
              });
            } else if (Object.keys(setFields).length) {
              await Candidates.updateOne({ email: user.email }, { $set: setFields });
            }
          }
        } catch (e) {
          console.warn('LinkedIn candidate upsert failed:', e.message);
        }

        // Redirect to frontend with token and user data encoded
        const userData = encodeURIComponent(JSON.stringify({ ...user._doc, password: undefined }));
        res.redirect(`${APP_URL}?token=${token}&user=${userData}&source=linkedin`);
      } catch (err) {
        res.redirect(`${APP_URL}?login=true&error=linkedin`);
      }
    }
  );
} else {
  router.get('/linkedin', (req, res) => {
    res.status(503).json({ message: 'LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.' });
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

    // Ensure a Candidate document exists for this user (create if new, leave existing data alone)
    const nameParts = (googleName || '').trim().split(' ').filter(Boolean)
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
    ).catch((e) => { console.warn('Candidate upsert failed:', e.message); return null })

    // Backfill profileImage on existing candidates that don't have one yet
    if (googlePicture && existingCandidate && !existingCandidate.profileImage) {
      Candidates.updateOne({ email: googleEmail }, { $set: { profileImage: googlePicture } }).catch(() => {})
    }

    // New user: send welcome email directly (non-blocking)
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

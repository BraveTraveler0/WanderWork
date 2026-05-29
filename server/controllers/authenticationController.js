const asyncHandler = require('express-async-handler')
const crypto = require('crypto')
const User = require('../models/User')
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate')
const jwtUtils = require('../utils/jwtUtils')
const { sendWelcomeEmail } = require('../utils/welcomeEmail')
const bcrypt = require('bcrypt')
const Achievements = require('../models/achievements')
const { updateLightSeekerAchievement } = require('./achievementsController.js');
const { getUserLevel } = require('./xpController.js');
const sendEmail = require('../utils/mail.service')
const passport = require('passport')
const sgMail = require('@sendgrid/mail');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_BASE_LOCK_MS = 60 * 60 * 1000;
const LOGIN_MAX_LOCK_MS = 24 * 60 * 60 * 1000;
const missingUserLoginAttempts = new Map();

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function getClientIp(req) {
    return String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown')
        .split(',')[0]
        .trim();
}

function formatLockMessage(lockUntil) {
    const remainingMs = Math.max(0, new Date(lockUntil).getTime() - Date.now());
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return `Too many failed login attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
}

function lockDurationForLevel(level) {
    return Math.min(LOGIN_BASE_LOCK_MS * (2 ** Math.max(0, level - 1)), LOGIN_MAX_LOCK_MS);
}

function getMissingUserAttemptKey(req, email) {
    return `${getClientIp(req)}:${normalizeEmail(email) || 'blank'}`;
}

function checkMissingUserLock(req, email) {
    const key = getMissingUserAttemptKey(req, email);
    const entry = missingUserLoginAttempts.get(key);
    if (!entry?.lockUntil) return null;
    if (entry.lockUntil <= Date.now()) {
        missingUserLoginAttempts.delete(key);
        return null;
    }
    return new Date(entry.lockUntil);
}

function recordMissingUserFailure(req, email) {
    const key = getMissingUserAttemptKey(req, email);
    const existing = missingUserLoginAttempts.get(key) || { attempts: 0, level: 0, lockUntil: null };
    const attempts = existing.attempts + 1;
    const next = { ...existing, attempts, lastFailedAt: Date.now() };
    if (attempts >= LOGIN_ATTEMPT_LIMIT) {
        next.level = existing.level + 1;
        next.lockUntil = Date.now() + lockDurationForLevel(next.level);
        next.attempts = 0;
    }
    missingUserLoginAttempts.set(key, next);
    return next.lockUntil ? new Date(next.lockUntil) : null;
}

function clearMissingUserFailures(req, email) {
    missingUserLoginAttempts.delete(getMissingUserAttemptKey(req, email));
}

async function registerFailedLogin(user) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    user.failedLoginAttempts = attempts;
    user.lastFailedLoginAt = new Date();

    if (attempts >= LOGIN_ATTEMPT_LIMIT) {
        const nextLevel = (user.loginLockLevel || 0) + 1;
        user.loginLockLevel = nextLevel;
        user.loginLockUntil = new Date(Date.now() + lockDurationForLevel(nextLevel));
        user.failedLoginAttempts = 0;
    }

    await user.save();
    return user.loginLockUntil;
}

async function clearLoginFailures(user) {
    if (user.failedLoginAttempts || user.loginLockUntil || user.loginLockLevel) {
        user.failedLoginAttempts = 0;
        user.loginLockUntil = null;
        user.loginLockLevel = 0;
        user.lastFailedLoginAt = null;
        await user.save();
    }
}

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

const _twKey = process.env.TWITTER_CONSUMER_KEY;
const _twSecret = process.env.TWITTER_CONSUMER_SECRET;
if (_twKey && _twKey !== 'dummy' && _twSecret && _twSecret !== 'dummy') {
  const TwitterStrategy = require('passport-twitter').Strategy;
  passport.use(new TwitterStrategy({
    consumerKey: _twKey,
    consumerSecret: _twSecret,
    callbackURL: process.env.SERVER_URL + '/api/auth/twitter/callback',
  }, (token, tokenSecret, profile, cb) => cb(null, profile)));
}

const login = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    // Confirm data
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    if (!password) {
        return res.status(400).json({ message: 'Password is required' });
    }

    try {
        const missingUserLock = checkMissingUserLock(req, email);
        if (missingUserLock) {
            return res.status(423).json({ message: formatLockMessage(missingUserLock), lockedUntil: missingUserLock });
        }

        // Find a user with the provided email
        const user = await User.findOne({ email });

        // If no user with the provided email is found
        if (!user) {
            const lockUntil = recordMissingUserFailure(req, email);
            if (lockUntil) {
                return res.status(423).json({ message: formatLockMessage(lockUntil), lockedUntil: lockUntil });
            }
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.loginLockUntil && user.loginLockUntil > new Date()) {
            return res.status(423).json({ message: formatLockMessage(user.loginLockUntil), lockedUntil: user.loginLockUntil });
        }

        if (user.active === false) {
            return res.status(403).json({ message: 'Account is disabled' });
        }

        // Compare the provided password with the stored hashed password
        const passwordMatch = await user.comparePassword(password);

        if (!passwordMatch) {
            const lockUntil = await registerFailedLogin(user);
            if (lockUntil && lockUntil > new Date()) {
                return res.status(423).json({ message: formatLockMessage(lockUntil), lockedUntil: lockUntil });
            }
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        await clearLoginFailures(user);
        clearMissingUserFailures(req, email);

        // If the email and password (or token) are correct, generate a JWT
        const jwtToken = jwtUtils.generateToken(user);

        // Respond with the user data (excluding the password) and the JWT
        res.json({ user: { ...user._doc, password: undefined }, token: jwtToken });
        await updateLightSeekerAchievement(user._id);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

const googlelogin = asyncHandler(async (req, res) => {
    const { credential, accessToken } = req.body || {};

    if (!credential && !accessToken) {
        return res.status(400).json({ message: 'Google credential is required' });
    }

    try {
        const googleIdentity = await resolveGoogleIdentity({ credential, accessToken });
        const googleEmail = googleIdentity.email;
        const googleName = googleIdentity.name;

        if (!googleEmail) {
            return res.status(400).json({ message: 'Could not determine email from Google credential' });
        }

        let user = await User.findOne({ email: googleEmail });

        // Auto-create user if they don't have an account yet
        if (!user) {
            const nameParts = (googleName || googleEmail.split('@')[0]).split(' ');
            const displayName = googleName || nameParts.join(' ');
            const randomPass = require('crypto').randomBytes(24).toString('hex');
            const hashedPass = await bcrypt.hash(randomPass, 10);
            user = await User.create({
                email: googleEmail,
                displayName,
                password: hashedPass,
                verified: true,
            });
        }

        if (user.active === false) {
            return res.status(403).json({ message: 'Account is disabled' });
        }

        await clearLoginFailures(user);

        const jwtToken = jwtUtils.generateToken(user);
        res.json({ user: { ...user._doc, password: undefined }, token: jwtToken });
        await updateLightSeekerAchievement(user._id);
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

const refreshSession = asyncHandler(async(req, res) => {
    try {
        const {userId} = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ user: { ...user._doc, password: undefined }});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error while refreshing user session'});
    }

});

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(SENDGRID_API_KEY);

const createNewUser = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    displayName,
    profimage,
    backimage,
    ageVerified,
    event,
    firstName,
    lastName,
    phone,
    location,
    targetRole,
    targetRoles,
    seniority,
    skills,
    linkedinUrl,
    portfolioUrl,
    githubUrl,
    calendlyUrl,
  } = req.body;

  console.log(email)

  // Confirm data
  if (!email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check for duplicate email
    const duplicate = await User.findOne({ email }).lean().exec();

    if (duplicate) {
      return res.status(409).json({ message: 'Duplicate email' });
    }

    // Hash password
    const hashedPwd = await bcrypt.hash(password, 15); // salt rounds

    // Fetch all achievements from the database
    const achievements = await Achievements.find().lean().exec();

    // Create an array of achievements for the user
    const userAchievements = achievements.map(({ _id, crown, goal }) => ({
      id: _id,
      crown,
      goal,
    }));

    const tags = [
        "Photography",
        "Comics",
        "Anime",
        "AI Art",
        "Film",
        "Travel",
        "NSFW",
        "Painting",
        "Video Games",
        "Sci-Fi",
        "Memes",
        "Sports",
        "History",
        "Music",
        "Cosplay",
        "Concept Art",
        "Fashion",
        "Manga",
        "Classical",
        "Traditional Art",
        "Digital Art (Non AI)",
        "Abstract & Modeling",
        "Cartoons",
        "Design",
        "Nature & Science"
        ]

    const normalizedEmail = String(email).trim().toLowerCase();
    const safeFirstName = String(firstName || displayName || normalizedEmail.split('@')[0] || 'User').trim();
    const safeLastName = String(lastName || 'Candidate').trim();
    const roleList = Array.isArray(targetRoles)
      ? targetRoles
      : String(targetRole || '').split(',').map((item) => item.trim()).filter(Boolean);
    const seniorityList = Array.isArray(seniority)
      ? seniority
      : String(seniority || '').split(',').map((item) => item.trim()).filter(Boolean);
    const skillList = Array.isArray(skills)
      ? skills
      : String(skills || '').split(',').map((item) => item.trim()).filter(Boolean);
    const urls = [
      linkedinUrl ? { urlName: 'LinkedIn', urlAddress: linkedinUrl } : null,
      portfolioUrl ? { urlName: 'Portfolio', urlAddress: portfolioUrl } : null,
      githubUrl ? { urlName: 'GitHub', urlAddress: githubUrl } : null,
      calendlyUrl ? { urlName: 'Calendly', urlAddress: calendlyUrl } : null,
    ].filter(Boolean);

    const userObject = { email: normalizedEmail, password: hashedPwd, stars: 5, achievements: userAchievements, tags, displayName: displayName || `${safeFirstName} ${safeLastName}`.trim(), profimage, backimage, ageVerified, event };

    // Create and store new user
    const user = await User.create(userObject);

    // Generate a JWT token for the newly registered user
    const token = jwtUtils.generateToken(user);

    // Add the generated token to the user's collection
    user.token = token;
    await user.save();

    const existingCandidate = await Candidates.findOne({ email: normalizedEmail });
    const candidatePayload = {
      firstName: safeFirstName,
      lastName: safeLastName,
      email: normalizedEmail,
      phone: phone || 'Not provided',
      location: [{ locationName: location || 'New York, NY', city: location || 'New York', state: location ? '' : 'NY' }],
      targetRoles: roleList,
      seniority: seniorityList,
      skills: skillList,
      urls,
      resume: {},
      resumeLink: '',
      status: 'active',
      paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      tokenBalance: 100,
      tokensUsed: 0,
      creditsBalance: 30,
      creditsUsed: 0,
      plan: 'free',
      recruiterContactsLeft: 10,
      recruiterContactsUpdatedAt: new Date(),
    };
    const candidate = existingCandidate
      ? await Candidates.findOneAndUpdate({ email: normalizedEmail }, { $set: candidatePayload }, { new: true })
      : await Candidates.create(candidatePayload);

    if (!user) {
      return res.status(400).json({ message: 'Invalid user data received' });
    }

    // Send welcome email directly via SendGrid (non-blocking)
    setImmediate(() => {
      sendWelcomeEmail({ email: normalizedEmail, firstName: safeFirstName }).catch(() => {});
    });

    // Generate a secure verification token and save it to the user
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(user._id, { verificationToken });

    // Send verification email
    const verificationLink = `https://application-server-cwqu.onrender.com/auth/signup/verify?email=${encodeURIComponent(email)}&token=${verificationToken}`;
    const emailMessage = {
      to: email,
      from: 'support@aontechnology.io',
      subject: 'Verify your email',
      html: `<p>Click <a href="${verificationLink}">here</a> to verify your email and complete the signup process.</p>`,
    };

    console.log('fire')

    try {
      if (SENDGRID_API_KEY) await sgMail.send(emailMessage);
    } catch (mailError) {
      console.warn('Verification email failed:', mailError.message);
    }

    // Respond with the JWT token in addition to the success message
    res.status(201).json({ user: { ...user._doc, password: undefined, token }, token, candidate });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

const loginSocial = asyncHandler(async (req, res) => {
    return res.status(410).json({ message: 'Legacy social login is disabled. Use Google or LinkedIn OAuth.' });
});

const twitterLogin = asyncHandler(async (req, res) => {
      // Successful authentication, redirect home.
      res.redirect('/');
});

const deleteUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the provided password with the stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // If email and password are correct, delete the user
        await User.deleteOne({ _id: user._id });

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

const SENDGRID = process.env.SENDGRID_API_KEY
sgMail.setApiKey(SENDGRID);

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });
        console.log(user)

        if (user) {
            // Generate a unique reset token
            const resetToken = jwtUtils.generateToken(user);

            // Include this token in the recovery email
            const appUrl = process.env.APP_URL || 'https://wanderwork.io';
            const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
            const displayName = user.displayName || user.email.split('@')[0];
            const emailMessage = {
                to: user.email,
                from: process.env.EMAIL_FROM || 'support@wanderwork.io',
                subject: "Reset your Wander/Work password",
                html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Manrope,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <tr><td style="background:#306770;padding:32px 40px;text-align:center">
          <p style="margin:0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:4px">WANDER<span style="opacity:0.6">/</span>WORK</p>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#1a1a1a;font-size:18px;font-weight:600;margin:0 0 12px">Hi ${displayName},</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 28px">We received a request to reset your Wander/Work password. Click the button below to create a new one. This link expires in 1 hour.</p>
          <div style="text-align:center;margin:0 0 28px">
            <a href="${resetLink}" style="display:inline-block;background:#306770;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px">Reset My Password</a>
          </div>
          <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0">If you didn't request this, you can safely ignore this email — your password won't change.<br><br>If the button above doesn't work, copy this link into your browser:<br><a href="${resetLink}" style="color:#306770;word-break:break-all">${resetLink}</a></p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 40px;text-align:center">
          <p style="margin:0;color:#9CA3AF;font-size:12px">© 2026 Wander/Work, Inc. · <a href="https://wanderwork.io/privacy" style="color:#9CA3AF">Privacy</a> · <a href="https://wanderwork.io/terms" style="color:#9CA3AF">Terms</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
            };

            // Send the email to the user
            await sgMail.send(emailMessage);
            console.log(`Recovery email sent successfully to ${user.email}`);
            return res.status(201).json({ message: `Recovery email sent to ${user.email}. Check your inbox for further instructions.` });
        } else {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error sending recovery email:', error);
        return res.status(500).json({ message: 'Server Error', error });
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    const { password, confirmPassword, resetToken } = req.body;
    const decoded = jwtUtils.verifyToken(resetToken);
    const email = decoded?.email;

    console.log(email)

    if (!email || !password || !confirmPassword || !resetToken) {
        return res.status(400).json({ message: 'Email, password, confirm password, and reset token are required' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the provided confirm password with the provided password
        if (password !== confirmPassword) {
            return res.status(401).json({ message: 'Passwords do not match' });
        }

        // Verify the provided reset token
        const decoded = jwtUtils.verifyToken(resetToken);

        if (!decoded) {
            return res.status(401).json({ message: 'Invalid reset token' });
        }

        // Hash the new password
        const hashedpassword = await bcrypt.hash(password, 15); // salt rounds

        // Update the user's password
        user.password = hashedpassword;
        await user.save();

        res.status(200).json({ email: user.email, message: 'Password reset successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
})

const changePassword = asyncHandler(async (req, res) => {
    const { email, currentPassword, password } = req.body;
    // Confirm data
    if (!email || !confirmPassword || !password) {
        return res.status(400).json({ message: 'Email, current password, and new password are required' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the provided password with the stored hashed password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Hash the new password
        const hashedpassword = await bcrypt.hash(password, 15); // salt rounds

        // Update the user's password
        user.password = hashedpassword;
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

const updateUserLoginInfo = async(user) => {
    const today = new Date();
    if (user.lastlogin) {
        if (user.consecutivelogins &&
          today.valueOf() - user.lastlogin.valueOf() < 172800000) { // 48 Hours in Miliseconds
            if ((today.getDay() - user.lastlogin.getDay() + 7) % 7 === 1) { // 1 day apart
                user.consecutivelogins += 1; // Increase
            } 
        } 
        else {
          user.consecutivelogins = 1; //Reset
        }
    }
    user.lastlogin = today;
};

const startSession = asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ message: 'Id is required' });
    }

    const user = await User.findById(id);
    if (!user) {
        return res.status(400).json({ message: 'User not found: Check for valid Id'});
    }

    // Update User Login information
    updateUserLoginInfo(user);

    const time = Date.now();

    // Data Patching: If the user has no stripeId, create a stripe user
    if (!user.stripeId) {
        console.log("GryphDebug: !user.stripeId" + time.toString());
        const stripeUser = await stripe.customers.create(
            {
                email: user.email,
                name: user.displayName,
            });
        console.log("GryphDebug: Finished Creating Stripe User" + time.toString());
        user.stripeId = stripeUser.id;
    }

    await user.save();

    // console.log("GryphDebug: Fnished Saving User" + time.toString());

    await updateLightSeekerAchievement(user._id);

    return res.status(200).json({ message: 'Session Started', date: new Date(), updates: { levelUpdate: await getUserLevel(id), }, });
});

const endSession = asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ message: 'Id is required' });
    }
    const user = await User.findById(id);
    if (!user) {
        return res.status(400).json({ message: 'User not found: Check for valid Id'});
    }

    const today = new Date();
    if (user.totalTimeOnline !== null && user.totalTimeOnline !== undefined) {
        // Add the duration of milliseconds since the start of the session
        user.totalTimeOnline += today.valueOf() - user.lastlogin.valueOf();
    } else {
        user.totalTimeOnline = 0;
    }
    updateUserLoginInfo(user);

    await user.save();

    return res.status(200).json({ message: 'Session Ended', date: today });
});

module.exports = {
    login,
    googlelogin,
    loginSocial,
    twitterLogin,
    createNewUser,
    deleteUser,
    forgotPassword,
    resetPassword,
    changePassword,
    startSession,
    endSession,
    refreshSession
}

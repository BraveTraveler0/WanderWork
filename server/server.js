require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require('mongoose'); // Add this import
const connectDB = require("./config/dbConn");
const path = require('path');
const imageRoutes = require("./routes/imagesRoutes");
const twitterRoutes = require("./routes/twitterRoutes");
const { initializeBots, shutdownBots } = require('./bot_accounts');
// Import Airtable sync scheduler
const { initScheduledSync } = require('./airtable-scheduler');
const { scheduleRecruiterCompanyPairing } = require('./services/recruiterCompanyPairingService');
const { purgeJunkJobs, backfillCandidateResumeFields } = require('./controllers/JobSeeker/jobSeekerController');
const { purgeJobs } = require('./scripts/purgeJobs.cjs');
const { pairAllCandidates } = require('./services/jobPairingService');
const syncRoutes = require('./routes/sync');

// Import schedules
require("./schedules/postsJobs");
require("./schedules/starsJobs");
const { initJobDigestSchedule } = require('./schedules/jobDigestJob');
const { initRemoteJobsImport } = require('./schedules/remoteJobsImport');

const app = express();
const PORT = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

app.set('trust proxy', 1);

app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// Connection check middleware
const checkConnection = async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(process.env.DATABASE_URI);
        } catch (err) {
            return res.status(500).json({ message: 'Database connection not available' });
        }
    }
    next();
};

// Stripe webhook must receive the raw body before express.json() parses it
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

// Extension routes must be mounted BEFORE global CORS. Content scripts call from ATS origins
// (boards.greenhouse.io, jobs.lever.co, etc.) which are not in allowedOrigins. The global CORS
// middleware would reject their OPTIONS preflights before our route-level wildcard CORS runs.
// Moving extension routes first lets them handle their own CORS with no interference.
app.use('/extension', require('./routes/extensionRoutes'));

const defaultAllowedOrigins = [
  'https://wanderwork.io',
  'https://www.wanderwork.io',
  'https://wanderwork.onrender.com',
  'https://wanderwork-backend-server.onrender.com',
];
const configuredAllowedOrigins = String(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || /^https?:\/\/localhost:\d+$/i.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin) || /^chrome-extension:\/\//.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-extension-key", "x-admin-key"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: '25mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use(['/auth/login', '/auth/signup', '/auth/forgotPassword', '/auth/resetPassword', '/oauth/google'], authLimiter);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { message: 'Too many requests. Please try again shortly.' },
});
app.use('/jobseeker', apiLimiter);
app.use('/recruiter', apiLimiter);

// Tight rate limit for abuse-prone unauthenticated endpoints
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});
app.use('/jobseeker/claim-weekly-token', claimLimiter);
app.use('/stripe/redeem-code', claimLimiter);

// UTF-8 Header Middleware
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  next();
});


// Health check (before DB middleware so Render's check always passes)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const staticPage = (title, bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — Wander/Work</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#333;padding:40px 20px;line-height:1.7}
.wrap{max-width:780px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.07)}
h1{font-size:28px;font-weight:800;color:#306770;margin-bottom:6px}
.meta{font-size:13px;color:#888;margin-bottom:32px}
h2{font-size:17px;font-weight:700;color:#306770;margin:28px 0 8px}
p{margin-bottom:12px;font-size:14px;color:#555}
ul{margin:0 0 14px 22px;font-size:14px;color:#555}
li{margin-bottom:5px}
a{color:#306770}
.brand{font-size:13px;color:#306770;letter-spacing:3px;font-weight:700;margin-bottom:24px;display:block}
footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#aaa}
</style>
</head>
<body>
<div class="wrap">
<span class="brand">WANDER/WORK</span>
${bodyHtml}
<footer>&copy; 2026 Wander/Work. All rights reserved.</footer>
</div>
</body>
</html>`;

app.get('/privacy', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(staticPage('Privacy Policy', `
<h1>Privacy Policy</h1>
<p class="meta">Effective Date: January 3, 2026 &nbsp;|&nbsp; Last Updated: June 14, 2026</p>

<p>Wander/Work ("we," "our," or "us") operates the Wander/Work platform, including our website, browser extension, and AI-assisted job-search tools (the "Services"). This policy explains what data we collect, how we use it, and your choices.</p>

<h2>What We Collect</h2>
<ul>
<li><strong>Profile data you provide:</strong> name, email, phone, location, LinkedIn, portfolio, GitHub, resume, and professional links.</li>
<li><strong>Account credentials:</strong> your email and hashed password (we never store plain-text passwords).</li>
<li><strong>Extension key:</strong> a unique token stored locally in your browser to authenticate extension requests.</li>
<li><strong>Usage data:</strong> pages visited, features used, and error logs to improve the service.</li>
<li><strong>Payment info:</strong> processed by Stripe — we do not store card numbers.</li>
</ul>

<h2>What We Do Not Collect</h2>
<ul>
<li>We do not track your browsing history.</li>
<li>We do not log which job applications you visit or submit outside our platform.</li>
<li>We do not collect keystrokes, mouse movements, or behavioral telemetry.</li>
<li>We collect only what is necessary to provide the service.</li>
</ul>

<h2>How We Use Your Data</h2>
<ul>
<li>To match you with relevant job listings and generate tailored resumes and cover letters.</li>
<li>To autofill job application forms via the browser extension using your saved profile.</li>
<li>To send documents (resume, cover letter) to your email when you request them.</li>
<li>To process payments and manage your subscription.</li>
<li>To improve the platform through aggregated, anonymized analytics.</li>
</ul>

<h2>AI Features</h2>
<p>When you request a resume, cover letter, or recruiter email, we send relevant portions of your profile and the job description to OpenAI's API. This data is processed under OpenAI's API data usage policy, which prohibits using API inputs to train their models by default. We do not sell this data.</p>

<h2>We Do Not Sell Your Data</h2>
<p>We do not sell, rent, or share your personal information with third parties for advertising or marketing. We share data only with service providers (hosting, email delivery, payment processing, AI providers) who are bound by strict confidentiality obligations.</p>

<h2>Data Retention</h2>
<p>Your data is retained while your account is active. You may request deletion at any time by emailing <a href="mailto:support@wanderwork.io">support@wanderwork.io</a>. We delete active profile data within 30 days of a deletion request.</p>

<h2>Your Rights</h2>
<ul>
<li>Access, correct, or delete your personal information at any time.</li>
<li>Export your data in a portable format upon request.</li>
<li>Opt out of marketing emails via the unsubscribe link in any email.</li>
<li>California residents may submit requests under CCPA to <a href="mailto:privacy@wanderwork.io">privacy@wanderwork.io</a>.</li>
</ul>

<h2>Security</h2>
<p>We use TLS encryption in transit, bcrypt password hashing, and JWT authentication with expiration. No transmission method is 100% secure, but we follow industry-standard practices to protect your information.</p>

<h2>Contact</h2>
<p>Questions about this policy? Email us at <a href="mailto:privacy@wanderwork.io">privacy@wanderwork.io</a>.</p>
`));
});

app.get('/support', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(staticPage('Support', `
<h1>Support</h1>
<p class="meta">We're here to help.</p>

<h2>Get Help</h2>
<p>For questions, issues, or feedback about Wander/Work or the Wander/Work Autofill extension, reach out to us:</p>
<ul>
<li>Email: <a href="mailto:support@wanderwork.io">support@wanderwork.io</a></li>
</ul>

<h2>Report a Bug</h2>
<p>Found something broken? Email us at <a href="mailto:support@wanderwork.io">support@wanderwork.io</a> with a description of what happened and we'll look into it promptly.</p>

<h2>Extension Issues</h2>
<ul>
<li><strong>Can't connect:</strong> Make sure you have a Pro or Premium Wander/Work account and are using the correct extension key from your Settings page.</li>
<li><strong>Autofill not working:</strong> The extension supports Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, and Jobvite. Other job boards may not be supported yet.</li>
<li><strong>Key not found:</strong> Log in to wanderwork.io, go to Settings, and copy your extension key from the Extension section.</li>
</ul>

<h2>Response Time</h2>
<p>We typically respond within 1 to 2 business days.</p>
`));
});

app.use(checkConnection);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    } else if (filePath.endsWith('.docx')) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (filePath.endsWith('.doc')) {
      res.setHeader('Content-Type', 'application/msword');
    }
  }
}));

// Passport session (used by LinkedIn OAuth redirect flow)
const passport = require('passport');
const session = require('express-session');
app.use(session({
  name: 'ww.oauth.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  }, // 10-min session for OAuth only
}));
app.use(passport.initialize());
app.use(passport.session());

// Route definitions
const routes = {
  '/tags': './routes/tagRoutes',
  '/users': './routes/userRoutes',
  '/posts': './routes/postRoutes',
  '/comment': './routes/commentRoutes',
  '/crowns': './routes/achievementsRoutes',
  '/notifications': './routes/notificationRoutes',
  '/auth': './routes/authenticationRoutes',
  '/admin': './routes/adminSettingsRoutes',
  '/voiting': './routes/voitingRouters',
  '/votes': './routes/votesRouter',
  '/wallet': './routes/walletRoutes',
  '/walletmethod': './routes/walletMethodRoutes',
  '/wallettransaction': './routes/walletTrasactionRoutes',
  '/conversations': './routes/conversationRoutes',
  '/messages': './routes/messageRoutes',
  '/stripe': './routes/stripeRoutes',
  '/xp': './routes/xpRoutes',
  '/codes': './routes/codeRedemptionRoutes',
  '/groups': './routes/groupRoutes',
  '/events': './routes/eventRoutes',
  '/inventory': './routes/inventoryRoutes',
  '/orders': './routes/orderRoutes',
  '/shop-layout': './routes/shopLayoutRoutes',
  '/jobseeker': './routes/JobSeeker/jobSeekerRoute',
  '/recruiter': './routes/JobSeeker/recruiterRoute',
  '/sync': './routes/sync',
  '/tally': './routes/tallyWebhook',
  '/oauth': './routes/oauthRoutes',
};

// Register routes
Object.entries(routes).forEach(([path, route]) => {
  app.use(path, require(route));
});

// Initialize Airtable sync scheduler
initScheduledSync();
initJobDigestSchedule();
if (process.env.ENABLE_RECRUITER_COMPANY_PAIRING_SCHEDULE !== 'false') {
  scheduleRecruiterCompanyPairing({
    intervalMs: Number(process.env.RECRUITER_COMPANY_PAIR_INTERVAL_MS) || undefined,
  });
}

// Register Twitter and Image routes
twitterRoutes(app);
imageRoutes(app);
//initializeBots();

// Graceful shutdown handling
const gracefulShutdown = async () => {
  console.log('Initiating graceful shutdown...');
  await shutdownBots();
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server function
const startServer = async () => {
  try {
    await connectDB();
    purgeJunkJobs(); // fire-and-forget: delete scraped search-result pages from the jobs collection
    purgeJobs();    // fire-and-forget: remove stale/low-quality jobs on every deploy
    pairAllCandidates().catch(e => console.warn('[Startup] pairAllCandidates failed:', e.message)); // re-score matches with latest algorithm
    backfillCandidateResumeFields(); // fire-and-forget: extract work_experience/education from resume_text
    initRemoteJobsImport(); // after DB connects so the startup import has an active connection

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Initialize server
let server;
startServer().then(s => {
  server = s;
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});





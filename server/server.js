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





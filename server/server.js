require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const bodyParser = require('body-parser');
const cors = require("cors");
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
const syncRoutes = require('./routes/sync');

// Import schedules
require("./schedules/postsJobs");
require("./schedules/starsJobs");

const app = express();
const PORT = process.env.PORT || 8000;

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

// Middleware setup
app.use(bodyParser.json({ type: 'application/json; charset=utf-8' }));
app.use(cors({
  origin: "*",
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json());

// UTF-8 Header Middleware
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  next();
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
  secret: process.env.SESSION_SECRET || 'ww-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 10 * 60 * 1000 }, // 10-min session for OAuth only
}));
app.use(passport.initialize());
app.use(passport.session());

// const rateLimit = require("express-rate-limit");

// const limiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 100,
//   message: "Too many requests, please try again later."
// });

// app.use(limiter);

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
  '/oauth': './routes/oauthRoutes'
};

// Register routes
Object.entries(routes).forEach(([path, route]) => {
  app.use(path, require(route));
});

// Initialize Airtable sync scheduler
initScheduledSync();
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
    backfillCandidateResumeFields(); // fire-and-forget: extract work_experience/education from resume_text

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





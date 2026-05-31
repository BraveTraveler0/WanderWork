// One-time test script: sends a weekly token email to a test address and saves the grant to DB
// Run: node server/scripts/sendTestTokenEmail.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const { weeklyTokenEmail } = require('../utils/mail.templates');
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');

const APP_URL = 'https://wanderwork.io';
const TEST_EMAIL = 'darrienccarter@gmail.com';

async function main() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) { console.error('SENDGRID_API_KEY not set in server/.env'); process.exit(1); }
  if (!process.env.DATABASE_URI) { console.error('DATABASE_URI not set in server/.env'); process.exit(1); }

  await mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB');

  sgMail.setApiKey(apiKey);

  const candidate = await Candidates.findOne({ email: TEST_EMAIL });
  if (!candidate) {
    console.error(`No candidate found with email ${TEST_EMAIL}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found candidate: ${candidate.firstName} ${candidate.lastName} (${candidate.email})`);

  const amount = 1;
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Candidates.findByIdAndUpdate(candidate._id, {
    weeklyTokenGrant: { token, amount, expiresAt, claimed: false, claimedAt: null },
  });
  console.log('Token grant saved to DB');

  const claimUrl = `${APP_URL}?claimToken=${token}&claimEmail=${encodeURIComponent(TEST_EMAIL)}`;
  const template = weeklyTokenEmail(candidate.firstName || 'Darrien', amount, claimUrl);

  try {
    await sgMail.send({ to: TEST_EMAIL, ...template });
    console.log(`Test email sent to ${TEST_EMAIL}`);
    console.log(`Claim URL: ${claimUrl}`);
  } catch (err) {
    console.error('Send failed:', err?.response?.body || err.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
}

main();

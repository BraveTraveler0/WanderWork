/**
 * Legacy command shim.
 *
 * This used to send a one-off launch email. Keep the filename for anyone who still
 * has the old command bookmarked, but send the same welcome email new users
 * normally receive at signup.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const Candidate = require('./models/JobSeeker/jobSeeker.Candidate');
const { sendWelcomeEmail } = require('./utils/welcomeEmail');

async function main() {
  if (!process.env.DATABASE_URI) {
    console.error('DATABASE_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB.');

  const singleEmail = process.env.WELCOME_EMAIL_TO || null;
  const query = singleEmail
    ? { email: singleEmail }
    : { email: { $exists: true, $ne: '' } };

  const candidates = await Candidate.find(query, 'firstName email plan').lean();
  console.log(`Found ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}.`);

  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    if (!candidate.email) continue;
    try {
      const result = await sendWelcomeEmail({
        email: candidate.email,
        firstName: candidate.firstName,
        plan: candidate.plan || 'Free',
      });

      if (result.sent) {
        console.log(`  Sent standard welcome email to ${candidate.email}`);
        sent++;
      } else {
        console.warn(`  Skipped ${candidate.email}: ${result.reason || 'not sent'}`);
        failed++;
      }
    } catch (err) {
      console.warn(`  Failed for ${candidate.email}: ${err.message}`);
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`Done. Sent: ${sent}, Failed/skipped: ${failed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

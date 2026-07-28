const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const mongoose = require('mongoose');
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');
const Applications = require('../models/JobSeeker/jobSeeker.Application');
const { weeklyTokenEmail } = require('../utils/mail.templates');
const { getPublicAppUrl } = require('../utils/publicUrls');

const APP_URL = getPublicAppUrl();
const TOKEN_CAP = 30;
const LUCKY_CHANCE = 0.1;
const LUCKY_AMOUNT = 3;
const NORMAL_AMOUNT = 1;
const EXPIRY_DAYS = 7;

async function sendWeeklyTokenEmails() {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const eligible = await Candidates.find({
    email: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { tokenBalance: { $lt: TOKEN_CAP } },
      { tokenBalance: null },
      { tokenBalance: { $exists: false } },
    ],
  }).lean();

  console.log(`[WeeklyToken] Sending to ${eligible.length} eligible candidates`);

  let sent = 0;
  let errors = 0;

  for (const candidate of eligible) {
    try {
      const amount = Math.random() < LUCKY_CHANCE ? LUCKY_AMOUNT : NORMAL_AMOUNT;
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await Candidates.findByIdAndUpdate(candidate._id, {
        weeklyTokenGrant: { token, amount, expiresAt, claimed: false, claimedAt: null },
      });

      const claimUrl = `${APP_URL}?claimToken=${token}&claimEmail=${encodeURIComponent(candidate.email)}`;
      const template = weeklyTokenEmail(candidate.firstName, amount, claimUrl);

      await sgMail.send({ to: candidate.email, ...template });
      sent++;
      console.log(`[WeeklyToken] Sent to ${candidate.email} (amount: ${amount})`);
    } catch (err) {
      errors++;
      console.error(`[WeeklyToken] Failed for ${candidate.email}:`, err.message);
    }
  }

  console.log(`[WeeklyToken] Done. Sent: ${sent}, Errors: ${errors}, Total eligible: ${eligible.length}`);
  return { sent, errors, total: eligible.length };
}

async function claimWeeklyToken(email, token) {
  const normalizedEmail = String(email).toLowerCase().trim();
  const candidate = await Candidates.findOne({ email: normalizedEmail });

  if (!candidate) {
    return { success: false, error: 'Account not found.' };
  }

  const grant = candidate.weeklyTokenGrant;

  if (!grant || !grant.token) {
    return { success: false, error: 'No free token is available to claim right now. Check back Thursday!' };
  }

  if (grant.claimed) {
    return { success: false, error: 'This token has already been claimed.' };
  }

  if (!grant.expiresAt || new Date() > new Date(grant.expiresAt)) {
    return { success: false, error: 'This token link has expired. A new one will arrive next Thursday.' };
  }

  if (grant.token !== token) {
    return { success: false, error: 'Invalid claim link.' };
  }

  // Atomic claim: re-checking token/claimed state in the filter (not just in the
  // earlier reads above) means a concurrent duplicate request — double-click, retry,
  // or a replayed link — can't both pass and grant tokens twice.
  const updated = await Candidates.findOneAndUpdate(
    {
      _id: candidate._id,
      'weeklyTokenGrant.token': token,
      'weeklyTokenGrant.claimed': false,
    },
    {
      $inc: { tokenBalance: grant.amount },
      'weeklyTokenGrant.claimed': true,
      'weeklyTokenGrant.claimedAt': new Date(),
    },
    { new: true }
  );

  if (!updated) {
    return { success: false, error: 'This token has already been claimed.' };
  }

  const plural = grant.amount > 1;
  const surprise = plural ? ' Looks like you got lucky this week!' : '';

  try {
    await Applications.create({
      jobId: new mongoose.Types.ObjectId(),
      candidateId: candidate._id,
      preparedAt: new Date(),
      status: 'system',
      jobTitle: `+${grant.amount} Free Token${plural ? 's' : ''} Added`,
      company: 'WanderWork',
      resume: {},
      coverLetter: `Your free token${plural ? 's have' : ' has'} been added to your account.${surprise} We know things can be tough out there. We are rooting for you. Keep going, your next role is out there.`,
    });
  } catch (msgErr) {
    console.error('[WeeklyToken] System message failed (non-fatal):', msgErr.message);
  }

  return {
    success: true,
    tokensAdded: grant.amount,
    newBalance: updated.tokenBalance,
  };
}

module.exports = { sendWeeklyTokenEmails, claimWeeklyToken };

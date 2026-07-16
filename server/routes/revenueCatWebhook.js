const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');

// Product IDs must match exactly what's configured in App Store Connect /
// Play Console / RevenueCat — see WanderworkMobile/README.md.
const TOKEN_PACK_AMOUNTS = {
  wanderwork_tokens_10: 10,
  wanderwork_tokens_30: 30,
  wanderwork_tokens_100: 100,
};

const SUBSCRIPTION_PLANS = {
  wanderwork_pro_monthly: 'pro',
  wanderwork_premium_monthly: 'premium',
};

// RevenueCat authenticates webhooks with a static Authorization header value
// (configured in the RevenueCat dashboard, not a cryptographic signature like
// Stripe's), so a plain string match is the correct verification here.
router.post('/webhook', express.json(), async (req, res) => {
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[RevenueCat] REVENUECAT_WEBHOOK_SECRET is not set — webhook rejected for security');
    return res.status(400).json({ message: 'Webhook not configured' });
  }
  if (req.headers['authorization'] !== expectedSecret) {
    return res.status(401).json({ message: 'Invalid webhook auth' });
  }

  try {
    const event = req.body?.event || {};
    const email = String(event.app_user_id || '').trim().toLowerCase();
    const productId = event.product_id;
    const eventType = event.type;

    if (!email || !email.includes('@')) {
      // Anonymous RevenueCat user (never logged in / app_user_id wasn't set
      // to the account email) — nothing to credit.
      return res.json({ received: true });
    }

    if (eventType === 'NON_RENEWING_PURCHASE' && TOKEN_PACK_AMOUNTS[productId]) {
      await Candidates.findOneAndUpdate(
        { email },
        { $inc: { tokenBalance: TOKEN_PACK_AMOUNTS[productId] } },
        { sort: { createdAt: -1 } }
      );
    }

    if (['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION'].includes(eventType) && SUBSCRIPTION_PLANS[productId]) {
      const user = await User.findOne({ email });
      if (user) {
        user.plan = SUBSCRIPTION_PLANS[productId];
        user.planExpiresAt = null;
        await user.save();
      }
    }

    if (['CANCELLATION', 'EXPIRATION'].includes(eventType)) {
      const user = await User.findOne({ email });
      if (user) {
        user.plan = 'starter';
        user.planExpiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : new Date();
        await user.save();
      }
    }
  } catch (err) {
    console.error('RevenueCat webhook handler error:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;

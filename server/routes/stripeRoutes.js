const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Candidate = require('../models/JobSeeker/jobSeeker.Candidate');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Price IDs — set these in .env after creating products in your Stripe dashboard
// STRIPE_PRO_PRICE_ID     → recurring $19/mo price
// STRIPE_PREMIUM_PRICE_ID → recurring $49/mo price
const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  premium: process.env.STRIPE_PREMIUM_PRICE_ID,
};

// ── POST /stripe/create-checkout-session ─────────────────────────────────────
// Body: { plan: 'pro' | 'premium', email: string }
// Returns: { url: string } — Stripe-hosted checkout page
router.post('/create-checkout-session', async (req, res) => {
  const { plan, email } = req.body || {};

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({
      message: !PRICE_IDS[plan]
        ? `STRIPE_${plan?.toUpperCase()}_PRICE_ID is not set in environment variables.`
        : 'plan must be "pro" or "premium".',
    });
  }

  try {
    const user = email ? await User.findOne({ email: String(email).toLowerCase() }) : null;

    // Reuse existing Stripe customer if available
    let customer = user?.stripeId || undefined;
    if (!customer && email) {
      const created = await stripe.customers.create({ email });
      customer = created.id;
      if (user) { user.stripeId = customer; await user.save(); }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer || undefined,
      customer_email: customer ? undefined : email,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${APP_URL}?checkout=success&plan=${plan}`,
      cancel_url: `${APP_URL}?checkout=cancelled`,
      metadata: { plan, email: email || '' },
      subscription_data: {
        metadata: { plan, email: email || '' },
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /stripe/create-token-checkout-session
// Body: { tokens: number, email: string }
// Creates a one-time Stripe Checkout payment for token packs.
router.post('/create-token-checkout-session', async (req, res) => {
  const { tokens, email } = req.body || {};
  const tokenQty = Number(tokens);

  if (!Number.isInteger(tokenQty) || tokenQty < 1 || tokenQty > 1000) {
    return res.status(400).json({ message: 'tokens must be a whole number between 1 and 1000.' });
  }

  const amountCents = Math.max(50, Math.round((tokenQty / 3) * 100));

  try {
    const normalizedEmail = email ? String(email).toLowerCase() : '';
    const user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;

    let customer = user?.stripeId || undefined;
    if (!customer && normalizedEmail) {
      const created = await stripe.customers.create({ email: normalizedEmail });
      customer = created.id;
      if (user) { user.stripeId = customer; await user.save(); }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customer || undefined,
      customer_email: customer ? undefined : normalizedEmail || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `Wander/Work Tokens (${tokenQty})`,
            description: 'AI resume, cover letter, and recruiter outreach credits',
          },
        },
      }],
      success_url: `${APP_URL}?checkout=success&type=tokens&tokens=${tokenQty}`,
      cancel_url: `${APP_URL}?checkout=cancelled&type=tokens`,
      metadata: {
        type: 'tokens',
        tokens: String(tokenQty),
        email: normalizedEmail,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe token checkout session error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /stripe/webhook ──────────────────────────────────────────────────────
// Stripe sends raw body — must use express.raw() middleware (registered in server.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const rawBody = req.rawBody || req.body;
    event = webhookSecret
      ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
      : JSON.parse(rawBody.toString());
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;
      const plan = session.metadata?.plan;
      const tokenQty = Number(session.metadata?.tokens || 0);

      if (session.metadata?.type === 'tokens' && email && Number.isFinite(tokenQty) && tokenQty > 0) {
        await Candidate.findOneAndUpdate(
          { email: String(email).toLowerCase() },
          { $inc: { tokenBalance: tokenQty } },
          { sort: { createdAt: -1 } }
        );
      }

      if (email && plan) {
        const user = await User.findOne({ email: String(email).toLowerCase() });
        if (user) {
          user.plan = plan;
          user.stripeSubscriptionId = session.subscription || null;
          user.stripeId = session.customer || user.stripeId;
          user.planExpiresAt = null;
          await user.save();

          // Send welcome email (non-blocking)
          try {
            const sgMail = require('@sendgrid/mail');
            const { proWelcomeEmail, premiumWelcomeEmail } = require('../utils/mail.templates');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const template = plan === 'pro' ? proWelcomeEmail(user.displayName) : premiumWelcomeEmail(user.displayName);
            await sgMail.send({ to: email, ...template });
          } catch (mailErr) {
            console.warn('Welcome email failed after checkout:', mailErr.message);
          }
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customer = sub.customer;
      if (customer) {
        const user = await User.findOne({ stripeId: customer });
        if (user) {
          user.plan = 'starter';
          user.stripeSubscriptionId = null;
          user.planExpiresAt = new Date(sub.current_period_end * 1000);
          await user.save();
        }
      }
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err.message);
  }

  res.json({ received: true });
});

// ── POST /stripe/redeem-code ──────────────────────────────────────────────────
// Body: { code, email, tokens }
// Validates promo code server-side (PROMO_CODES env var), prevents reuse, adds tokens atomically.
router.post('/redeem-code', async (req, res) => {
  const { code, email, tokens } = req.body || {};
  if (!code || !email) {
    return res.status(400).json({ message: 'code and email are required.' });
  }

  const tokenQty = Number(tokens);
  if (!Number.isInteger(tokenQty) || tokenQty < 1 || tokenQty > 1000) {
    return res.status(400).json({ message: 'tokens must be a whole number between 1 and 1000.' });
  }

  const validCodes = (process.env.PROMO_CODES || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const normalizedCode = code.trim().toLowerCase();

  if (!validCodes.includes(normalizedCode)) {
    return res.status(400).json({ message: 'Invalid code. Please check and try again.' });
  }

  try {
    const normalizedEmail = String(email).toLowerCase();
    const candidate = await Candidate.findOne({ email: normalizedEmail });
    if (!candidate) {
      return res.status(404).json({ message: 'No account found for this email.' });
    }

    const usedCodes = Array.isArray(candidate.usedPromoCodes) ? candidate.usedPromoCodes : [];
    if (usedCodes.includes(normalizedCode)) {
      return res.status(409).json({ message: 'This code has already been redeemed on your account.' });
    }

    const updated = await Candidate.findOneAndUpdate(
      { _id: candidate._id },
      { $inc: { tokenBalance: tokenQty }, $push: { usedPromoCodes: normalizedCode } },
      { new: true }
    );

    res.json({ tokenBalance: updated.tokenBalance, added: tokenQty });
  } catch (err) {
    console.error('redeem-code error:', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /stripe/create-payment-intent (legacy — kept for compatibility) ──────
router.post('/create-payment-intent', async (req, res) => {
  const { amount, userId, contentCreator } = req.body;
  try {
    if (!userId) return res.status(400).json({ message: 'Must include User ID for security reasons' });
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (!user.stripeId) return res.status(400).json({ message: 'User is not associated with a stripe account' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      customer: user.stripeId,
      description: `Payment to content creator: ${contentCreator}`,
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /stripe/portal ────────────────────────────────────────────────────────
// Opens Stripe Customer Portal so users can manage/cancel subscriptions
router.post('/portal', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'email is required' });

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user?.stripeId) return res.status(404).json({ message: 'No Stripe customer found for this account.' });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeId,
      return_url: `${APP_URL}/settings`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

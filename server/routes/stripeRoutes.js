const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

router.post('/create-payment-intent', async (req, res) => {
  const { amount, userId, contentCreator } = req.body;
  console.log(contentCreator)
  try {
    if (!userId) {
      return res.status(400).json({ message: 'Must include User ID for security reasons'});
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: 'User not found'});
    }
    if (!user.stripeId) {
      return res.status(400).json({ message: 'User is not associated with a stripe account'});
    }
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // amount in cents
      currency: 'usd',
      customer: user.stripeId,
      description: `Payment to content creator: ${contentCreator}`
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);  // Logging any errors
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
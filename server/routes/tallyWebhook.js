const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const tallyWebhookController = require('../controllers/tallyWebhookController');

// Verify Tally webhook signature (HMAC-SHA256).
// Set TALLY_SIGNING_SECRET in env to match the secret in your Tally webhook settings.
function verifyTallySignature(req, res, next) {
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (!secret) {
    // If no secret is configured, fall back to a shared static token check
    const staticToken = process.env.TALLY_WEBHOOK_TOKEN;
    if (staticToken) {
      const provided = req.headers['x-tally-token'] || req.headers['authorization'];
      if (!provided || provided.replace(/^Bearer\s+/i, '') !== staticToken) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }
    return next();
  }

  const signature = req.headers['tally-signature'];
  if (!signature) return res.status(401).json({ success: false, message: 'Missing signature' });

  const rawBody = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }
  next();
}

router.post('/webhook', verifyTallySignature, tallyWebhookController.handleTallySubmission);

module.exports = router;

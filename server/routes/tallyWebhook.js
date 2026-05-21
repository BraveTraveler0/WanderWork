/**
 * Tally Webhook Route
 * Direct form submission from Tally → MongoDB (bypasses Airtable/n8n)
 */

const express = require('express');
const router = express.Router();
const tallyWebhookController = require('../controllers/tallyWebhookController');

/**
 * POST /api/tally/webhook
 * Receives Tally form submissions directly
 * 
 * Tally webhook payload structure:
 * {
 *   "eventId": "unique-event-id",
 *   "eventType": "FORM_RESPONSE",
 *   "createdAt": "2026-01-08T12:34:56.789Z",
 *   "data": {
 *     "responseId": "response-id",
 *     "submissionId": "submission-id",
 *     "respondentId": "respondent-id",
 *     "formId": "form-id",
 *     "formName": "Job Seeker Sign Up",
 *     "createdAt": "2026-01-08T12:34:56.789Z",
 *     "fields": [
 *       { "key": "question_id_1", "label": "First Name", "type": "INPUT_TEXT", "value": "Jane" },
 *       { "key": "question_id_2", "label": "Last Name", "type": "INPUT_TEXT", "value": "Doe" },
 *       { "key": "question_id_3", "label": "Email", "type": "INPUT_EMAIL", "value": "jane@example.com" },
 *       ...
 *     ]
 *   }
 * }
 */
router.post('/webhook', tallyWebhookController.handleTallySubmission);

/**
 * GET /api/tally/test
 * Test endpoint to verify webhook is working
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Tally webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

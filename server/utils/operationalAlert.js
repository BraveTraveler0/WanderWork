'use strict'

const sgMail = require('@sendgrid/mail')

const DEFAULT_RECIPIENTS = [
  'darrienccarter@gmail.com',
  'Mercedes.anthony20@gmail.com',
  'dsdavisjr3@gmail.com',
]
const COOLDOWN_MS = 30 * 60 * 1000
const lastSentByKey = new Map()

function recipients() {
  return String(process.env.ADMIN_ALERT_EMAILS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .concat(process.env.ADMIN_ALERT_EMAILS ? [] : DEFAULT_RECIPIENTS)
}

async function sendOperationalAlert(key, subject, details) {
  const now = Date.now()
  const lastSent = lastSentByKey.get(key) || 0
  if (now - lastSent < COOLDOWN_MS) return { sent: false, reason: 'cooldown' }

  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey || apiKey === 'SG.placeholder') {
    console.warn(`[OpsAlert] Cannot send "${subject}": SendGrid is not configured`)
    return { sent: false, reason: 'sendgrid_not_configured' }
  }

  sgMail.setApiKey(apiKey)
  const text = [
    details,
    '',
    `Time: ${new Date().toISOString()}`,
    `Environment: ${process.env.NODE_ENV || 'unknown'}`,
    `Service: ${process.env.RENDER_SERVICE_NAME || 'WanderWork backend'}`,
  ].join('\n')

  try {
    await sgMail.send({
      from: {
        name: 'WanderWork Operations',
        email: process.env.EMAIL_FROM || 'support@wanderwork.io',
      },
      to: recipients(),
      subject: `[WanderWork Alert] ${subject}`,
      text,
    })
    lastSentByKey.set(key, now)
    console.log(`[OpsAlert] Sent: ${subject}`)
    return { sent: true }
  } catch (error) {
    console.error('[OpsAlert] Send failed:', error.response?.body || error.message)
    return { sent: false, reason: error.message }
  }
}

module.exports = { sendOperationalAlert }

'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const { runCapitalWatchPipeline } = require('../scripts/capitalWatchPipeline.cjs')
const { weeklyDigestEmail } = require('../utils/capitalWatchEmail')
const { getPublicAppUrl } = require('../utils/publicUrls')

const RECIPIENTS = ['darrienccarter@gmail.com', 'Mercedes.anthony20@gmail.com', 'dsdavisjr3@gmail.com']

// Monday 8am EST = 13:00 UTC
const SCHEDULE = '0 13 * * 1'

let running = false

async function runImport() {
  if (running) { console.log('[CapitalWatch] Already in progress, skipping.'); return }
  running = true
  try {
    const result = await runCapitalWatchPipeline()

    if (result.inserted > 0) {
      const apiKey = process.env.SENDGRID_API_KEY
      if (!apiKey || apiKey === 'SG.placeholder') {
        console.log('[CapitalWatch] No SendGrid key set, skipping digest email.')
        return
      }
      sgMail.setApiKey(apiKey)
      const dashboardUrl = `${getPublicAppUrl()}/?capitalwatch=true`
      const msg = { ...weeklyDigestEmail(result.newGrants, dashboardUrl), to: RECIPIENTS }
      await sgMail.send(msg)
      console.log('[CapitalWatch] Digest sent to', RECIPIENTS.join(', '))
    }
  } catch (err) {
    console.error('[CapitalWatch] Cycle error:', err.message)
  } finally {
    running = false
  }
}

function initCapitalWatchImport() {
  console.log('[CapitalWatch] Import scheduled: Mondays at 8AM EST')
  cron.schedule(SCHEDULE, runImport)
  // Run once at startup so grants are available immediately
  setImmediate(runImport)
}

module.exports = { initCapitalWatchImport, runImport }

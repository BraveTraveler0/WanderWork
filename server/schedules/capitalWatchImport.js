'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const { runCapitalWatchPipeline } = require('../scripts/capitalWatchPipeline.cjs')
const { topMatchesDigestEmail } = require('../utils/capitalWatchEmail')
const { rankGrants } = require('../utils/capitalWatchScoring')
const { getPublicAppUrl } = require('../utils/publicUrls')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const { claimPeriod, releasePeriodClaim } = require('../utils/schedulerClaim')

const RECIPIENTS = ['darrienccarter@gmail.com', 'Mercedes.anthony20@gmail.com', 'dsdavisjr3@gmail.com']

// Wednesday 12am EST = 05:00 UTC
const SCHEDULE = '0 5 * * 3'

let running = false

function importWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

async function runImport() {
  if (running) { console.log('[CapitalWatch] Already in progress, skipping.'); return }
  running = true
  // Both production services run this cron. Claiming the week prevents a duplicate,
  // real-money Apify/OpenAI run on the same source batch.
  const weekKey = importWeekKey()
  const claimed = await claimPeriod('capital_watch_import', weekKey).catch((err) => {
    console.error('[CapitalWatch] Import claim check failed:', err.message)
    return false
  })
  if (!claimed) {
    console.log('[CapitalWatch] Import already claimed for this week by another instance, skipping.')
    running = false
    return
  }
  try {
    const result = await runCapitalWatchPipeline()

    if (result.inserted > 0) {
      const apiKey = process.env.SENDGRID_API_KEY
      if (!apiKey || apiKey === 'SG.placeholder') {
        console.log('[CapitalWatch] No SendGrid key set, skipping digest email.')
        return
      }
      sgMail.setApiKey(apiKey)
      const pending = await Grant.find({ status: 'pending' }).lean()
      const top = rankGrants(pending, 10)
      const dashboardUrl = `${getPublicAppUrl()}/?capitalwatch=true`
      const msg = { ...topMatchesDigestEmail(top, dashboardUrl), to: RECIPIENTS }
      await sgMail.send(msg)
      console.log('[CapitalWatch] Top-matches digest sent to', RECIPIENTS.join(', '))
    }
  } catch (err) {
    console.error('[CapitalWatch] Cycle error:', err.message)
    // Let next week's run (or a manual retry) try again rather than permanently
    // marking this week done on a failed attempt.
    await releasePeriodClaim('capital_watch_import', weekKey).catch(() => {})
  } finally {
    running = false
  }
}

function initCapitalWatchImport() {
  console.log('[CapitalWatch] Import scheduled: Wednesdays at 12AM EST')
  cron.schedule(SCHEDULE, runImport)
  // Deliberately NOT run-once-at-startup like the free job importers: each run burns
  // real Apify run minutes/quota, and dev-server restarts (nodemon) would otherwise
  // fire a fresh scrape on every file save. Trigger manually via the pipeline script
  // when you want fresh data outside the weekly schedule.
}

module.exports = { initCapitalWatchImport, runImport }

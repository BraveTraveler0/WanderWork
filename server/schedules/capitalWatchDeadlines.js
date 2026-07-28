'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const { deadlineAlertEmail } = require('../utils/capitalWatchEmail')
const { getPublicAppUrl } = require('../utils/publicUrls')
const { claimPeriod, releasePeriodClaim } = require('../utils/schedulerClaim')

const RECIPIENTS = ['darrienccarter@gmail.com', 'Mercedes.anthony20@gmail.com', 'dsdavisjr3@gmail.com']

// Daily 8am EST = 13:00 UTC
const SCHEDULE = '0 13 * * *'

// Checked most-urgent first: a deadline that's slipped past the 14-day window without
// being caught (e.g. the job was down) should only trigger its tightest matching tier,
// not all three at once.
const TIERS = [
  { key: '3d', maxDays: 3 },
  { key: '7d', maxDays: 7 },
  { key: '14d', maxDays: 14 },
]

function daysUntil(dueDate) {
  const due = new Date(`${dueDate}T00:00:00Z`)
  if (isNaN(due.getTime())) return null
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Math.round((due - todayUtc) / 86400000)
}

let running = false

function deadlineCheckDayKey(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10)
}

async function checkDeadlines() {
  if (running) { console.log('[CapitalWatch] Deadline check already in progress, skipping.'); return }
  running = true
  // Both production services run this cron. Claiming the day prevents both instances
  // from independently deciding the same grant is due and double-emailing the team.
  const dayKey = deadlineCheckDayKey()
  const claimed = await claimPeriod('capital_watch_deadlines', dayKey).catch((err) => {
    console.error('[CapitalWatch] Deadline claim check failed:', err.message)
    return false
  })
  if (!claimed) {
    console.log('[CapitalWatch] Deadline check already claimed for today by another instance, skipping.')
    running = false
    return
  }
  try {
    const grants = await Grant.find({
      status: { $in: ['pending', 'approved'] },
      rolling: { $ne: true },
      dueDate: { $exists: true, $nin: [null, ''] },
    })

    const dueByTier = { '3d': [], '7d': [], '14d': [] }

    for (const grant of grants) {
      const days = daysUntil(grant.dueDate)
      if (days === null || days < 0) continue

      const sent = new Set(grant.deadlineAlertsSent || [])
      const tier = TIERS.find((t) => days <= t.maxDays && !sent.has(t.key))
      if (!tier) continue

      dueByTier[tier.key].push(grant)
      // Mark coarser tiers as sent too -- no point alerting "2 weeks left" right after
      // "3 days left" already went out for the same grant.
      TIERS.filter((t) => t.maxDays >= tier.maxDays).forEach((t) => sent.add(t.key))
      grant.deadlineAlertsSent = [...sent]
      await grant.save()
    }

    const totalDue = TIERS.reduce((n, t) => n + dueByTier[t.key].length, 0)
    if (totalDue === 0) return

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey || apiKey === 'SG.placeholder') {
      console.log('[CapitalWatch] No SendGrid key set, skipping deadline alert email.')
      return
    }
    sgMail.setApiKey(apiKey)
    const dashboardUrl = `${getPublicAppUrl()}/?capitalwatch=true`
    const msg = { ...deadlineAlertEmail(dueByTier, dashboardUrl), to: RECIPIENTS }
    await sgMail.send(msg)
    console.log(`[CapitalWatch] Deadline alert sent for ${totalDue} grant(s).`)
  } catch (err) {
    console.error('[CapitalWatch] Deadline check error:', err.message)
    // Let tomorrow's run (or a manual retry) try again rather than permanently
    // marking today done on a failed attempt.
    await releasePeriodClaim('capital_watch_deadlines', dayKey).catch(() => {})
  } finally {
    running = false
  }
}

function initCapitalWatchDeadlines() {
  console.log('[CapitalWatch] Deadline check scheduled: daily at 8AM EST')
  cron.schedule(SCHEDULE, checkDeadlines)
}

module.exports = { initCapitalWatchDeadlines, checkDeadlines }

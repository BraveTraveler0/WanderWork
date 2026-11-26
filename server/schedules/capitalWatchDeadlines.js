'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const { deadlineAlertEmail } = require('../utils/capitalWatchEmail')
const { getCapitalWatchUrl } = require('../utils/publicUrls')
const { claimPeriod, releasePeriodClaim } = require('../utils/schedulerClaim')
const { RECIPIENTS, hasSendGrid } = require('../config/capitalWatchTeam')

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

const todayUtc = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

function daysUntil(dueDate) {
  const due = new Date(`${dueDate}T00:00:00Z`)
  if (isNaN(due.getTime())) return null
  return Math.round((due - todayUtc()) / 86400000)
}

let running = false

function deadlineCheckDayKey(now = new Date()) {
  return todayUtc(now).toISOString().slice(0, 10)
}

// Pending opportunities whose deadline has passed can't be applied to any more, so
// they leave the review list. Applied (approved) ones are left alone.
async function expirePastDue() {
  const today = deadlineCheckDayKey()
  const result = await Grant.updateMany(
    { status: 'pending', rolling: { $ne: true }, dueDate: { $regex: /^\d{4}-\d{2}-\d{2}$/, $lt: today } },
    { $set: { status: 'expired' } },
  )
  if (result.modifiedCount) console.log(`[CapitalWatch] Expired ${result.modifiedCount} pending opportunit${result.modifiedCount === 1 ? 'y' : 'ies'} past their deadline.`)
  return result.modifiedCount
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
    await expirePastDue()

    const grants = await Grant.find({
      status: { $in: ['pending', 'approved'] },
      rolling: { $ne: true },
      dueDate: { $exists: true, $nin: [null, ''] },
    }).select('title agency dueDate status link deadlineAlertsSent').lean()

    const dueByTier = { '3d': [], '7d': [], '14d': [] }
    const updates = []

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
      updates.push({ updateOne: { filter: { _id: grant._id }, update: { $set: { deadlineAlertsSent: [...sent] } } } })
    }

    if (!updates.length) return
    if (!hasSendGrid()) {
      console.log('[CapitalWatch] No SendGrid key set, skipping deadline alert email.')
      return
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    await sgMail.send({ ...deadlineAlertEmail(dueByTier, getCapitalWatchUrl()), to: RECIPIENTS })
    // Recorded only after the email went out, so a failed send is retried tomorrow.
    await Grant.bulkWrite(updates)
    console.log(`[CapitalWatch] Deadline alert sent for ${updates.length} grant(s).`)
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

module.exports = { initCapitalWatchDeadlines, checkDeadlines, expirePastDue }

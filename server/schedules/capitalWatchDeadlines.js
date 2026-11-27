'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const Decision = require('../models/CapitalWatch/capitalWatch.Decision')
const Business = require('../models/CapitalWatch/capitalWatch.Business')
const Member = require('../models/CapitalWatch/capitalWatch.Member')
const { deadlineAlertEmail } = require('../utils/capitalWatchEmail')
const { getCapitalWatchUrl, getPublicServerUrl } = require('../utils/publicUrls')
const { claimPeriod, releasePeriodClaim } = require('../utils/schedulerClaim')
const { hasSendGrid } = require('../config/capitalWatchTeam')
const { unsubscribeSig } = require('../utils/capitalWatchAuth')
const { invalidateGrants, DISMISSED_DAYS } = require('../utils/capitalWatchData')
const OutboundEmail = require('../models/CapitalWatch/capitalWatch.OutboundEmail')

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
const dayKey = (now = new Date()) => todayUtc(now).toISOString().slice(0, 10)

function daysUntil(dueDate) {
  const due = new Date(`${dueDate}T00:00:00Z`)
  if (isNaN(due.getTime())) return null
  return Math.round((due - todayUtc()) / 86400000)
}

let running = false

// Opportunities whose deadline has passed leave everyone's matches.
async function expirePastDue() {
  const result = await Grant.updateMany(
    { status: { $ne: 'expired' }, rolling: { $ne: true }, dueDate: { $regex: /^\d{4}-\d{2}-\d{2}$/, $lt: dayKey() } },
    { $set: { status: 'expired' } },
  )
  if (result.modifiedCount) {
    invalidateGrants()
    console.log(`[CapitalWatch] Expired ${result.modifiedCount} opportunit${result.modifiedCount === 1 ? 'y' : 'ies'} past their deadline.`)
  }
  return result.modifiedCount
}

// Discarded Outbox drafts are deleted 3 days after they were discarded. (Dismissed
// opportunities leave the Dismissed list after 3 days too; that's a filter in the
// routes, and a small record stays so they never come back as matches.)
async function clearOldDiscards() {
  const result = await OutboundEmail.deleteMany({ status: 'discarded', updatedAt: { $lt: new Date(Date.now() - DISMISSED_DAYS * 86400000) } })
  if (result.deletedCount) console.log(`[CapitalWatch] Deleted ${result.deletedCount} discarded Outbox draft${result.deletedCount === 1 ? '' : 's'}.`)
  return result.deletedCount
}

// Applied and saved opportunities with a deadline coming up, one email per person,
// covering every business they're on.
async function checkDeadlines() {
  if (running) { console.log('[CapitalWatch] Deadline check already in progress, skipping.'); return }
  running = true
  // Both production services run this cron. Claiming the day prevents both instances
  // from emailing the same alerts.
  const key = dayKey()
  const claimed = await claimPeriod('capital_watch_deadlines', key).catch((err) => {
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
    await clearOldDiscards()
    if (!hasSendGrid()) { console.log('[CapitalWatch] No SendGrid key set, skipping deadline alerts.'); return }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    const decisions = await Decision.find({ status: { $in: ['approved', 'archived'] } }).select('business grant status deadlineAlertsSent').lean()
    const grants = await Grant.find({
      _id: { $in: [...new Set(decisions.map((d) => String(d.grant)))] },
      rolling: { $ne: true },
      dueDate: { $exists: true, $nin: [null, ''] },
    }).select('title agency dueDate link').lean()
    const grantById = new Map(grants.map((g) => [String(g._id), g]))

    // Per business: what's due, by tier, and which decision updates to save once sent.
    const perBusiness = new Map()
    for (const d of decisions) {
      const g = grantById.get(String(d.grant))
      if (!g) continue
      const days = daysUntil(g.dueDate)
      if (days === null || days < 0) continue
      const sent = new Set(d.deadlineAlertsSent || [])
      const tier = TIERS.find((t) => days <= t.maxDays && !sent.has(t.key))
      if (!tier) continue
      // Mark coarser tiers too: no "2 weeks left" right after "3 days left".
      TIERS.filter((t) => t.maxDays >= tier.maxDays).forEach((t) => sent.add(t.key))
      const entry = perBusiness.get(String(d.business)) || { items: [], updates: [] }
      entry.items.push({ tier: tier.key, grant: { ...g, status: d.status } })
      entry.updates.push({ updateOne: { filter: { _id: d._id }, update: { $set: { deadlineAlertsSent: [...sent] } } } })
      perBusiness.set(String(d.business), entry)
    }
    if (!perBusiness.size) return

    const businesses = await Business.find({ _id: { $in: [...perBusiness.keys()] } }).select('name memberIds').lean()
    const members = await Member.find({ _id: { $in: businesses.flatMap((b) => b.memberIds) }, digestOptOut: { $ne: true } }).select('email').lean()

    let sent = 0
    for (const m of members) {
      const mine = businesses.filter((b) => b.memberIds.some((id) => String(id) === String(m._id)))
      const dueByTier = { '3d': [], '7d': [], '14d': [] }
      for (const b of mine) {
        for (const item of perBusiness.get(String(b._id))?.items || []) dueByTier[item.tier].push({ ...item.grant, businessName: mine.length > 1 ? b.name : '' })
      }
      if (!Object.values(dueByTier).some((list) => list.length)) continue
      const unsubscribe = `${getPublicServerUrl()}/capitalwatch/unsubscribe?m=${m._id}&s=${unsubscribeSig(String(m._id))}`
      try {
        await sgMail.send({ ...deadlineAlertEmail(dueByTier, getCapitalWatchUrl(), unsubscribe), to: m.email })
        sent++
      } catch (err) {
        console.error('[CapitalWatch] Deadline alert failed:', err.message)
      }
    }
    // Recorded only after sending, so a day where every send failed is retried tomorrow.
    if (sent) await Decision.bulkWrite([...perBusiness.values()].flatMap((e) => e.updates))
    console.log(`[CapitalWatch] Deadline alerts sent to ${sent} member(s).`)
  } catch (err) {
    console.error('[CapitalWatch] Deadline check error:', err.message)
    await releasePeriodClaim('capital_watch_deadlines', key).catch(() => {})
  } finally {
    running = false
  }
}

function initCapitalWatchDeadlines() {
  console.log('[CapitalWatch] Deadline check scheduled: daily at 8AM EST')
  cron.schedule(SCHEDULE, checkDeadlines)
}

module.exports = { initCapitalWatchDeadlines, checkDeadlines, expirePastDue, clearOldDiscards }

'use strict'

const cron = require('node-cron')
const sgMail = require('@sendgrid/mail')
const { runCapitalWatchPipeline } = require('../scripts/capitalWatchPipeline.cjs')
const { memberDigestEmail } = require('../utils/capitalWatchEmail')
const { getCapitalWatchUrl, getPublicServerUrl } = require('../utils/publicUrls')
const { claimPeriod, releasePeriodClaim } = require('../utils/schedulerClaim')
const { hasSendGrid } = require('../config/capitalWatchTeam')
const { invalidateGrants, matchesFor } = require('../utils/capitalWatchData')
const { unsubscribeSig } = require('../utils/capitalWatchAuth')
const Member = require('../models/CapitalWatch/capitalWatch.Member')
const Business = require('../models/CapitalWatch/capitalWatch.Business')

// Wednesday 12am EST = 05:00 UTC
const SCHEDULE = '0 5 * * 3'
const NEW_WINDOW_DAYS = 8
const PER_BUSINESS = 5
const SEND_BATCH = 25

let running = false

function importWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

const unsubscribeUrl = (memberId) => `${getPublicServerUrl()}/capitalwatch/unsubscribe?m=${memberId}&s=${unsubscribeSig(memberId)}`

// One email per member: the best opportunities found this week for each of their
// businesses. Members with nothing new get nothing.
async function sendWeeklyDigests() {
  if (!hasSendGrid()) { console.log('[CapitalWatch] No SendGrid key set, skipping digests.'); return 0 }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  const since = Date.now() - NEW_WINDOW_DAYS * 86400000
  const members = await Member.find({ digestOptOut: { $ne: true } }).select('email').lean()
  const businesses = await Business.find({ memberIds: { $in: members.map((m) => m._id) } }).lean()

  // Matches are computed once per business, then shared by everyone on it.
  const newByBusiness = new Map()
  for (const b of businesses) {
    const fresh = (await matchesFor(b)).filter((g) => new Date(g.dateFound).getTime() >= since).slice(0, PER_BUSINESS)
    if (fresh.length) newByBusiness.set(String(b._id), { businessName: b.name, matches: fresh })
  }

  const messages = []
  for (const m of members) {
    const sections = businesses
      .filter((b) => b.memberIds.some((id) => String(id) === String(m._id)))
      .map((b) => newByBusiness.get(String(b._id)))
      .filter(Boolean)
    if (sections.length) messages.push({ ...memberDigestEmail(sections, getCapitalWatchUrl(), unsubscribeUrl(String(m._id))), to: m.email })
  }

  let sent = 0
  for (let i = 0; i < messages.length; i += SEND_BATCH) {
    const results = await Promise.allSettled(messages.slice(i, i + SEND_BATCH).map((msg) => sgMail.send(msg)))
    sent += results.filter((r) => r.status === 'fulfilled').length
    results.filter((r) => r.status === 'rejected').forEach((r) => console.error('[CapitalWatch] Digest send failed:', r.reason?.message))
  }
  console.log(`[CapitalWatch] Weekly digest sent to ${sent} of ${messages.length} member(s).`)
  return sent
}

async function runImport() {
  if (running) { console.log('[CapitalWatch] Already in progress, skipping.'); return }
  running = true
  // Both production services run this cron. Claiming the week prevents a duplicate,
  // real-money Apify/AI run on the same source batch.
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
    invalidateGrants()
    if (result.inserted > 0) await sendWeeklyDigests()
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

module.exports = { initCapitalWatchImport, runImport, sendWeeklyDigests, unsubscribeUrl }

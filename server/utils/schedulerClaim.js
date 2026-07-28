'use strict'

// Both production services run every scheduled job (there is no single "leader"
// instance), so anything that fires on a schedule needs an explicit cross-instance
// claim or it silently double-runs — duplicate emails, duplicate paid Apify/OpenAI
// calls, or a second instance clobbering data the first just wrote. This mirrors the
// per-candidate claim pattern already used in schedules/jobDigestJob.js and
// schedules/adminWeeklyDigest.js, generalized for reuse.

const mongoose = require('mongoose')

function claimsCollection() {
  return mongoose.connection.db.collection('scheduler_claims')
}

// For jobs that run once per calendar period (day/week/month) and either process a
// list of items one at a time or run as a single batch. Returns true if this instance
// won the claim for (jobName, periodKey) and should proceed; false if another instance
// already claimed it. No expiry needed — the period key itself rotates over time.
async function claimPeriod(jobName, periodKey) {
  const _id = `${jobName}:${periodKey}`
  try {
    await claimsCollection().insertOne({ _id, jobName, periodKey, claimedAt: new Date() })
    return true
  } catch (err) {
    if (err && err.code === 11000) return false
    throw err
  }
}

// Releases a period claim so a failed run can be retried on the next tick instead of
// being permanently marked done for that period.
async function releasePeriodClaim(jobName, periodKey) {
  await claimsCollection().deleteOne({ _id: `${jobName}:${periodKey}` }).catch(() => {})
}

// For jobs that run continuously on a fixed interval (not aligned to a calendar
// period). Acquires a short-lived lock keyed by jobName; returns true if acquired.
// The lock expires on its own after ttlMs so a crashed instance can't jam future runs.
async function acquireLock(jobName, ttlMs) {
  const now = new Date()
  try {
    await claimsCollection().updateOne(
      { _id: jobName, expiresAt: { $lte: now } },
      { $set: { jobName, expiresAt: new Date(now.getTime() + ttlMs), acquiredAt: now } },
      { upsert: true }
    )
    return true
  } catch (err) {
    if (err && err.code === 11000) return false
    throw err
  }
}

module.exports = { claimPeriod, releasePeriodClaim, acquireLock }

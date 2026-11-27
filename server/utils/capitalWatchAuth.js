'use strict'

// Capital Watch accounts: sign in with a one-time emailed link, then a signed session
// token (30 days) in the Authorization header. No passwords to store or leak.

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const Member = require('../models/CapitalWatch/capitalWatch.Member')
const { ADMIN_EMAILS } = require('../config/capitalWatchTeam')

const AUDIENCE = 'capitalwatch'
const SESSION_DAYS = 30

// Its own secret when set; otherwise the app's JWT secret, with a separate audience
// so a Wander/Work login token can't be used here (or the reverse).
const secret = () => process.env.CAPITAL_WATCH_JWT_SECRET || process.env.JWT_SECRET

// Daily AI allowances. Free members get enough to be useful; admins get more.
const LIMITS = {
  member: { questions: 25, drafts: 5, businesses: 5 },
  admin: { questions: 300, drafts: 50, businesses: 20 },
}
const limitsFor = (member) => LIMITS[member.role] || LIMITS.member

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const newLoginToken = () => crypto.randomBytes(32).toString('base64url')
const isAdminEmail = (email) => ADMIN_EMAILS.includes(String(email || '').toLowerCase())

function signSession(member) {
  if (!secret()) throw new Error('CAPITAL_WATCH_JWT_SECRET or JWT_SECRET must be set')
  return jwt.sign({ sub: String(member._id) }, secret(), { audience: AUDIENCE, expiresIn: `${SESSION_DAYS}d` })
}

async function requireMember(req, res, next) {
  try {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ message: 'Please sign in.' })
    const payload = jwt.verify(token, secret(), { audience: AUDIENCE })
    const member = await Member.findById(payload.sub).select('+passwordHash')
    if (!member) return res.status(401).json({ message: 'Please sign in.' })
    req.member = member
    next()
  } catch {
    res.status(401).json({ message: 'Your session expired. Please sign in again.' })
  }
}

function requireAdmin(req, res, next) {
  if (req.member?.role !== 'admin') return res.status(403).json({ message: 'Admins only.' })
  next()
}

const todayKey = () => new Date().toISOString().slice(0, 10)

// Atomically uses one of today's allowance. Returns false when it's used up.
async function useAllowance(member, kind) {
  const limit = limitsFor(member)[kind]
  const day = todayKey()
  // New day: reset the counters first.
  await Member.updateOne({ _id: member._id, 'usage.dayKey': { $ne: day } }, { $set: { usage: { dayKey: day, questions: 0, drafts: 0 } } })
  const res = await Member.updateOne(
    { _id: member._id, 'usage.dayKey': day, [`usage.${kind}`]: { $lt: limit } },
    { $inc: { [`usage.${kind}`]: 1 } },
  )
  return res.modifiedCount === 1
}

async function refundAllowance(member, kind) {
  await Member.updateOne({ _id: member._id, 'usage.dayKey': todayKey(), [`usage.${kind}`]: { $gt: 0 } }, { $inc: { [`usage.${kind}`]: -1 } })
}

// Signed one-click unsubscribe links for digest emails (no sign-in needed).
const unsubscribeSig = (memberId) => crypto.createHmac('sha256', secret() || '').update(`unsub:${memberId}`).digest('base64url').slice(0, 32)
function verifyUnsubscribe(memberId, sig) {
  const expected = Buffer.from(unsubscribeSig(memberId))
  const given = Buffer.from(String(sig || ''))
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

module.exports = {
  signSession, requireMember, requireAdmin, hashToken, newLoginToken, isAdminEmail,
  useAllowance, refundAllowance, limitsFor, unsubscribeSig, verifyUnsubscribe, todayKey,
}

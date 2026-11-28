'use strict'

// Sign in with Apple, server side.
//
// 1. verifyIdentityToken: checks the identity token the app gets from Apple
//    (signature against Apple's public keys, issuer, audience = our bundle id,
//    expiry). No setup needed beyond the bundle id.
// 2. exchangeCode / revokeRefreshToken: Apple requires apps to revoke a user's
//    Apple tokens when they delete their account. That needs a Sign in with Apple
//    key from the Apple Developer account, set on the server as:
//      APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (the .p8 contents)
//    Without those, sign-in still works and revocation is skipped (logged).

const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const APPLE_ISSUER = 'https://appleid.apple.com'
const KEYS_URL = 'https://appleid.apple.com/auth/keys'
const TOKEN_URL = 'https://appleid.apple.com/auth/token'
const REVOKE_URL = 'https://appleid.apple.com/auth/revoke'

// The iOS app's bundle id, plus a web Services ID if one is ever added.
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'io.wanderwork.app'
const AUDIENCES = [BUNDLE_ID, process.env.APPLE_SERVICE_ID].filter(Boolean)

let keyCache = { at: 0, keys: [] }
async function appleKeys(force = false) {
  if (!force && keyCache.keys.length && Date.now() - keyCache.at < 6 * 60 * 60 * 1000) return keyCache.keys
  const res = await fetch(KEYS_URL, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Apple keys request failed (${res.status})`)
  keyCache = { at: Date.now(), keys: (await res.json()).keys || [] }
  return keyCache.keys
}

async function verifyIdentityToken(identityToken) {
  const decoded = jwt.decode(String(identityToken || ''), { complete: true })
  if (!decoded?.header?.kid) throw new Error('Invalid Apple identity token')
  let jwk = (await appleKeys()).find((k) => k.kid === decoded.header.kid)
  // Apple rotates keys: refetch once if this one is new to us.
  if (!jwk) jwk = (await appleKeys(true)).find((k) => k.kid === decoded.header.kid)
  if (!jwk) throw new Error('Invalid Apple identity token')
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  const payload = jwt.verify(identityToken, publicKey, { algorithms: ['RS256'], issuer: APPLE_ISSUER, audience: AUDIENCES })
  return {
    sub: payload.sub,
    email: payload.email ? String(payload.email).trim().toLowerCase() : '',
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    privateRelay: payload.is_private_email === true || payload.is_private_email === 'true',
  }
}

const canTalkToApple = () => Boolean(process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY)

// A short-lived client secret: a JWT signed with our Sign in with Apple key.
function clientSecret() {
  const key = String(process.env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n')
  return jwt.sign({}, key, {
    algorithm: 'ES256',
    keyid: process.env.APPLE_KEY_ID,
    issuer: process.env.APPLE_TEAM_ID,
    audience: APPLE_ISSUER,
    subject: BUNDLE_ID,
    expiresIn: '5m',
  })
}

async function postForm(url, fields) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(10000),
  })
}

// Trades the one-time authorization code from the app for a refresh token, kept
// only so it can be revoked later. Returns '' when not set up or on failure.
async function exchangeCode(authorizationCode) {
  if (!authorizationCode || !canTalkToApple()) return ''
  try {
    const res = await postForm(TOKEN_URL, {
      client_id: BUNDLE_ID,
      client_secret: clientSecret(),
      code: String(authorizationCode),
      grant_type: 'authorization_code',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { console.warn('[Apple] Code exchange failed:', data.error || res.status); return '' }
    return data.refresh_token || ''
  } catch (err) {
    console.warn('[Apple] Code exchange failed:', err.message)
    return ''
  }
}

// Called when an account is deleted. Best effort: never blocks the deletion.
async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return false
  if (!canTalkToApple()) { console.warn('[Apple] Account deleted but APPLE_* keys are not set, so its Apple token was not revoked.'); return false }
  try {
    const res = await postForm(REVOKE_URL, {
      client_id: BUNDLE_ID,
      client_secret: clientSecret(),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    })
    if (!res.ok) console.warn('[Apple] Token revoke failed:', res.status)
    return res.ok
  } catch (err) {
    console.warn('[Apple] Token revoke failed:', err.message)
    return false
  }
}

module.exports = { verifyIdentityToken, exchangeCode, revokeRefreshToken, canTalkToApple }

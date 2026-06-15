'use strict'

/**
 * Search engine indexing notifications.
 *
 * Google Indexing API: only valid for pages with JobPosting structured data.
 * Requires a Google Service Account JSON key set in GOOGLE_INDEXING_SA_JSON env var.
 * The service account must be a verified owner in Google Search Console.
 *
 * IndexNow: covers Bing, Yandex, and other participating engines.
 * Requires INDEXNOW_KEY env var and a matching key file hosted at /feeds/{key}.txt
 * (served via the /feeds/indexnow-key.txt route in seoRoutes.js).
 */

const https = require('https')
const APP_URL = 'https://wanderwork.io'

// ─── IndexNow ────────────────────────────────────────────────────────────────

async function indexNowNotify(urls) {
  const key = process.env.INDEXNOW_KEY
  if (!key) return

  const body = JSON.stringify({
    host: 'wanderwork.io',
    key,
    keyLocation: `${APP_URL}/feeds/indexnow-${key}.txt`,
    urlList: Array.isArray(urls) ? urls : [urls],
  })

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.indexnow.org',
        path: '/indexnow',
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        console.log(`[IndexNow] Submitted ${Array.isArray(urls) ? urls.length : 1} URL(s) — HTTP ${res.statusCode}`)
        resolve(res.statusCode)
      }
    )
    req.on('error', (err) => {
      console.warn('[IndexNow] Request failed:', err.message)
      resolve(null)
    })
    req.write(body)
    req.end()
  })
}

// ─── Google Indexing API ──────────────────────────────────────────────────────

let _googleAuthClient = null

async function getGoogleAuthClient() {
  if (_googleAuthClient) return _googleAuthClient

  const saJson = process.env.GOOGLE_INDEXING_SA_JSON
  if (!saJson) return null

  try {
    const { GoogleAuth } = require('google-auth-library')
    const credentials = JSON.parse(saJson)
    _googleAuthClient = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    })
    return _googleAuthClient
  } catch (err) {
    console.warn('[GoogleIndexing] Failed to init auth client:', err.message)
    return null
  }
}

async function googleIndexingNotify(url, type = 'URL_UPDATED') {
  const auth = await getGoogleAuthClient()
  if (!auth) return

  try {
    const client = await auth.getClient()
    const token = await client.getAccessToken()

    const body = JSON.stringify({ url, type })
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'indexing.googleapis.com',
          path: '/v3/urlNotifications:publish',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.token}`,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          console.log(`[GoogleIndexing] ${type} ${url} — HTTP ${res.statusCode}`)
          resolve(res.statusCode)
        }
      )
      req.on('error', (err) => {
        console.warn('[GoogleIndexing] Request failed:', err.message)
        resolve(null)
      })
      req.write(body)
      req.end()
    })
  } catch (err) {
    console.warn('[GoogleIndexing] Notify failed:', err.message)
  }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

function jobUrl(job) {
  const title = String(job.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const company = String(job.company || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = String(job._id)
  return `${APP_URL}/jobs/${title}-at-${company}-${id}`
}

/** Call when new jobs are added (batch-friendly, caps at 10k per IndexNow call) */
async function notifyJobsAdded(jobs) {
  if (!jobs || !jobs.length) return
  const urls = jobs.map(jobUrl)

  // IndexNow: batch submit (limit 10k per call)
  for (let i = 0; i < urls.length; i += 9000) {
    await indexNowNotify(urls.slice(i, i + 9000))
  }

  // Google Indexing API: only for first 200 new jobs to avoid quota exhaustion
  // Google allows ~200 requests/day on the free tier
  const googleUrls = urls.slice(0, 200)
  for (const url of googleUrls) {
    await googleIndexingNotify(url, 'URL_UPDATED')
  }
}

/** Call when jobs are deleted or expired */
async function notifyJobsRemoved(jobs) {
  if (!jobs || !jobs.length) return
  const urls = jobs.map(jobUrl)

  for (let i = 0; i < urls.length; i += 9000) {
    await indexNowNotify(urls.slice(i, i + 9000))
  }

  const googleUrls = urls.slice(0, 200)
  for (const url of googleUrls) {
    await googleIndexingNotify(url, 'URL_DELETED')
  }
}

module.exports = { notifyJobsAdded, notifyJobsRemoved, jobUrl }

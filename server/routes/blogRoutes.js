const crypto = require('crypto')
const express = require('express')
const mongoose = require('mongoose')
const rateLimit = require('express-rate-limit')
const BlogPost = require('../models/Blog/blog.Post')
const NewsletterSubscriber = require('../models/Blog/blog.NewsletterSubscriber')
const { ensureStarterPosts } = require('../utils/blogStarterPosts')
const { BLOG_URL, postUrl } = require('../utils/blogPageHtml')
const { indexNowNotify } = require('../utils/searchIndexing')
const { isBlogAdmin } = require('../config/blogAdmins')
const { optionalAuth, requireAuth } = require('../middleware/requireAuth')

const router = express.Router()

const LIMITS = { title: 200, category: 60, excerpt: 600, body: 50000, image: 2000 }
const IMAGE_KEYS = ['beach-creator', 'mountain-creator', 'beach-laptop', 'frustrated', 'paper-chaos']

// Tells Bing and other IndexNow engines that an article and the blog index changed.
// Best effort: a failure here must never fail the admin's save.
function notifySearchEngines(post) {
  try {
    Promise.resolve(indexNowNotify([postUrl(post), BLOG_URL])).catch(() => {})
  } catch (err) {
    console.warn('[Blog] IndexNow notify failed:', err.message)
  }
}

function requireBlogAdmin(req, res, next) {
  if (!isBlogAdmin(req.user?.email)) {
    return res.status(403).json({ message: 'You do not have access to edit the blog.' })
  }
  next()
}

function slugify(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post'
}

// Paths under the public blog address that are not articles.
const RESERVED_SLUGS = ['admin', 'index']

async function uniqueSlug(title) {
  const base = RESERVED_SLUGS.includes(slugify(title)) ? `${slugify(title)}-post` : slugify(title)
  let slug = base
  for (let n = 2; await BlogPost.exists({ slug }); n++) slug = `${base}-${n}`
  return slug
}

// Picks the editable fields out of a request body. Returns { error } on bad input.
function readPostFields(body, { requireTitle }) {
  const fields = {}
  for (const key of ['title', 'category', 'excerpt', 'body', 'image']) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'string') return { error: `${key} must be text.` }
    const value = body[key].trim()
    if (value.length > LIMITS[key]) return { error: `${key} is too long.` }
    fields[key] = value
  }
  if (requireTitle ? !fields.title : fields.title === '') return { error: 'A title is required.' }
  if (fields.image && !IMAGE_KEYS.includes(fields.image) && !/^https:\/\/\S+$/i.test(fields.image)) {
    return { error: 'Image must be one of the built-in images or an https link.' }
  }
  if (body.publishedAt !== undefined) {
    const date = new Date(body.publishedAt)
    if (Number.isNaN(date.getTime())) return { error: 'Publish date is not valid.' }
    fields.publishedAt = date
  }
  return { fields }
}

router.get('/posts', optionalAuth, async (req, res) => {
  try {
    await ensureStarterPosts()
    const posts = await BlogPost.find({ deletedAt: null }).sort({ publishedAt: -1 }).select('-deletedAt -updatedBy -__v').lean()
    res.json({ posts, canEdit: isBlogAdmin(req.user?.email) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/posts', requireAuth, requireBlogAdmin, async (req, res) => {
  try {
    const { fields, error } = readPostFields(req.body || {}, { requireTitle: true })
    if (error) return res.status(400).json({ message: error })
    const post = await BlogPost.create({ ...fields, slug: await uniqueSlug(fields.title), updatedBy: req.user.email })
    notifySearchEngines(post)
    res.status(201).json(post)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.patch('/posts/:id', requireAuth, requireBlogAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Post not found.' })
    const { fields, error } = readPostFields(req.body || {}, { requireTitle: false })
    if (error) return res.status(400).json({ message: error })
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { ...fields, updatedBy: req.user.email },
      { new: true },
    )
    if (!post) return res.status(404).json({ message: 'Post not found.' })
    notifySearchEngines(post)
    res.json(post)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/posts/:id', requireAuth, requireBlogAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Post not found.' })
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date(), updatedBy: req.user.email },
    )
    if (!post) return res.status(404).json({ message: 'Post not found.' })
    notifySearchEngines(post)
    res.json({ message: 'Post deleted.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
})

// Best effort: the subscriber is already saved in our database, so a SendGrid
// failure (for example an API key without Marketing access) is only logged.
async function addToSendGridContacts(email) {
  if (!process.env.SENDGRID_API_KEY) return false
  const listId = process.env.SENDGRID_NEWSLETTER_LIST_ID
  const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(listId ? { list_ids: [listId] } : {}), contacts: [{ email }] }),
  })
  if (!response.ok) throw new Error(`SendGrid responded ${response.status}`)
  return true
}

router.post('/newsletter', newsletterLimiter, async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }
    const subscriber = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, source: 'blog' } },
      { upsert: true, new: true },
    )
    if (!subscriber.sendgridSynced) {
      try {
        if (await addToSendGridContacts(email)) {
          await NewsletterSubscriber.updateOne({ _id: subscriber._id }, { sendgridSynced: true })
        }
      } catch (err) {
        console.error('[Newsletter] SendGrid contact sync failed:', err.message)
      }
    }
    res.json({ message: 'You are subscribed.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/newsletter', requireAuth, requireBlogAdmin, async (req, res) => {
  try {
    const subscribers = await NewsletterSubscriber.find({}).sort({ createdAt: -1 }).select('email source sendgridSynced createdAt -_id').lean()
    res.json({ subscribers })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ---- MarketGenius connector ----
// Lets MarketGenius publish, update and take down posts without a signed-in
// admin and without any key to set up. MarketGenius signs each request and says
// who asked for it; this checks the signature against MarketGenius's public key
// (fetched from MarketGenius itself), that the request is fresh, and that the
// person is one of this blog's own admins (config/blogAdmins.js).
// A shared key still works too, for anyone who sets MARKETGENIUS_BLOG_KEY.
// The article text arrives as plain text with blank lines between paragraphs,
// the same as the admin editor saves.
const connectorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
})

const MARKETGENIUS_URL = (process.env.MARKETGENIUS_URL || 'https://marketinggenius-backend.onrender.com').replace(/\/+$/, '')
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

let marketGeniusKey = { pem: '', fetchedAt: 0 }
async function loadMarketGeniusKey(refresh) {
  const age = Date.now() - marketGeniusKey.fetchedAt
  // A refresh (after a signature did not match) is allowed once a minute, so bad
  // requests cannot make this server hammer MarketGenius.
  if (marketGeniusKey.pem && (refresh ? age < 60 * 1000 : age < 60 * 60 * 1000)) return marketGeniusKey.pem
  const response = await fetch(`${MARKETGENIUS_URL}/api/blog/signing-key`, { signal: AbortSignal.timeout(60000) })
  const data = response.ok ? await response.json() : null
  if (typeof data?.publicKey !== 'string') throw new Error('MarketGenius did not return a signing key')
  marketGeniusKey = { pem: data.publicKey, fetchedAt: Date.now() }
  return marketGeniusKey.pem
}

// The email of the person MarketGenius says asked for this, or null when the
// request is not a fresh, correctly signed one.
async function marketGeniusActor(req) {
  const timestamp = String(req.headers['x-mg-timestamp'] || '')
  const actor = String(req.headers['x-mg-actor'] || '').trim().toLowerCase()
  const signature = String(req.headers['x-mg-signature'] || '')
  if (!timestamp || !actor || !signature) return null
  if (!(Math.abs(Date.now() - Number(timestamp)) < SIGNATURE_MAX_AGE_MS)) return null
  const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? JSON.stringify(req.body || {}) : ''
  const message = [
    timestamp, req.method, req.originalUrl.split('?')[0],
    crypto.createHash('sha256').update(body).digest('hex'), actor,
  ].join('\n')
  for (const refresh of [false, true]) {
    const pem = await loadMarketGeniusKey(refresh)
    if (crypto.verify(null, Buffer.from(message), pem, Buffer.from(signature, 'base64'))) return actor
  }
  return null
}

// Reads the optional shared key, tolerating stray spaces or different letter case
// in the variable name or value.
function connectorKey() {
  const name = Object.keys(process.env).find((k) => k.trim().toUpperCase() === 'MARKETGENIUS_BLOG_KEY')
  return name ? String(process.env[name]).trim() : ''
}

async function requireConnectorKey(req, res, next) {
  try {
    const expected = connectorKey()
    const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    const digest = (value) => crypto.createHash('sha256').update(value).digest()
    if (expected && given && crypto.timingSafeEqual(digest(given), digest(expected))) return next()

    const actor = await marketGeniusActor(req)
    if (!actor) return res.status(401).json({ message: 'This request was not signed by MarketGenius.' })
    if (!isBlogAdmin(actor)) return res.status(403).json({ message: `${actor} is not one of this blog's admins.` })
    next()
  } catch (err) {
    console.error('[Blog] Connector check failed:', err.message)
    res.status(502).json({ message: 'This blog could not reach MarketGenius to check the request. Try again in a minute.' })
  }
}

const connectorPost = (post) => ({ id: String(post._id), slug: post.slug, url: postUrl(post) })

router.use('/connector', connectorLimiter, requireConnectorKey)

router.get('/connector', async (req, res) => {
  try {
    const posts = await BlogPost.countDocuments({ deletedAt: null })
    res.json({ name: 'Wander/Work Blog', url: BLOG_URL, posts })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/connector/posts', async (req, res) => {
  try {
    const { fields, error } = readPostFields(req.body || {}, { requireTitle: true })
    if (error) return res.status(400).json({ message: error })
    const post = await BlogPost.create({ ...fields, slug: await uniqueSlug(fields.title), updatedBy: 'MarketGenius' })
    notifySearchEngines(post)
    res.status(201).json(connectorPost(post))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.patch('/connector/posts/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Post not found.' })
    const { fields, error } = readPostFields(req.body || {}, { requireTitle: false })
    if (error) return res.status(400).json({ message: error })
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { ...fields, updatedBy: 'MarketGenius' },
      { new: true },
    )
    if (!post) return res.status(404).json({ message: 'Post not found.' })
    notifySearchEngines(post)
    res.json(connectorPost(post))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete('/connector/posts/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Post not found.' })
    const post = await BlogPost.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date(), updatedBy: 'MarketGenius' },
    )
    if (!post) return res.status(404).json({ message: 'Post not found.' })
    notifySearchEngines(post)
    res.json({ message: 'Post deleted.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router

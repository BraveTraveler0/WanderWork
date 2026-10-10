const express = require('express')
const mongoose = require('mongoose')
const rateLimit = require('express-rate-limit')
const BlogPost = require('../models/Blog/blog.Post')
const NewsletterSubscriber = require('../models/Blog/blog.NewsletterSubscriber')
const { SEED_POSTS, RETIRED_SAMPLE_SLUGS } = require('../config/blogSeedPosts')
const { isBlogAdmin } = require('../config/blogAdmins')
const { optionalAuth, requireAuth } = require('../middleware/requireAuth')

const router = express.Router()

const LIMITS = { title: 200, category: 60, excerpt: 600, body: 50000, image: 2000 }
const IMAGE_KEYS = ['beach-creator', 'mountain-creator', 'beach-laptop', 'frustrated', 'paper-chaos']

function requireBlogAdmin(req, res, next) {
  if (!isBlogAdmin(req.user?.email)) {
    return res.status(403).json({ message: 'You do not have access to edit the blog.' })
  }
  next()
}

function slugify(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post'
}

async function uniqueSlug(title) {
  const base = slugify(title)
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

// Installs any starter article whose slug has never existed (deleted ones still
// exist as soft-deleted documents, so they stay deleted) and retires the original
// placeholder posts unless an admin has edited them.
async function installStarterPosts() {
  const existing = new Set((await BlogPost.find({}).select('slug').lean()).map((p) => p.slug))
  const missing = SEED_POSTS.filter((p) => !existing.has(p.slug))
  if (!missing.length) return
  try {
    await BlogPost.insertMany(missing, { ordered: false })
  } catch (err) {
    // Another instance inserted at the same time; the unique slug index rejected the duplicates.
    if (err.code !== 11000) throw err
  }
  await BlogPost.updateMany(
    { slug: { $in: RETIRED_SAMPLE_SLUGS }, updatedBy: { $exists: false }, deletedAt: null },
    { deletedAt: new Date() },
  )
}

// Runs once per server process; a failed attempt is retried on the next request.
let starterPostsReady = null
function ensureStarterPosts() {
  if (!starterPostsReady) {
    starterPostsReady = installStarterPosts().catch((err) => {
      starterPostsReady = null
      throw err
    })
  }
  return starterPostsReady
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

module.exports = router

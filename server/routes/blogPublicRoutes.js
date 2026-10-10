const express = require('express')
const BlogPost = require('../models/Blog/blog.Post')
const { ensureStarterPosts } = require('../utils/blogStarterPosts')
const {
  blogIndexHtml, blogPostHtml, blogNotFoundHtml, blogPostMarkdown, blogIndexMarkdown, blogRssXml,
} = require('../utils/blogPageHtml')

// Public, crawlable blog pages. The frontend host proxies /aonverse/blog and
// /feeds here (see vercel.json and public/_redirects). The React admin view
// lives at /aonverse/blog/admin and is served by the frontend instead.
const router = express.Router()

// Short cache so admin edits show up within a few minutes.
const CACHE = 'public, max-age=300, stale-while-revalidate=86400'

async function livePosts() {
  await ensureStarterPosts()
  return BlogPost.find({ deletedAt: null }).sort({ publishedAt: -1 }).limit(200).lean()
}

function send(res, type, body, status = 200) {
  res.status(status)
  res.setHeader('Content-Type', `${type}; charset=utf-8`)
  if (status === 200) res.setHeader('Cache-Control', CACHE)
  res.send(body)
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error('[Blog] page error:', err.message)
    send(res, 'text/html', blogNotFoundHtml(), 500)
  }
}

router.get('/aonverse/blog', handle(async (req, res) => {
  send(res, 'text/html', blogIndexHtml(await livePosts()))
}))

router.get('/aonverse/blog/index.md', handle(async (req, res) => {
  send(res, 'text/markdown', blogIndexMarkdown(await livePosts()))
}))

router.get('/feeds/blog.xml', handle(async (req, res) => {
  send(res, 'application/rss+xml', blogRssXml(await livePosts()))
}))

router.get('/feeds/blog-llms.txt', handle(async (req, res) => {
  send(res, 'text/plain', blogIndexMarkdown(await livePosts()))
}))

router.get('/aonverse/blog/:slug', handle(async (req, res) => {
  const wantsMarkdown = req.params.slug.endsWith('.md')
  const slug = wantsMarkdown ? req.params.slug.slice(0, -3) : req.params.slug
  const posts = await livePosts()
  const post = posts.find((p) => p.slug === slug)
  if (!post) return send(res, 'text/html', blogNotFoundHtml(), 404)
  if (wantsMarkdown) return send(res, 'text/markdown', blogPostMarkdown(post))
  send(res, 'text/html', blogPostHtml(post, posts))
}))

module.exports = router

const express = require('express')
const BlogPost = require('../models/Blog/blog.Post')
const { ensureStarterPosts } = require('../utils/blogStarterPosts')
const {
  BLOG_URL, postUrl, blogIndexHtml, blogPostHtml, blogNotFoundHtml, blogPostMarkdown, blogIndexMarkdown, blogRssXml,
} = require('../utils/blogPageHtml')

// Public, crawlable blog pages. Visitors see them at wanderwork.io/blog: the
// frontend host proxies /blog to /aonverse/blog on this server, because /blog
// here is the JSON API (see blogRoutes.js). The frontend host also proxies
// /feeds here (see vercel.json and public/_redirects). The React admin view
// lives at wanderwork.io/blog/admin and is served by the frontend instead.
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

// Someone opening the API address in a browser is looking for the blog itself.
router.get('/blog', (req, res) => res.redirect(302, BLOG_URL))

router.get('/aonverse/blog', handle(async (req, res) => {
  send(res, 'text/html', blogIndexHtml(await livePosts()))
}))

router.get('/aonverse/blog/index.md', handle(async (req, res) => {
  res.setHeader('Link', `<${BLOG_URL}>; rel="canonical"`)
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
  if (!post) {
    // A deleted article answers 410 Gone, which search engines drop faster than a 404.
    const wasDeleted = await BlogPost.exists({ slug, deletedAt: { $ne: null } })
    return send(res, 'text/html', blogNotFoundHtml(), wasDeleted ? 410 : 404)
  }
  if (wantsMarkdown) {
    // Points search engines at the HTML article so the Markdown copy is not a duplicate.
    res.setHeader('Link', `<${postUrl(post)}>; rel="canonical"`)
    return send(res, 'text/markdown', blogPostMarkdown(post))
  }
  send(res, 'text/html', blogPostHtml(post, posts))
}))

module.exports = router

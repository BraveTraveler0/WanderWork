const BlogPost = require('../models/Blog/blog.Post')
const { SEED_POSTS, RETIRED_SAMPLE_SLUGS } = require('../config/blogSeedPosts')

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

module.exports = { ensureStarterPosts }

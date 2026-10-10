// Placeholder posts inserted the first time the blog is loaded with an empty
// collection. Admins can edit or delete them from /aonverse/blog.
const SAMPLE_NOTE = 'This is a sample post. Real stories from the Aonverse team and community will be published here soon.'

module.exports = [
  {
    slug: 'build-your-audience-anywhere',
    category: 'Creators',
    title: 'Build your audience from anywhere',
    excerpt: 'Aonverse is made for creators who work wherever the day takes them. Here is how a creator-first marketplace keeps your content, your shop, and your community in one place.',
    body: `Aonverse is made for creators who work wherever the day takes them. Short-form content, direct commerce, and digital goods all live in one customizable space, so the audience you build stays connected to the things you make.\n\n${SAMPLE_NOTE}`,
    image: 'beach-creator',
    publishedAt: new Date('2026-10-06T12:00:00Z'),
  },
  {
    slug: 'own-your-platform',
    category: 'Platform',
    title: 'Why creators need a home they own',
    excerpt: 'When a single app can change its rules overnight, your income is at risk. We look at what platform risk means for creators and what a safer setup looks like.',
    body: `When a single app can change its rules overnight, your income is at risk. A temporary reversal does not remove the structural problem. Creators need a place where their audience and their storefront belong to them.\n\n${SAMPLE_NOTE}`,
    image: 'mountain-creator',
    publishedAt: new Date('2026-09-29T12:00:00Z'),
  },
  {
    slug: 'sell-directly-to-your-fans',
    category: 'Commerce',
    title: 'Sell directly to the people who follow you',
    excerpt: 'Direct commerce means fewer steps between a post and a purchase. A quick look at how creators can turn content into a storefront without leaving the feed.',
    body: `Direct commerce means fewer steps between a post and a purchase. On Aonverse, a creator can share a piece of content and offer the product behind it in the same place.\n\n${SAMPLE_NOTE}`,
    image: 'beach-laptop',
    publishedAt: new Date('2026-09-22T12:00:00Z'),
  },
  {
    slug: 'when-the-algorithm-changes',
    category: 'Platform',
    title: 'What to do when the algorithm changes on you',
    excerpt: 'Reach drops, views stall, and nobody tells you why. Some practical ways to protect your work when a platform shifts under your feet.',
    body: `Reach drops, views stall, and nobody tells you why. The most reliable protection is a direct line to your audience and more than one way to earn from your work.\n\n${SAMPLE_NOTE}`,
    image: 'frustrated',
    publishedAt: new Date('2026-09-15T12:00:00Z'),
  },
  {
    slug: 'digital-goods-that-stand-out',
    category: 'Digital Goods',
    title: 'Digital goods that stand out from the pile',
    excerpt: 'Templates, presets, guides, and collectibles are easy to make and hard to get noticed. Ideas for packaging digital goods so they feel worth owning.',
    body: `Templates, presets, guides, and collectibles are easy to make and hard to get noticed. A playful, customizable profile gives each release its own stage.\n\n${SAMPLE_NOTE}`,
    image: 'paper-chaos',
    publishedAt: new Date('2026-09-08T12:00:00Z'),
  },
]

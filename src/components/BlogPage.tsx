import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Home, MessageCircle } from 'lucide-react'
import imgHero from 'figma:asset/727bb285cb25e44e8a2e2ed68ca5c149c445f1a7.png'
import imgBeachCreator from 'figma:asset/bd1dfdd1f7541a99c130874e76da6fe27ad072ff.png'
import imgMountainCreator from 'figma:asset/c8a0a7b242b87c734d608cc38bf5905fcecbaab2.png'
import imgBeachLaptop from 'figma:asset/17f56f62fc64ae1bb34eb9d3cd457cef5c9b04c3.png'
import imgFrustrated from 'figma:asset/bcf7986aed3699a8b742711600244619e5c21657.png'
import imgPaperChaos from 'figma:asset/35904082bd19768543c49f5873af7b0656a20011.png'

const BLOG_PATH = '/aonverse/blog'

interface BlogPageProps {
  onBack: () => void
}

interface BlogPost {
  slug: string
  category: string
  title: string
  excerpt: string
  body: string[]
  image: string
  date: string
  comments: number
}

const TEAL = '#306770'
const FONT = 'Manrope, sans-serif'
const POSTS_PER_PAGE = 3

// Placeholder posts and images until real Aonverse content is ready.
const POSTS: BlogPost[] = [
  {
    slug: 'build-your-audience-anywhere',
    category: 'Creators',
    title: 'Build your audience from anywhere',
    excerpt: 'Aonverse is made for creators who work wherever the day takes them. Here is how a creator-first marketplace keeps your content, your shop, and your community in one place.',
    body: [
      'Aonverse is made for creators who work wherever the day takes them. Short-form content, direct commerce, and digital goods all live in one customizable space, so the audience you build stays connected to the things you make.',
      'This is a sample post. Real stories from the Aonverse team and community will be published here soon.',
    ],
    image: imgBeachCreator,
    date: 'October 6, 2026',
    comments: 0,
  },
  {
    slug: 'own-your-platform',
    category: 'Platform',
    title: 'Why creators need a home they own',
    excerpt: 'When a single app can change its rules overnight, your income is at risk. We look at what platform risk means for creators and what a safer setup looks like.',
    body: [
      'When a single app can change its rules overnight, your income is at risk. A temporary reversal does not remove the structural problem. Creators need a place where their audience and their storefront belong to them.',
      'This is a sample post. Real stories from the Aonverse team and community will be published here soon.',
    ],
    image: imgMountainCreator,
    date: 'September 29, 2026',
    comments: 0,
  },
  {
    slug: 'sell-directly-to-your-fans',
    category: 'Commerce',
    title: 'Sell directly to the people who follow you',
    excerpt: 'Direct commerce means fewer steps between a post and a purchase. A quick look at how creators can turn content into a storefront without leaving the feed.',
    body: [
      'Direct commerce means fewer steps between a post and a purchase. On Aonverse, a creator can share a piece of content and offer the product behind it in the same place.',
      'This is a sample post. Real stories from the Aonverse team and community will be published here soon.',
    ],
    image: imgBeachLaptop,
    date: 'September 22, 2026',
    comments: 0,
  },
  {
    slug: 'when-the-algorithm-changes',
    category: 'Platform',
    title: 'What to do when the algorithm changes on you',
    excerpt: 'Reach drops, views stall, and nobody tells you why. Some practical ways to protect your work when a platform shifts under your feet.',
    body: [
      'Reach drops, views stall, and nobody tells you why. The most reliable protection is a direct line to your audience and more than one way to earn from your work.',
      'This is a sample post. Real stories from the Aonverse team and community will be published here soon.',
    ],
    image: imgFrustrated,
    date: 'September 15, 2026',
    comments: 0,
  },
  {
    slug: 'digital-goods-that-stand-out',
    category: 'Digital Goods',
    title: 'Digital goods that stand out from the pile',
    excerpt: 'Templates, presets, guides, and collectibles are easy to make and hard to get noticed. Ideas for packaging digital goods so they feel worth owning.',
    body: [
      'Templates, presets, guides, and collectibles are easy to make and hard to get noticed. A playful, customizable profile gives each release its own stage.',
      'This is a sample post. Real stories from the Aonverse team and community will be published here soon.',
    ],
    image: imgPaperChaos,
    date: 'September 8, 2026',
    comments: 0,
  },
]

const slugFromPath = () => {
  const rest = window.location.pathname.slice(BLOG_PATH.length).replace(/^\/+|\/+$/g, '')
  return POSTS.some((p) => p.slug === rest) ? rest : null
}

const SidebarHeading = ({ children }: { children: string }) => (
  <h3 className="text-[13px] font-semibold mb-4 pl-3" style={{ color: '#333', borderLeft: `2px solid ${TEAL}`, lineHeight: '14px' }}>
    {children}
  </h3>
)

const PostMeta = ({ post }: { post: BlogPost }) => (
  <div className="flex items-center justify-between text-[10px] font-semibold uppercase" style={{ color: '#9A9A9A', letterSpacing: '0.6px' }}>
    <span className="flex items-center gap-1.5">
      <MessageCircle size={11} />
      {post.comments} Comments
    </span>
    <span>{post.date}</span>
  </div>
)

const BlogPage = ({ onBack }: BlogPageProps) => {
  const [activeSlug, setActiveSlug] = useState<string | null>(slugFromPath)
  const [page, setPage] = useState(1)
  const [newsletterNotice, setNewsletterNotice] = useState(false)

  useEffect(() => {
    const handlePopState = () => setActiveSlug(slugFromPath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeSlug, page])

  const openPost = (slug: string | null) => {
    window.history.pushState({ wanderPage: 'blog' }, '', slug ? `${BLOG_PATH}/${slug}` : BLOG_PATH)
    setActiveSlug(slug)
  }

  const activePost = POSTS.find((p) => p.slug === activeSlug) ?? null
  const totalPages = Math.ceil(POSTS.length / POSTS_PER_PAGE)
  const visiblePosts = POSTS.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: FONT }}>
      {/* Hero */}
      <div className="relative" style={{ backgroundImage: `url(${imgHero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
        <div className="relative max-w-[1100px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center justify-between gap-4 py-5 text-[11px] font-bold uppercase text-white" style={{ letterSpacing: '0.8px' }}>
            <button onClick={onBack} className="flex items-center gap-2 uppercase transition-opacity hover:opacity-70" style={{ letterSpacing: '3px' }}>
              <ArrowLeft size={16} />
              <span>WANDER<span style={{ opacity: 0.6 }}>/</span>WORK</span>
            </button>
            <div className="flex items-center gap-5">
              <button onClick={onBack} className="hidden sm:inline uppercase transition-opacity hover:opacity-70">Home</button>
              <button onClick={() => openPost(null)} className="uppercase" style={{ color: '#8FD3DE' }}>Blog</button>
              <a
                href="https://www.aonverse.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-[3px] transition-opacity hover:opacity-85"
                style={{ background: TEAL }}
              >
                Aonverse
              </a>
            </div>
          </nav>
          <div className="text-center text-white pt-14 pb-20 sm:pt-20 sm:pb-24">
            <h1 className="text-[30px] sm:text-[34px] font-medium">Blog</h1>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px]">
              <button onClick={onBack} aria-label="Home" className="transition-opacity hover:opacity-70"><Home size={11} /></button>
              <span>&gt;</span>
              <button onClick={() => openPost(null)} className="transition-opacity hover:opacity-70">Aonverse Blog</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10">
        <main>
          {activePost ? (
            <article>
              <button onClick={() => openPost(null)} className="flex items-center gap-1.5 text-[12px] font-semibold mb-5 transition-opacity hover:opacity-70" style={{ color: TEAL }}>
                <ArrowLeft size={14} />
                All posts
              </button>
              <img src={activePost.image} alt="" className="w-full object-cover" style={{ maxHeight: 420 }} />
              <p className="mt-6 text-[10px] font-bold uppercase" style={{ color: TEAL, letterSpacing: '1px' }}>{activePost.category}</p>
              <h2 className="mt-2 text-[24px] sm:text-[28px] font-bold" style={{ color: '#333', lineHeight: 1.3 }}>{activePost.title}</h2>
              <div className="mt-4 pb-4 border-b" style={{ borderColor: '#EDEDED' }}>
                <PostMeta post={activePost} />
              </div>
              {activePost.body.map((paragraph) => (
                <p key={paragraph} className="mt-5 text-[14px]" style={{ color: '#555', lineHeight: 1.85 }}>{paragraph}</p>
              ))}
            </article>
          ) : (
            <>
              {visiblePosts.map((post) => (
                <article key={post.slug} className="flex flex-col sm:flex-row gap-5 sm:gap-8 pb-7 mb-7 border-b" style={{ borderColor: '#EDEDED' }}>
                  <button onClick={() => openPost(post.slug)} className="block shrink-0 w-full sm:w-[45%] overflow-hidden" aria-label={post.title}>
                    <img src={post.image} alt="" className="w-full h-[210px] object-cover transition-transform duration-300 hover:scale-105" />
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[10px] font-bold uppercase" style={{ color: TEAL, letterSpacing: '1px' }}>{post.category}</p>
                    <h2 className="mt-2 text-[19px] font-bold" style={{ color: '#333', lineHeight: 1.35 }}>
                      <button onClick={() => openPost(post.slug)} className="text-left transition-colors hover:text-[#306770]">{post.title}</button>
                    </h2>
                    <p className="mt-3 text-[12.5px]" style={{ color: '#666', lineHeight: 1.8 }}>{post.excerpt}</p>
                    <div className="mt-auto pt-4">
                      <div className="pt-3 border-t" style={{ borderColor: '#EDEDED' }}>
                        <PostMeta post={post} />
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 text-[12px]" style={{ color: '#666' }}>
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="w-8 h-8 flex items-center justify-center border disabled:opacity-40"
                    style={{ borderColor: '#E3E3E3' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      aria-current={n === page ? 'page' : undefined}
                      className="w-8 h-8 border"
                      style={n === page ? { background: TEAL, borderColor: TEAL, color: '#fff' } : { borderColor: '#E3E3E3' }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="w-8 h-8 flex items-center justify-center border disabled:opacity-40"
                    style={{ borderColor: '#E3E3E3' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <aside className="lg:pl-6 lg:border-l" style={{ borderColor: '#EDEDED' }}>
          <section className="mb-10">
            <SidebarHeading>Recent Posts</SidebarHeading>
            <ul className="text-[12px]" style={{ color: '#555' }}>
              {POSTS.map((post) => (
                <li key={post.slug} className="py-2.5 border-t last:border-b" style={{ borderColor: '#EDEDED' }}>
                  <button onClick={() => openPost(post.slug)} className="text-left transition-colors hover:text-[#306770]">{post.title}</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-10">
            <SidebarHeading>Newsletter</SidebarHeading>
            <p className="text-[12px] mb-3" style={{ color: '#666', lineHeight: 1.7 }}>
              Get the latest Aonverse content delivered to your email a few times a month.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); setNewsletterNotice(true) }}
              className="flex items-center gap-2 p-1.5 border"
              style={{ borderColor: '#E3E3E3' }}
            >
              <input
                type="email"
                required
                placeholder="Your Email"
                aria-label="Your email"
                className="flex-1 min-w-0 px-2 py-1.5 text-[12px] outline-none"
                style={{ background: '#fff', color: '#333' }}
              />
              <button type="submit" className="px-4 py-2 text-[10px] font-bold uppercase text-white rounded-[3px]" style={{ background: TEAL, letterSpacing: '0.8px' }}>
                Go
              </button>
            </form>
            {newsletterNotice && (
              <p className="mt-2 text-[11px]" style={{ color: '#9A9A9A' }}>Newsletter sign-up is coming soon.</p>
            )}
          </section>

          <section>
            <SidebarHeading>Featured</SidebarHeading>
            {POSTS.slice(0, 2).map((post) => (
              <button
                key={post.slug}
                onClick={() => openPost(post.slug)}
                className="w-full flex items-center gap-3 py-3 border-b text-left"
                style={{ borderColor: '#EDEDED' }}
              >
                <img src={post.image} alt="" className="w-[58px] h-[58px] object-cover shrink-0" />
                <span>
                  <span className="block text-[12px] transition-colors hover:text-[#306770]" style={{ color: '#444', lineHeight: 1.5 }}>{post.title}</span>
                  <span className="block mt-1 text-[9px] font-semibold uppercase" style={{ color: '#9A9A9A', letterSpacing: '0.5px' }}>
                    {post.date} / {post.comments} Comments
                  </span>
                </span>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </div>
  )
}

export default BlogPage

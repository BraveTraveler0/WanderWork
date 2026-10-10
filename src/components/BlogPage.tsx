import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Home, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createBlogPost, deleteBlogPost, fetchBlogPosts, fetchNewsletterSubscribers, subscribeToNewsletter, updateBlogPost } from '../api/blog'
import type { BlogPost, BlogPostInput } from '../api/blog'

// The public blog at /aonverse/blog is rendered by the server for search engines.
// This React view is the admin side of it.
const PUBLIC_BLOG_PATH = '/aonverse/blog'
const BLOG_PATH = `${PUBLIC_BLOG_PATH}/admin`
const imgHero = '/blog-images/hero.jpg'

interface BlogPageProps {
  onBack: () => void
}

const TEAL = '#306770'
const FONT = 'Manrope, sans-serif'
const POSTS_PER_PAGE = 3
const CUSTOM_IMAGE = 'custom'

// Images served from /blog-images (server/config/blogImages.js lists the same keys).
// Posts reference them by key, or use an https link instead.
const BUILT_IN_IMAGES: Record<string, { label: string; src: string }> = {
  'beach-creator':    { label: 'Creator on the beach', src: '/blog-images/beach-creator.jpg' },
  'mountain-creator': { label: 'Creator on a mountain', src: '/blog-images/mountain-creator.jpg' },
  'beach-laptop':     { label: 'Laptop on the sand', src: '/blog-images/beach-laptop.jpg' },
  'frustrated':       { label: 'Frustrated at a laptop', src: '/blog-images/frustrated.jpg' },
  'paper-chaos':      { label: 'Flying papers', src: '/blog-images/paper-chaos.png' },
}

const imageSrc = (image: string) => BUILT_IN_IMAGES[image]?.src ?? (/^https:\/\//i.test(image) ? image : imgHero)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// A short single line with no closing punctuation is treated as a subheading.
const isSubheading = (paragraph: string) =>
  paragraph.length <= 70 && !paragraph.includes('\n') && !/[.!?:,;"]$/.test(paragraph)

const PAGE_TITLE = 'Blog Admin | WanderWork'

const slugFromPath = () =>
  decodeURIComponent(window.location.pathname.slice(PUBLIC_BLOG_PATH.length).replace(/^\/+|\/+$/g, '').replace(/^admin\/?/, '')) || null

const SidebarHeading = ({ children }: { children: string }) => (
  <h3 className="text-[13px] font-semibold mb-4 pl-3" style={{ color: '#333', borderLeft: `2px solid ${TEAL}`, lineHeight: '14px' }}>
    {children}
  </h3>
)

const PostMeta = ({ post }: { post: BlogPost }) => (
  <div className="flex items-center justify-between text-[10px] font-semibold uppercase" style={{ color: '#9A9A9A', letterSpacing: '0.6px' }}>
    <span className="flex items-center gap-1.5">
      <MessageCircle size={11} />
      0 Comments
    </span>
    <span>{formatDate(post.publishedAt)}</span>
  </div>
)

const AdminActions = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
  <div className="flex items-center gap-2 text-[11px] font-semibold">
    <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1 border rounded-[3px] transition-colors hover:bg-gray-50" style={{ borderColor: TEAL, color: TEAL }}>
      <Pencil size={11} />
      Edit
    </button>
    <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1 border rounded-[3px] transition-colors hover:bg-red-50" style={{ borderColor: '#C0392B', color: '#C0392B' }}>
      <Trash2 size={11} />
      Delete
    </button>
  </div>
)

const fieldClass = 'w-full px-3 py-2 text-[13px] border rounded-[3px] outline-none focus:border-[#306770]'
const fieldStyle = { background: '#fff', color: '#333', borderColor: '#D8D8D8' }

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block mb-4">
    <span className="block mb-1.5 text-[11px] font-bold uppercase" style={{ color: '#666', letterSpacing: '0.6px' }}>{label}</span>
    {children}
  </label>
)

interface PostEditorProps {
  post: BlogPost | null
  onClose: () => void
  onSaved: (post: BlogPost) => void
}

const PostEditor = ({ post, onClose, onSaved }: PostEditorProps) => {
  const startsCustom = !!post && !BUILT_IN_IMAGES[post.image]
  const [title, setTitle] = useState(post?.title ?? '')
  const [category, setCategory] = useState(post?.category ?? '')
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [imageChoice, setImageChoice] = useState(startsCustom ? CUSTOM_IMAGE : post?.image ?? 'beach-creator')
  const [imageUrl, setImageUrl] = useState(startsCustom ? post?.image ?? '' : '')
  const [date, setDate] = useState((post?.publishedAt ?? new Date().toISOString()).slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const input: BlogPostInput = {
      title,
      category,
      excerpt,
      body,
      image: imageChoice === CUSTOM_IMAGE ? imageUrl : imageChoice,
      publishedAt: `${date}T12:00:00Z`,
    }
    try {
      onSaved(post ? await updateBlogPost(post._id, input) : await createBlogPost(input))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the post.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-[640px] bg-white rounded-[6px] p-5 sm:p-7" style={{ fontFamily: FONT }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold" style={{ color: '#333' }}>{post ? 'Edit post' : 'New post'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 transition-opacity hover:opacity-60"><X size={18} /></button>
        </div>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className={fieldClass} style={fieldStyle} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Category">
            <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className={fieldClass} style={fieldStyle} />
          </Field>
          <Field label="Publish date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={fieldClass} style={fieldStyle} />
          </Field>
        </div>
        <Field label="Image">
          <select value={imageChoice} onChange={(e) => setImageChoice(e.target.value)} className={fieldClass} style={fieldStyle}>
            {Object.entries(BUILT_IN_IMAGES).map(([key, img]) => (
              <option key={key} value={key}>{img.label}</option>
            ))}
            <option value={CUSTOM_IMAGE}>Image link (https)</option>
          </select>
        </Field>
        {imageChoice === CUSTOM_IMAGE && (
          <Field label="Image link">
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required placeholder="https://" className={fieldClass} style={fieldStyle} />
          </Field>
        )}
        <Field label="Excerpt (shown in the post list)">
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} maxLength={600} className={fieldClass} style={fieldStyle} />
        </Field>
        <Field label="Article (blank line between paragraphs, a short line on its own becomes a subheading)">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={fieldClass} style={{ ...fieldStyle, lineHeight: 1.7 }} />
        </Field>

        {error && <p className="mb-4 text-[12px]" style={{ color: '#C0392B' }}>{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-semibold" style={{ color: '#666' }}>Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 text-[12px] font-bold text-white rounded-[3px] disabled:opacity-60" style={{ background: TEAL }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

const BlogPage = ({ onBack }: BlogPageProps) => {
  const [posts, setPosts] = useState<BlogPost[] | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeSlug, setActiveSlug] = useState<string | null>(slugFromPath)
  const [page, setPage] = useState(1)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [newsletterSending, setNewsletterSending] = useState(false)
  // undefined = closed, null = new post, otherwise the post being edited
  const [editing, setEditing] = useState<BlogPost | null | undefined>(undefined)

  useEffect(() => {
    fetchBlogPosts()
      .then((res) => { setPosts(res.posts); setCanEdit(res.canEdit) })
      .catch(() => setLoadError('We could not load the blog right now. Please try again in a moment.'))
  }, [])

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

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNewsletterSending(true)
    setNewsletterStatus(null)
    try {
      await subscribeToNewsletter(newsletterEmail)
      setNewsletterStatus({ text: 'Thanks. You are on the list.', ok: true })
      setNewsletterEmail('')
    } catch (err) {
      setNewsletterStatus({ text: err instanceof Error ? err.message : 'Could not sign you up. Please try again.', ok: false })
    } finally {
      setNewsletterSending(false)
    }
  }

  const handleExportSubscribers = async () => {
    try {
      const { subscribers } = await fetchNewsletterSubscribers()
      if (!subscribers.length) { window.alert('No newsletter subscribers yet.'); return }
      const rows = ['email,subscribed_at,source', ...subscribers.map((s) => `${s.email},${s.createdAt},${s.source}`)]
      const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'newsletter-subscribers.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not load subscribers.')
    }
  }

  const handleSaved = (saved: BlogPost) => {
    setPosts((current) =>
      [saved, ...(current ?? []).filter((p) => p._id !== saved._id)]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    )
    setEditing(undefined)
  }

  const handleDelete = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? It will be removed from the blog.`)) return
    try {
      await deleteBlogPost(post._id)
      setPosts((current) => (current ?? []).filter((p) => p._id !== post._id))
      if (activeSlug === post.slug) openPost(null)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the post.')
    }
  }

  const allPosts = posts ?? []
  const activePost = allPosts.find((p) => p.slug === activeSlug) ?? null
  const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const visiblePosts = allPosts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE)
  const isSignedIn = (() => { try { return !!localStorage.getItem('wanderworkToken') } catch { return false } })()

  // Each article gets its own title, description and canonical link for search engines.
  const activeTitle = activePost?.title
  const activeExcerpt = activePost?.excerpt
  useEffect(() => {
    document.title = activeTitle ? `${activeTitle} | WanderWork` : PAGE_TITLE
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const originalDescription = description?.content
    if (description && activeExcerpt) description.content = activeExcerpt
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = `https://wanderwork.io${PUBLIC_BLOG_PATH}${activeSlug ? `/${activeSlug}` : ''}`
    return () => {
      if (description && originalDescription !== undefined) description.content = originalDescription
    }
  }, [activeSlug, activeTitle, activeExcerpt])

  const statusMessage = loadError ?? (posts === null ? 'Loading posts...' : null)

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

      {canEdit && (
        <div style={{ background: '#F1F7F8', borderBottom: '1px solid #DCE9EB' }}>
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3 text-[12px]" style={{ color: TEAL }}>
            <span className="font-semibold">Admin view. You can add, edit, and delete posts.</span>
            <div className="flex items-center gap-2 shrink-0">
              <a href={activePost ? `${PUBLIC_BLOG_PATH}/${activePost.slug}` : PUBLIC_BLOG_PATH} className="hidden sm:inline px-3 py-1.5 font-bold">View public page</a>
              <button onClick={handleExportSubscribers} className="flex items-center gap-1.5 px-3 py-1.5 font-bold border rounded-[3px]" style={{ borderColor: TEAL }}>
                <Download size={13} />
                <span className="hidden sm:inline">Newsletter list</span>
              </button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-white rounded-[3px]" style={{ background: TEAL }}>
                <Plus size={13} />
                New post
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10">
        <main>
          {statusMessage ? (
            <p className="py-10 text-center text-[13px]" style={{ color: '#888' }}>{statusMessage}</p>
          ) : activeSlug && !activePost ? (
            <div className="py-10 text-center">
              <p className="text-[13px] mb-4" style={{ color: '#888' }}>That post could not be found.</p>
              <button onClick={() => openPost(null)} className="text-[12px] font-semibold" style={{ color: TEAL }}>Back to all posts</button>
            </div>
          ) : activePost ? (
            <article>
              <div className="flex items-center justify-between gap-3 mb-5">
                <button onClick={() => openPost(null)} className="flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-70" style={{ color: TEAL }}>
                  <ArrowLeft size={14} />
                  All posts
                </button>
                {canEdit && <AdminActions onEdit={() => setEditing(activePost)} onDelete={() => handleDelete(activePost)} />}
              </div>
              <img src={imageSrc(activePost.image)} alt="" className="w-full object-cover" style={{ maxHeight: 420 }} />
              <p className="mt-6 text-[10px] font-bold uppercase" style={{ color: TEAL, letterSpacing: '1px' }}>{activePost.category}</p>
              <h2 className="mt-2 text-[24px] sm:text-[28px] font-bold" style={{ color: '#333', lineHeight: 1.3 }}>{activePost.title}</h2>
              <div className="mt-4 pb-4 border-b" style={{ borderColor: '#EDEDED' }}>
                <PostMeta post={activePost} />
              </div>
              {activePost.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((paragraph, i) => (
                isSubheading(paragraph)
                  ? <h3 key={i} className="mt-8 text-[17px] font-bold" style={{ color: '#333' }}>{paragraph}</h3>
                  : <p key={i} className="mt-5 text-[14px] whitespace-pre-line" style={{ color: '#555', lineHeight: 1.85 }}>{paragraph}</p>
              ))}
            </article>
          ) : allPosts.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: '#888' }}>No posts yet. Check back soon.</p>
          ) : (
            <>
              {visiblePosts.map((post) => (
                <article key={post._id} className="flex flex-col sm:flex-row gap-5 sm:gap-8 pb-7 mb-7 border-b" style={{ borderColor: '#EDEDED' }}>
                  <button onClick={() => openPost(post.slug)} className="block shrink-0 w-full sm:w-[45%] overflow-hidden" aria-label={post.title}>
                    <img src={imageSrc(post.image)} alt="" className="w-full h-[210px] object-cover transition-transform duration-300 hover:scale-105" />
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase" style={{ color: TEAL, letterSpacing: '1px' }}>{post.category}</p>
                      {canEdit && <AdminActions onEdit={() => setEditing(post)} onDelete={() => handleDelete(post)} />}
                    </div>
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
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
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
                      aria-current={n === currentPage ? 'page' : undefined}
                      className="w-8 h-8 border"
                      style={n === currentPage ? { background: TEAL, borderColor: TEAL, color: '#fff' } : { borderColor: '#E3E3E3' }}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
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
          {allPosts.length > 0 && (
            <section className="mb-10">
              <SidebarHeading>Recent Posts</SidebarHeading>
              <ul className="text-[12px]" style={{ color: '#555' }}>
                {allPosts.slice(0, 5).map((post) => (
                  <li key={post._id} className="py-2.5 border-t last:border-b" style={{ borderColor: '#EDEDED' }}>
                    <button onClick={() => openPost(post.slug)} className="text-left transition-colors hover:text-[#306770]">{post.title}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-10">
            <SidebarHeading>Newsletter</SidebarHeading>
            <p className="text-[12px] mb-3" style={{ color: '#666', lineHeight: 1.7 }}>
              Get the latest remote work and job search articles delivered to your email a few times a month.
            </p>
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex items-center gap-2 p-1.5 border"
              style={{ borderColor: '#E3E3E3' }}
            >
              <input
                type="email"
                required
                placeholder="Your Email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                aria-label="Your email"
                className="flex-1 min-w-0 px-2 py-1.5 text-[12px] outline-none"
                style={{ background: '#fff', color: '#333' }}
              />
              <button type="submit" disabled={newsletterSending} className="px-4 py-2 text-[10px] font-bold uppercase text-white rounded-[3px] disabled:opacity-60" style={{ background: TEAL, letterSpacing: '0.8px' }}>
                Go
              </button>
            </form>
            {newsletterStatus && (
              <p className="mt-2 text-[11px]" style={{ color: newsletterStatus.ok ? TEAL : '#C0392B' }}>{newsletterStatus.text}</p>
            )}
          </section>

          {allPosts.length > 0 && (
            <section className="mb-10">
              <SidebarHeading>Featured</SidebarHeading>
              {allPosts.slice(0, 2).map((post) => (
                <button
                  key={post._id}
                  onClick={() => openPost(post.slug)}
                  className="w-full flex items-center gap-3 py-3 border-b text-left"
                  style={{ borderColor: '#EDEDED' }}
                >
                  <img src={imageSrc(post.image)} alt="" className="w-[58px] h-[58px] object-cover shrink-0" />
                  <span>
                    <span className="block text-[12px] transition-colors hover:text-[#306770]" style={{ color: '#444', lineHeight: 1.5 }}>{post.title}</span>
                    <span className="block mt-1 text-[9px] font-semibold uppercase" style={{ color: '#9A9A9A', letterSpacing: '0.5px' }}>
                      {formatDate(post.publishedAt)} / 0 Comments
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {!isSignedIn && (
            <a href="/?login=true" className="text-[11px] transition-colors hover:text-[#306770]" style={{ color: '#9A9A9A' }}>Admin sign in</a>
          )}
        </aside>
      </div>

      {editing !== undefined && (
        <PostEditor post={editing} onClose={() => setEditing(undefined)} onSaved={handleSaved} />
      )}
    </div>
  )
}

export default BlogPage

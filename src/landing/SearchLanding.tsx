import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Check, ExternalLink, FileText, Lock, Search, SlidersHorizontal, Sparkles, Target, Users, X } from 'lucide-react'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import './searchLanding.css'
import { API_BASE_URL } from '../api/config'
import { trackLandingEvent } from '../utils/landingTracking'
import {
  QUICK_FILTERS,
  filterJobs,
  initials,
  isFresh,
  postedAgo,
  toLandingJob,
  type JobTypeFilter,
  type LandingFilters,
  type LandingJob,
  type PostedFilter,
  type QuickFilter,
  type SortKey,
} from './searchLandingData'
import { readFiltersFromUrl, writeFiltersToUrl } from './landingUrlState'

// Search-first landing page: a compact hero, then real jobs anyone can browse.
// Accounts are only asked for when a visitor wants something that needs one
// (tailoring an application, a match score, saving jobs).

export interface PickedJob { id: string; title: string; company: string }

interface SearchLandingProps {
  isAuthenticated: boolean
  onSignIn: () => void
  onSignUp: () => void
  onCustomize: (job: PickedJob) => void
  onOpenDashboard: () => void
}

declare global {
  // Started by an inline script in index.html so the job request runs while
  // the app bundle is still downloading.
  interface Window { __wlJobs?: Promise<unknown> }
}

const PAGE_SIZE = 20
const INVITE_AFTER = 8
const OVERLAY_QUERY = '(max-width: 1023px)'
// v2: feeds cached before the posted-date fix carried wrong dates.
const CACHE_KEY = 'ww_landing_jobs_v2'
const CACHE_MAX_AGE = 12 * 3_600_000
const PROD_API = 'https://wanderwork-backend-server.onrender.com'

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return match
}

function parseJobs(data: unknown): LandingJob[] {
  const raw: any[] = Array.isArray(data) ? data : ((data as any)?.jobs || (data as any)?.Jobs || [])
  const seen = new Set<string>()
  // Drop repeats by id and by identical title, company and location (employers
  // often post one opening under several URLs).
  const key = (j: LandingJob) => `${j.title}|${j.company}|${j.location}`.toLowerCase()
  return raw.map(toLandingJob).filter((j): j is LandingJob => {
    if (!j || seen.has(j.id) || seen.has(key(j))) return false
    seen.add(j.id); seen.add(key(j))
    return true
  })
}

function readCachedJobs(): LandingJob[] {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (!cached || Date.now() - cached.at > CACHE_MAX_AGE) return []
    return parseJobs(cached.data)
  } catch { return [] }
}

function fetchFeed(signal: AbortSignal): Promise<unknown> {
  const early = window.__wlJobs
  window.__wlJobs = undefined
  if (early && API_BASE_URL === PROD_API) return early
  return fetch(`${API_BASE_URL}/jobseeker/featured-jobs?limit=200`, { signal })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
}

const FIELD_HEADLINE: Partial<Record<QuickFilter, string>> = {
  engineering: 'Remote engineering jobs.',
  design: 'Remote design jobs.',
  marketing: 'Remote marketing jobs.',
  product: 'Remote product jobs.',
  support: 'Remote customer support jobs.',
}

export default function SearchLanding({ isAuthenticated, onSignIn, onSignUp, onCustomize, onOpenDashboard }: SearchLandingProps) {
  const initial = useMemo(readFiltersFromUrl, [])
  const [jobs, setJobs] = useState<LandingJob[]>(readCachedJobs)
  const [loading, setLoading] = useState(() => jobs.length === 0)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [newJobs, setNewJobs] = useState<{ count: number; days: number } | null>(null)
  const [query, setQuery] = useState(initial.query)
  const [quick, setQuick] = useState<QuickFilter[]>(initial.quick)
  const [jobType, setJobType] = useState<JobTypeFilter>(initial.jobType)
  const [postedWithinDays, setPostedWithinDays] = useState<PostedFilter>(initial.postedWithinDays)
  const [salaryOnly, setSalaryOnly] = useState(initial.salaryOnly)
  const [sort, setSort] = useState<SortKey>(initial.sort)
  const [showAdvanced, setShowAdvanced] = useState(!!(initial.jobType || initial.postedWithinDays || initial.salaryOnly))
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const isOverlay = useMediaQuery(OVERLAY_QUERY)
  const heroRef = useRef<HTMLElement>(null)
  const resultsRef = useRef<HTMLElement>(null)
  const lastTrackedQuery = useRef('')
  const lastFocused = useRef<HTMLElement | null>(null)

  // Message match: an ad can link to /landing?field=design and the headline
  // names the field it promised. Only known fields are used, never free text.
  const headlineLead = useMemo(() => {
    const field = initial.quick.find((k) => FIELD_HEADLINE[k])
    return field ? FIELD_HEADLINE[field]! : 'Find remote work.'
  }, [initial])

  useEffect(() => { trackLandingEvent('landing_view', { has_query: !!initial.query }) }, [initial])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The phone/tablet sign-up bar appears once the search box is out of view.
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    fetchFeed(controller.signal)
      .then((data) => {
        const parsed = parseJobs(data)
        if (!parsed.length) throw new Error('empty')
        setJobs(parsed)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })) } catch { /* storage full or blocked */ }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        // Cached jobs stay on screen; only an empty page shows the error.
        setJobs((prev) => { if (!prev.length) setFailed(true); return prev })
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reloadKey])

  // Retry once on its own: the first request can fail while the server wakes.
  useEffect(() => {
    if (!failed || reloadKey > 0) return
    const t = setTimeout(() => { setLoading(true); setReloadKey(1) }, 2500)
    return () => clearTimeout(t)
  }, [failed, reloadKey])

  // A dated count only. Skipped if the stats endpoint is unavailable.
  useEffect(() => {
    if (loading) return
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/jobseeker/job-stats`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s && Number.isFinite(s.newJobs) && s.newJobs > 0) setNewJobs({ count: s.newJobs, days: s.windowDays || 3 }) })
      .catch(() => {})
    return () => controller.abort()
  }, [loading])

  const filters: LandingFilters = { query, quick, jobType, postedWithinDays, salaryOnly, sort }
  const results = useMemo(() => filterJobs(jobs, filters), [jobs, query, quick, jobType, postedWithinDays, salaryOnly, sort])
  const selected = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null
  const filtersActive = !!(query.trim() || quick.length || jobType || postedWithinDays || salaryOnly)

  useEffect(() => { setVisible(PAGE_SIZE) }, [query, quick, jobType, postedWithinDays, salaryOnly, sort])

  // Keep the URL in step with the filters so results can be shared or linked from ads.
  useEffect(() => {
    const t = setTimeout(() => writeFiltersToUrl(filters), 400)
    return () => clearTimeout(t)
  }, [query, quick, jobType, postedWithinDays, salaryOnly, sort])

  // Record a search once typing settles, so a half-typed word isn't counted.
  useEffect(() => {
    const q = query.trim()
    if (!q || q === lastTrackedQuery.current) return
    const t = setTimeout(() => {
      lastTrackedQuery.current = q
      trackLandingEvent('job_search', { search_term: q, results: results.length })
    }, 1200)
    return () => clearTimeout(t)
  }, [query, results.length])

  // On phones and tablets the details cover the list, so Back closes them and
  // the page behind does not scroll.
  useEffect(() => {
    if (!isOverlay || !selected) return
    window.history.pushState({ ...(window.history.state || {}), wlJob: selected.id }, '')
    const onPop = () => setSelectedId(null)
    window.addEventListener('popstate', onPop)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      document.body.style.overflow = prevOverflow
    }
  }, [isOverlay, selected?.id])

  // Desktop: on shorter screens the panel can open below the fold. Bring it up
  // so the job and its Customize button are in view.
  useEffect(() => {
    if (isOverlay || !selected) return
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector('.wl-panel')
      const cta = document.querySelector('.wl-panel-actions .wl-btn-primary')
      if (!panel || !cta || cta.getBoundingClientRect().bottom <= window.innerHeight - 16) return
      window.scrollBy({ top: panel.getBoundingClientRect().top - 80, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [isOverlay, selected?.id])

  const closeDetails = () => {
    if (isOverlay && (window.history.state as any)?.wlJob) window.history.back()
    else setSelectedId(null)
    lastFocused.current?.focus?.()
  }

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetails() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const openJob = (job: LandingJob) => {
    lastFocused.current = document.activeElement as HTMLElement | null
    if (selectedId === job.id && !isOverlay) return
    setSelectedId(job.id)
    trackLandingEvent('job_view', { job_id: job.id, company: job.company })
  }

  const toggleQuick = (key: QuickFilter) => {
    const group = QUICK_FILTERS.find((q) => q.key === key)?.group
    setQuick((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      // Regions are either/or; fields can stack.
      const cleared = group === 'region' ? prev.filter((k) => QUICK_FILTERS.find((q) => q.key === k)?.group !== 'region') : prev
      return [...cleared, key]
    })
    trackLandingEvent('job_filter', { filter: key })
  }

  const clearFilters = () => {
    setQuery(''); setQuick([]); setJobType(''); setPostedWithinDays(0); setSalaryOnly(false)
  }

  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q && q !== lastTrackedQuery.current) {
      lastTrackedQuery.current = q
      trackLandingEvent('job_search', { search_term: q, results: results.length })
    }
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    scrollToResults()
  }

  const customize = (job: LandingJob, from: string) => {
    trackLandingEvent('customize_click', { job_id: job.id, from })
    onCustomize({ id: job.id, title: job.title, company: job.company })
  }

  const signUp = (from: string) => {
    trackLandingEvent('landing_signup_click', { from })
    onSignUp()
  }

  const save = (job: LandingJob) => {
    trackLandingEvent('job_save_click', { job_id: job.id })
    signUp('save')
  }

  const countLabel = !filtersActive && newJobs
    ? `${newJobs.count} new in the last ${newJobs.days} days`
    : `${results.length} ${results.length === 1 ? 'job' : 'jobs'}`

  return (
    <div className={`wl${!isAuthenticated ? ' has-sticky-cta' : ''}`}>
      <header className={`wl-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wl-wrap wl-header-inner">
          <a className="wl-logo" href="/landing" aria-label="WanderWork home">
            <span className="wl-logo-text">WANDER<span>/</span>WORK</span>
            <span className="wl-beta">BETA</span>
          </a>
          <nav className="wl-nav" aria-label="Main">
            <button className="wl-nav-link wl-hide-sm" onClick={scrollToResults}>Browse jobs</button>
            {isAuthenticated ? (
              <button className="wl-btn wl-btn-primary" onClick={onOpenDashboard}>Open dashboard</button>
            ) : (
              <>
                <button className="wl-nav-link" onClick={onSignIn}>Sign in</button>
                <button className="wl-btn wl-btn-primary" onClick={() => signUp('header')}>
                  <span className="wl-label-long">Get matched free</span><span className="wl-label-short">Join free</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="wl-hero" ref={heroRef}>
          <div className="wl-wrap">
            <h1>{headlineLead} Skip the busywork.</h1>
            <p className="wl-hero-sub">Browse remote jobs, see where you fit, and create tailored applications without starting from scratch.</p>

            <form className="wl-search" role="search" onSubmit={submitSearch}>
              <label className="wl-search-field">
                <Search size={19} aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Job title, skill, or company"
                  aria-label="Search jobs by title, skill, or company"
                  enterKeyHint="search"
                  autoComplete="off"
                />
              </label>
              <button type="submit" className="wl-btn wl-btn-primary">
                <span className="wl-label-long">Search jobs</span><span className="wl-label-short">Search</span>
              </button>
            </form>

            <div className="wl-chips" role="group" aria-label="Quick filters">
              {QUICK_FILTERS.map((f) => (
                <button key={f.key} type="button" className="wl-chip" aria-pressed={quick.includes(f.key)} onClick={() => toggleQuick(f.key)}>
                  {quick.includes(f.key) && <Check size={13} aria-hidden />}
                  {f.label}
                </button>
              ))}
              <button type="button" className="wl-chip wl-chip-ghost" aria-expanded={showAdvanced} aria-controls="wl-advanced" onClick={() => setShowAdvanced((v) => !v)}>
                <SlidersHorizontal size={13} aria-hidden /> Filters
              </button>
            </div>

            {showAdvanced && (
              <div className="wl-advanced" id="wl-advanced">
                <label>
                  Job type
                  <select value={jobType} onChange={(e) => setJobType(e.target.value as JobTypeFilter)}>
                    <option value="">Any</option>
                    <option value="full">Full-time</option>
                    <option value="part">Part-time</option>
                    <option value="contract">Contract or freelance</option>
                  </select>
                </label>
                <label>
                  Posted
                  <select value={postedWithinDays} onChange={(e) => setPostedWithinDays(Number(e.target.value) as PostedFilter)}>
                    <option value={0}>Any time</option>
                    <option value={1}>Last 24 hours</option>
                    <option value={3}>Last 3 days</option>
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                </label>
                <label className="wl-check">
                  <input type="checkbox" checked={salaryOnly} onChange={(e) => setSalaryOnly(e.target.checked)} />
                  Salary listed
                </label>
              </div>
            )}

            <ul className="wl-proof">
              <li><Check size={14} aria-hidden /> Free to browse, no account needed</li>
              <li><Check size={14} aria-hidden /> Apply on the employer's site</li>
              <li><Check size={14} aria-hidden /> Tailored resume and cover letter when you want one</li>
            </ul>
          </div>
        </section>

        <section className="wl-results" ref={resultsRef} aria-labelledby="wl-results-title">
          <div className="wl-wrap">
            <div className="wl-results-head">
              <div className="wl-results-title-wrap">
                <h2 id="wl-results-title">{filtersActive ? 'Matching remote jobs' : 'Latest remote jobs'}</h2>
                {!loading && !failed && <span className="wl-results-count" aria-live="polite">{countLabel}</span>}
              </div>
              <label className="wl-sort">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="newest">Newest first</option>
                  <option value="salary">Highest salary</option>
                </select>
              </label>
            </div>

            <div className={`wl-layout${selected ? ' has-panel' : ''}`}>
              <div className="wl-list">
                {loading && Array.from({ length: 6 }, (_, i) => <div key={i} className="wl-skeleton" aria-hidden />)}
                {loading && <span className="wl-sr">Loading jobs</span>}

                {!loading && failed && (
                  <div className="wl-empty" role="alert">
                    <h3>Jobs are taking a moment to load</h3>
                    <p>Our job server may be waking up. Try again in a few seconds.</p>
                    <button className="wl-btn wl-btn-secondary" onClick={() => { setLoading(true); setReloadKey((k) => k + 1) }}>Try again</button>
                  </div>
                )}

                {!loading && !failed && results.length === 0 && (
                  <div className="wl-empty">
                    <h3>No matches in the latest jobs</h3>
                    <p>Try a broader keyword or remove a filter.{!isAuthenticated && ' Or create a free account and we will match new jobs to you as they arrive.'}</p>
                    <div className="wl-empty-actions">
                      <button className="wl-btn wl-btn-secondary" onClick={clearFilters}>Clear filters</button>
                      {!isAuthenticated && <button className="wl-btn wl-btn-primary" onClick={() => signUp('empty_results')}>Get matched free</button>}
                    </div>
                  </div>
                )}

                {!loading && !failed && results.slice(0, visible).map((job, i) => (
                  <Fragment key={job.id}>
                    <JobRow
                      job={job}
                      selected={job.id === selectedId}
                      onOpen={() => openJob(job)}
                      onSave={isAuthenticated ? undefined : () => save(job)}
                      onMatch={isAuthenticated ? undefined : () => customize(job, 'row_match_teaser')}
                    />
                    {!isAuthenticated && i === INVITE_AFTER - 1 && (
                      <div className="wl-invite">
                        <div>
                          <strong>Make your next application easier</strong>
                          <span>Found a job you like? Create a free account to tailor your resume and cover letter to the role.</span>
                        </div>
                        <button className="wl-btn wl-btn-primary" onClick={() => signUp('list_invite')}>Create free account</button>
                      </div>
                    )}
                  </Fragment>
                ))}

                {!loading && !failed && results.length > visible && (
                  <div className="wl-more">
                    <button className="wl-btn wl-btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Show more jobs ({results.length - visible} left)
                    </button>
                  </div>
                )}
              </div>

              {selected && (
                <>
                  {isOverlay && <div className="wl-backdrop" onClick={closeDetails} aria-hidden />}
                  <JobDetails
                    job={selected}
                    isAuthenticated={isAuthenticated}
                    isOverlay={isOverlay}
                    onClose={closeDetails}
                    onCustomize={(from) => customize(selected, from)}
                    onApply={() => trackLandingEvent('job_apply_click', { job_id: selected.id, company: selected.company })}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        <section className="wl-value" aria-labelledby="wl-value-title">
          <div className="wl-wrap">
            <h2 id="wl-value-title">More than a job board</h2>
            <p className="wl-value-sub">Browsing is free. When you find a role worth going after, WanderWork helps you land it.</p>
            <div className="wl-value-grid">
              <div className="wl-value-card">
                <div className="wl-value-icon"><Target size={20} aria-hidden /></div>
                <h3>Find better matches</h3>
                <p>Add your resume once and see which roles fit your background, with the reasons why.</p>
              </div>
              <div className="wl-value-card">
                <div className="wl-value-icon"><FileText size={20} aria-hidden /></div>
                <h3>Tailor your application</h3>
                <p>Create a resume and cover letter written for the specific role, not a generic template.</p>
              </div>
              <div className="wl-value-card">
                <div className="wl-value-icon"><Users size={20} aria-hidden /></div>
                <h3>Reach the right people</h3>
                <p>Use recruiter outreach tools to get in front of the hiring team, beyond the job listing.</p>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="wl-cta">
                <div>
                  <h3>Your next remote job, without the endless search.</h3>
                  <p>Free to get started. No credit card, no commitment.</p>
                </div>
                <button className="wl-btn wl-btn-primary wl-btn-lg" onClick={() => signUp('footer_cta')}>
                  Get matched free <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="wl-footer">
        <div className="wl-wrap wl-footer-inner">
          <span>© {new Date().getFullYear()} WanderWork</span>
          <nav aria-label="Footer">
            <a href="/about">About</a>
            <a href="/blog">Blog</a>
            <a href="/support">Support</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
        </div>
      </footer>

      {!isAuthenticated && (
        <div className={`wl-sticky-cta${pastHero && !selected ? ' is-visible' : ''}`} aria-hidden={!pastHero || !!selected}>
          <span>Tailored applications, free</span>
          <button className="wl-btn wl-btn-primary" tabIndex={pastHero && !selected ? 0 : -1} onClick={() => signUp('sticky_bar')}>Get matched free</button>
        </div>
      )}
    </div>
  )
}

function JobTags({ job, onMatch }: { job: LandingJob; onMatch?: () => void }) {
  return (
    <div className="wl-tags">
      {isFresh(job.postedAt) && <span className="wl-tag wl-tag-new">New</span>}
      {job.eligibility.length ? job.eligibility.map((l) => <span key={l} className="wl-tag wl-tag-region">{l}</span>) : <span className="wl-tag wl-tag-region">Remote</span>}
      {job.salaryText && <span className="wl-tag wl-tag-pay">{job.salaryText}</span>}
      {job.jobType && <span className="wl-tag">{job.jobType}</span>}
      {/* Guests: a locked match score, shown on hover (desktop) or always (touch). */}
      {onMatch && (
        <button type="button" className="wl-match-teaser" onClick={onMatch} aria-label={`Log in to see your match for ${job.title}`}>
          <Lock size={12} aria-hidden />
          <span className="wl-mt-long">Log in to see your match %</span>
          <span className="wl-mt-short">See match %</span>
        </button>
      )}
    </div>
  )
}

function JobRow({ job, selected, onOpen, onSave, onMatch }: { job: LandingJob; selected: boolean; onOpen: () => void; onSave?: () => void; onMatch?: () => void }) {
  return (
    <article className={`wl-row${selected ? ' is-selected' : ''}`}>
      <div className="wl-logo-tile" aria-hidden>{initials(job.company)}</div>
      <div className="wl-row-main">
        <h3 className="wl-row-title">
          {/* A real link (crawlable, opens in a new tab with a modifier key);
              a plain click opens the details panel instead. */}
          <a
            className="wl-row-link"
            href={`/jobs/${job.slug}`}
            aria-current={selected ? 'true' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              onOpen()
            }}
          >
            {job.title}
          </a>
        </h3>
        <div className="wl-row-company">
          {job.company}
          {onMatch && (
            <button type="button" className="wl-match-teaser wl-mt-phone" onClick={onMatch} aria-label={`Log in to see your match for ${job.title}`}>
              <Lock size={11} aria-hidden /> See match %
            </button>
          )}
        </div>
        <JobTags job={job} onMatch={onMatch} />
      </div>
      <div className="wl-row-side">
        <span className="wl-age">{postedAgo(job.postedAt)}</span>
        {onSave && (
          <button type="button" className="wl-icon-btn wl-row-save" aria-label={`Save ${job.title}`} title="Save job" onClick={onSave}>
            <Bookmark size={16} aria-hidden />
          </button>
        )}
      </div>
    </article>
  )
}

function JobDetails({ job, isAuthenticated, isOverlay, onClose, onCustomize, onApply }: {
  job: LandingJob
  isAuthenticated: boolean
  isOverlay: boolean
  onClose: () => void
  onCustomize: (from: string) => void
  onApply: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
    if (isOverlay) backRef.current?.focus({ preventScroll: true })
  }, [job.id, isOverlay])

  return (
    <aside
      className="wl-panel"
      ref={panelRef}
      aria-label={`${job.title} details`}
      role={isOverlay ? 'dialog' : undefined}
      aria-modal={isOverlay ? true : undefined}
    >
      <div className="wl-panel-bar">
        <button ref={backRef} className="wl-icon-btn" onClick={onClose} aria-label="Back to jobs"><ArrowLeft size={18} aria-hidden /></button>
        <span className="wl-panel-bar-title">Back to jobs</span>
      </div>

      <div className="wl-panel-top">
        <div className="wl-logo-tile" aria-hidden>{initials(job.company)}</div>
        <div style={{ minWidth: 0 }}>
          <h2>{job.title}</h2>
          <div className="wl-panel-company">{job.company}</div>
        </div>
        <button className="wl-icon-btn wl-panel-close" onClick={onClose} aria-label="Close details"><X size={16} aria-hidden /></button>
      </div>

      <dl className="wl-facts">
        <div className="wl-fact"><dt>Who can apply</dt><dd>{job.eligibility.length ? job.eligibility.join(', ') : 'Remote, region not stated'}</dd></div>
        <div className="wl-fact"><dt>Salary</dt><dd>{job.salaryText || 'Not disclosed'}</dd></div>
        <div className="wl-fact"><dt>Job type</dt><dd>{job.jobType || 'Not stated'}</dd></div>
        <div className="wl-fact"><dt>Posted</dt><dd>{job.postedAt ? postedAgo(job.postedAt) : 'Recently'}</dd></div>
      </dl>

      <div className="wl-panel-actions">
        <button className="wl-btn wl-btn-primary wl-btn-lg wl-btn-block" onClick={() => onCustomize('panel_primary')}>
          <Sparkles size={16} aria-hidden /> Customize my application
        </button>
        {job.applyUrl && (
          <a className="wl-btn wl-btn-secondary wl-btn-lg wl-btn-block" href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={onApply}>
            Apply on company site <ExternalLink size={15} aria-hidden />
          </a>
        )}
      </div>

      <div className="wl-match">
        <div className="wl-match-head">
          <div className="wl-match-ring"><Target size={18} aria-hidden /></div>
          {isAuthenticated ? 'See how you match' : 'How well do you match?'}
        </div>
        <p>
          {isAuthenticated
            ? 'Open this role in your dashboard to see your match and generate a resume and cover letter written for it.'
            : 'Add your resume to see your match for this role, which of your skills to lead with, and a tailored resume and cover letter.'}
        </p>
        <button className="wl-btn wl-btn-secondary wl-btn-block" onClick={() => onCustomize('panel_match')}>
          {isAuthenticated ? 'Open in dashboard' : 'Get my match, free'}
        </button>
        {!isAuthenticated && <div className="wl-match-note">Free to get started. We bring you right back to this job.</div>}
      </div>

      {job.summary && (
        <div className="wl-panel-section">
          <h3>About the role</h3>
          <p>{job.summary}</p>
          {job.applyUrl && (
            <a className="wl-panel-link" href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={onApply}>
              Read the full posting on the employer's site
            </a>
          )}
        </div>
      )}

      {job.skills.length > 0 && (
        <div className="wl-panel-section">
          <h3>Skills</h3>
          <div className="wl-tags">{job.skills.map((s) => <span key={s} className="wl-tag">{s}</span>)}</div>
        </div>
      )}

      <div className="wl-panel-section">
        <a className="wl-panel-link" href={`/jobs/${job.slug}`}>Open this job's page</a>
      </div>

      {/* Phones and tablets: the main actions stay in reach while reading. */}
      <div className="wl-panel-dock">
        <button className="wl-btn wl-btn-primary wl-btn-lg" onClick={() => onCustomize('panel_dock')}>
          <Sparkles size={16} aria-hidden /> Customize application
        </button>
        {job.applyUrl && (
          <a className="wl-btn wl-btn-secondary wl-btn-lg" href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={onApply} aria-label="Apply on company site">
            Apply <ExternalLink size={15} aria-hidden />
          </a>
        )}
      </div>
    </aside>
  )
}

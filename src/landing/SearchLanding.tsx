import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Check, Clock, ExternalLink, FileText, Lock, Search, SlidersHorizontal, Sparkles, Target, Users } from 'lucide-react'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import './searchLanding.css'
import { API_BASE_URL } from '../api/config'
import StatsPanel from '../components/StatsPanel'
import { GoogleAuthButton, LinkedInIcon, startLinkedInAuth } from '../components/SocialAuthButtons'
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
// (tailoring an application, a match score, a recruiter, saving jobs).
// The job details column is the dashboard's own StatsPanel, so nothing about
// it changes when a visitor signs in.

export interface PickedJob { id: string; title: string; company: string }

interface SearchLandingProps {
  isAuthenticated: boolean
  onSignIn: () => void
  onSignUp: () => void
  onCustomize: (job: PickedJob) => void
  onOpenDashboard: () => void
  // Google sign-up finishes in place (popup); LinkedIn redirects and returns.
  onAuthenticated: (user: any, token: string) => void
}

declare global {
  // Started by an inline script in index.html so the job request runs while
  // the app bundle is still downloading.
  interface Window { __wlJobs?: Promise<unknown> }
}

const PAGE_SIZE = 20
// The live count covers a week: enough to show the site is busy.
const NEW_JOBS_DAYS = 7
const INVITE_AFTER = 8
const OVERLAY_QUERY = '(max-width: 1023px)'
// v2: feeds cached before the posted-date fix carried wrong dates.
const CACHE_KEY = 'ww_landing_jobs_v2'
const CACHE_MAX_AGE = 12 * 3_600_000
const PROD_API = 'https://wanderwork-backend-server.onrender.com'
const GUEST_DATA = { Jobs: [], Candidates: [], Applications: [], Contacts: [] }

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

// The same job shape the dashboard builds for its guest feed (App.tsx), so
// StatsPanel renders it exactly as it does after sign-in.
function toPanelJob(job: LandingJob, id: number) {
  const r = job.raw || {}
  return {
    id,
    backendId: job.id,
    title: job.title,
    company: job.company,
    description: job.summary,
    location: [job.location, job.timezone].filter(Boolean).join(' · '),
    salary: job.salaryText || 'Not Listed',
    url: r.url || job.applyUrl,
    apply_url: r.apply_url || r.applyUrl || null,
    company_url: r.company_url || null,
    jobType: job.jobType,
    source: r.source || '',
    skills: job.skills,
    hasNewBadge: isFresh(job.postedAt),
    interested: false,
    showCoverLetter: false,
    postedAt: job.postedAt ? job.postedAt.toISOString() : null,
    job_code: r.job_code,
  }
}

const FIELD_HEADLINE: Partial<Record<QuickFilter, string>> = {
  engineering: 'Remote engineering jobs.',
  design: 'Remote design jobs.',
  marketing: 'Remote marketing jobs.',
  product: 'Remote product jobs.',
  support: 'Remote customer support jobs.',
}

export default function SearchLanding({ isAuthenticated, onSignIn, onSignUp, onCustomize, onOpenDashboard, onAuthenticated }: SearchLandingProps) {
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
  const [authError, setAuthError] = useState<string | null>(null)
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
    fetch(`${API_BASE_URL}/jobseeker/job-stats?days=${NEW_JOBS_DAYS}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s && Number.isFinite(s.newJobs) && s.newJobs > 0) setNewJobs({ count: s.newJobs, days: s.windowDays || NEW_JOBS_DAYS }) })
      .catch(() => {})
    return () => controller.abort()
  }, [loading])

  const filters: LandingFilters = { query, quick, jobType, postedWithinDays, salaryOnly, sort }
  const results = useMemo(() => filterJobs(jobs, filters), [jobs, query, quick, jobType, postedWithinDays, salaryOnly, sort])
  const selected = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null
  // Desktop always shows a job in the right column, like the dashboard does.
  const displayed = selected ?? (!isOverlay && !loading && !failed ? results[0] ?? null : null)
  const numericIds = useMemo(() => new Map(jobs.map((j, i) => [j.id, i + 1])), [jobs])
  const panelJobs = useMemo(() => jobs.map((j, i) => toPanelJob(j, i + 1)), [jobs])
  const panelJob = displayed ? panelJobs[(numericIds.get(displayed.id) ?? 1) - 1] : null
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

  const closeDetails = () => {
    if (isOverlay && (window.history.state as any)?.wlJob) window.history.back()
    else setSelectedId(null)
    lastFocused.current?.focus?.()
  }

  useEffect(() => {
    if (!selected || !isOverlay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetails() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const openJob = (job: LandingJob) => {
    lastFocused.current = document.activeElement as HTMLElement | null
    if (displayed?.id === job.id && !isOverlay) return
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

  const showNewOnly = () => {
    setPostedWithinDays(newJobs?.days === 3 ? 3 : 7)
    trackLandingEvent('job_filter', { filter: 'new_jobs_count' })
    scrollToResults()
  }

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

  const contactRecruiter = (from: string) => {
    trackLandingEvent('recruiter_click', { from })
    if (isAuthenticated) onOpenDashboard()
    else onSignUp()
  }

  const linkedIn = (from: string) => {
    trackLandingEvent('landing_signup_click', { from, method: 'linkedin' })
    startLinkedInAuth()
  }

  const save = (job: LandingJob) => {
    trackLandingEvent('job_save_click', { job_id: job.id })
    signUp('save')
  }

  const liveCount = newJobs
    ? { n: newJobs.count, label: `new remote jobs in the last ${newJobs.days} days` }
    : jobs.length ? { n: jobs.length, label: 'fresh remote jobs, updated every 6 hours' } : null

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
          <div className={`wl-wrap${!isAuthenticated ? ' wl-hero-grid' : ''}`}>
            <div className="wl-hero-main">
              {liveCount && (
                <button type="button" className="wl-live" onClick={showNewOnly}>
                  <span className="wl-live-dot" aria-hidden />
                  <strong>{liveCount.n.toLocaleString()}</strong> {liveCount.label}
                </button>
              )}
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

            {!isAuthenticated && (
              <aside className="wl-join" aria-labelledby="wl-join-title">
                <h2 id="wl-join-title">Join free in one click</h2>
                <p className="wl-join-sub">Get matched to jobs, tailor your resume and cover letter, and reach recruiters.</p>
                <button type="button" className="wl-social-btn wl-social-linkedin" onClick={() => linkedIn('hero')}>
                  <LinkedInIcon color="#ffffff" /> Continue with LinkedIn
                </button>
                <GoogleAuthButton
                  className="wl-social-btn wl-social-google"
                  onSignup={(user, token) => { trackLandingEvent('landing_signup_click', { from: 'hero', method: 'google' }); onAuthenticated(user, token) }}
                  onError={setAuthError}
                />
                <button type="button" className="wl-join-email" onClick={() => signUp('hero_email')}>Sign up with email</button>
                {authError && <p className="wl-join-error" role="alert">{authError}</p>}
                <p className="wl-join-terms">
                  By clicking Continue with LinkedIn or Continue with Google, you agree to the WanderWork <a href="/terms">Terms of Service</a>.
                </p>
              </aside>
            )}
          </div>
        </section>

        <section className="wl-results" ref={resultsRef} aria-labelledby="wl-results-title">
          <div className="wl-wrap">
            <div className="wl-results-head">
              <div className="wl-results-title-wrap">
                <h2 id="wl-results-title">{filtersActive ? 'Matching remote jobs' : 'Latest remote jobs'}</h2>
                {!loading && !failed && (
                  filtersActive || !newJobs
                    ? <span className="wl-results-count" aria-live="polite">{results.length} {results.length === 1 ? 'job' : 'jobs'}</span>
                    : (
                      <button type="button" className="wl-results-live" onClick={showNewOnly} aria-live="polite">
                        <span className="wl-live-dot" aria-hidden />
                        <strong>{newJobs.count.toLocaleString()}</strong> new in the last {newJobs.days} days
                      </button>
                    )
                )}
              </div>
              <label className="wl-sort">
                <span className="wl-sort-label">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort jobs">
                  <option value="newest">Newest first</option>
                  <option value="salary">Highest salary</option>
                </select>
              </label>
            </div>

            <div className={`wl-layout${panelJob && !isOverlay ? ' has-panel' : ''}`}>
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
                      selected={job.id === displayed?.id}
                      onOpen={() => openJob(job)}
                      onCustomize={() => customize(job, 'row')}
                      onSave={isAuthenticated ? undefined : () => save(job)}
                      onMatch={isAuthenticated ? undefined : () => customize(job, 'row_match_teaser')}
                    />
                    {i === INVITE_AFTER - 1 && (
                      <div className="wl-invite">
                        {!isAuthenticated && (
                          <div className="wl-invite-part">
                            <div>
                              <strong>Make your next application easier</strong>
                              <span>Found a job you like? Create a free account to tailor your resume and cover letter to the role.</span>
                            </div>
                            <button className="wl-btn wl-btn-primary" onClick={() => signUp('list_invite')}>Create free account</button>
                          </div>
                        )}
                        <div className="wl-invite-part">
                          <div>
                            <strong>Want it even easier? Contact a recruiter.</strong>
                            <span>We connect you with recruiters hiring for remote roles like these, so the right people see your profile.</span>
                          </div>
                          <button className="wl-btn wl-btn-secondary" onClick={() => contactRecruiter('list_invite')}>
                            <Users size={15} aria-hidden /> Contact a recruiter
                          </button>
                        </div>
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

              {panelJob && displayed && (
                <>
                  {isOverlay && <div className="wl-backdrop" onClick={closeDetails} aria-hidden />}
                  <aside
                    className={isOverlay ? 'wl-panel' : 'wl-side'}
                    aria-label={`${displayed.title} details`}
                    role={isOverlay ? 'dialog' : undefined}
                    aria-modal={isOverlay ? true : undefined}
                  >
                    {isOverlay && (
                      <div className="wl-panel-bar">
                        <button className="wl-icon-btn" onClick={closeDetails} aria-label="Back to jobs" autoFocus><ArrowLeft size={18} aria-hidden /></button>
                        <span className="wl-panel-bar-title">Back to jobs</span>
                      </div>
                    )}
                    <StatsPanel
                      key={panelJob.id}
                      jobId={panelJob.id}
                      selectedJob={panelJob}
                      onClose={closeDetails}
                      data={GUEST_DATA}
                      jobs={panelJobs}
                      newJobsCount={newJobs?.count ?? null}
                      onNewJobsClick={showNewOnly}
                      onRecruiterContactsClick={() => contactRecruiter('panel')}
                      isAuthenticated={false}
                      showStats={false}
                      onSignUp={() => customize(displayed, 'panel')}
                    />
                    {isOverlay && (
                      <div className="wl-panel-dock">
                        <button className="wl-btn wl-btn-primary wl-btn-lg" onClick={() => customize(displayed, 'panel_dock')}>
                          <Sparkles size={16} aria-hidden /> Customize application
                        </button>
                        {displayed.applyUrl && (
                          <a
                            className="wl-btn wl-btn-secondary wl-btn-lg"
                            href={displayed.applyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackLandingEvent('job_apply_click', { job_id: displayed.id, company: displayed.company })}
                            aria-label="Apply on company site"
                          >
                            Apply <ExternalLink size={15} aria-hidden />
                          </a>
                        )}
                      </div>
                    )}
                  </aside>
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
                <p>Contact recruiters hiring for the role and get in front of the hiring team, beyond the job listing.</p>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="wl-cta">
                <div>
                  <h3>Your next remote job, without the endless search.</h3>
                  <p>Free to get started. No credit card, no commitment.</p>
                </div>
                <div className="wl-cta-actions">
                  <button className="wl-social-btn wl-social-linkedin" onClick={() => linkedIn('footer_cta')}>
                    <LinkedInIcon color="#ffffff" /> Continue with LinkedIn
                  </button>
                  <button className="wl-btn wl-btn-primary wl-btn-lg" onClick={() => signUp('footer_cta')}>
                    Get matched free <ArrowRight size={16} aria-hidden />
                  </button>
                </div>
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
          <button className="wl-social-btn wl-social-linkedin" tabIndex={pastHero && !selected ? 0 : -1} onClick={() => linkedIn('sticky_bar')}>
            <LinkedInIcon color="#ffffff" size={16} /> <span className="wl-label-long">Continue with LinkedIn</span><span className="wl-label-short">LinkedIn</span>
          </button>
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
      {job.timezone && <span className="wl-tag wl-tag-tz"><Clock size={11} aria-hidden /> {job.timezone}</span>}
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

function JobRow({ job, selected, onOpen, onCustomize, onSave, onMatch }: {
  job: LandingJob
  selected: boolean
  onOpen: () => void
  onCustomize: () => void
  onSave?: () => void
  onMatch?: () => void
}) {
  return (
    <article className={`wl-row${selected ? ' is-selected' : ''}`}>
      <div className="wl-logo-tile" aria-hidden>{initials(job.company)}</div>
      <div className="wl-row-main">
        <h3 className="wl-row-title">
          {/* A real link (crawlable, opens in a new tab with a modifier key);
              a plain click opens the job in the details column instead. */}
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
        {onMatch && (
          <button type="button" className="wl-match-teaser wl-mt-side" onClick={onMatch} aria-label={`Log in to see your match for ${job.title}`}>
            <Lock size={12} aria-hidden /> Log in to see your match %
          </button>
        )}
        <div className="wl-row-actions">
          <button type="button" className="wl-row-customize" onClick={onCustomize} aria-label={`Customize application for ${job.title}`}>
            <Sparkles size={15} aria-hidden />
            <span className="wl-rc-long">Customize Application</span>
            <span className="wl-rc-short">Customize</span>
          </button>
          {onSave && (
            <button type="button" className="wl-icon-btn wl-row-save" aria-label={`Save ${job.title}`} title="Save job" onClick={onSave}>
              <Bookmark size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

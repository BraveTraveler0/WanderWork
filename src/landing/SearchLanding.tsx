import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Check, ExternalLink, FileText, Search, SlidersHorizontal, Sparkles, Target, Users, X } from 'lucide-react'
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

// Search-first landing page: a compact hero, then real jobs anyone can browse.
// Accounts are only asked for when a visitor wants something that needs one
// (tailoring an application, a match score, saving jobs).

interface SearchLandingProps {
  isAuthenticated: boolean
  onSignIn: () => void
  onSignUp: () => void
  onCustomize: (jobId: string) => void
  onOpenDashboard: () => void
}

const PAGE_SIZE = 20
const INVITE_AFTER = 8
const MOBILE_QUERY = '(max-width: 1023px)'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobile(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

export default function SearchLanding({ isAuthenticated, onSignIn, onSignUp, onCustomize, onOpenDashboard }: SearchLandingProps) {
  const [jobs, setJobs] = useState<LandingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [newJobs, setNewJobs] = useState<{ count: number; days: number } | null>(null)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState<QuickFilter[]>([])
  const [jobType, setJobType] = useState<JobTypeFilter>('')
  const [postedWithinDays, setPostedWithinDays] = useState<PostedFilter>(0)
  const [salaryOnly, setSalaryOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('newest')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const isMobile = useIsMobile()
  const resultsRef = useRef<HTMLElement>(null)
  const lastTrackedQuery = useRef('')

  useEffect(() => { trackLandingEvent('landing_view') }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailed(false)
    fetch(`${API_BASE_URL}/jobseeker/featured-jobs?limit=200`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then((data) => {
        const raw: any[] = Array.isArray(data) ? data : (data?.jobs || data?.Jobs || [])
        const seen = new Set<string>()
        setJobs(raw.map(toLandingJob).filter((j): j is LandingJob => !!j && !seen.has(j.id) && !!seen.add(j.id)))
      })
      .catch((err) => { if (err?.name !== 'AbortError') setFailed(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reloadKey])

  // A dated count only. It is skipped if the stats endpoint is unavailable.
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
  const filtersActive = !!(query || quick.length || jobType || postedWithinDays || salaryOnly)

  useEffect(() => { setVisible(PAGE_SIZE) }, [query, quick, jobType, postedWithinDays, salaryOnly, sort])

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

  // On phones the details are their own screen, so the back button closes them.
  useEffect(() => {
    if (!isMobile || !selected) return
    window.history.pushState({ wlJob: selected.id }, '')
    const onPop = () => setSelectedId(null)
    window.addEventListener('popstate', onPop)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      document.body.style.overflow = prevOverflow
    }
  }, [isMobile, selected?.id])

  const closeDetails = () => {
    if (isMobile && (window.history.state as any)?.wlJob) window.history.back()
    else setSelectedId(null)
  }

  const openJob = (job: LandingJob) => {
    if (selectedId === job.id && !isMobile) return
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

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q && q !== lastTrackedQuery.current) {
      lastTrackedQuery.current = q
      trackLandingEvent('job_search', { search_term: q, results: results.length })
    }
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const customize = (job: LandingJob, from: string) => {
    trackLandingEvent('customize_click', { job_id: job.id, from })
    onCustomize(job.id)
  }

  const signUp = (from: string) => {
    trackLandingEvent('landing_signup_click', { from })
    onSignUp()
  }

  const save = (job: LandingJob) => {
    trackLandingEvent('job_save_click', { job_id: job.id })
    signUp('save')
  }

  return (
    <div className="wl">
      <header className={`wl-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wl-wrap wl-header-inner">
          <a className="wl-logo" href="/landing" aria-label="WanderWork home">
            <span className="wl-logo-text">WANDER<span>/</span>WORK</span>
            <span className="wl-beta">BETA</span>
          </a>
          <nav className="wl-nav" aria-label="Main">
            <button className="wl-nav-link wl-hide-sm" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' })}>Browse jobs</button>
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
        <section className="wl-hero">
          <div className="wl-wrap">
            <h1>Find remote work. Skip the busywork.</h1>
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
                />
              </label>
              <button type="submit" className="wl-btn wl-btn-primary">Search jobs</button>
            </form>

            <div className="wl-chips" role="group" aria-label="Quick filters">
              {QUICK_FILTERS.map((f) => (
                <button key={f.key} type="button" className="wl-chip" aria-pressed={quick.includes(f.key)} onClick={() => toggleQuick(f.key)}>
                  {quick.includes(f.key) && <Check size={13} aria-hidden />}
                  {f.label}
                </button>
              ))}
              <button type="button" className="wl-chip wl-chip-ghost" aria-expanded={showAdvanced} onClick={() => setShowAdvanced((v) => !v)}>
                <SlidersHorizontal size={13} aria-hidden /> Filters
              </button>
            </div>

            {showAdvanced && (
              <div className="wl-advanced">
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

            <div className="wl-proof">
              <span><Check size={14} aria-hidden /> Free to browse, no account needed</span>
              <span><Check size={14} aria-hidden /> Apply on the employer's site</span>
              <span><Check size={14} aria-hidden /> Tailored resume and cover letter when you want one</span>
            </div>
          </div>
        </section>

        <section className="wl-results" ref={resultsRef} aria-labelledby="wl-results-title">
          <div className="wl-wrap">
            <div className="wl-results-head">
              <div>
                <h2 id="wl-results-title" style={{ display: 'inline' }}>{filtersActive ? 'Matching remote jobs' : 'Latest remote jobs'}</h2>
                {!loading && !failed && (
                  <span className="wl-results-count">
                    {!filtersActive && newJobs
                      ? `${newJobs.count} new in the last ${newJobs.days} days`
                      : `${results.length} ${results.length === 1 ? 'job' : 'jobs'}`}
                  </span>
                )}
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

                {!loading && failed && (
                  <div className="wl-empty" role="alert">
                    <h3>Jobs are taking a moment to load</h3>
                    <p>Our job server may be waking up. Try again in a few seconds.</p>
                    <button className="wl-btn wl-btn-secondary" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
                  </div>
                )}

                {!loading && !failed && results.length === 0 && (
                  <div className="wl-empty">
                    <h3>No matches in the latest jobs</h3>
                    <p>Try a broader keyword or remove a filter.{!isAuthenticated && ' Or tell us what you do and we will match new jobs to you as they arrive.'}</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="wl-btn wl-btn-secondary" onClick={clearFilters}>Clear filters</button>
                      {!isAuthenticated && <button className="wl-btn wl-btn-primary" onClick={() => signUp('empty_results')}>Get matched free</button>}
                    </div>
                  </div>
                )}

                {!loading && !failed && results.slice(0, visible).map((job, i) => (
                  <Fragment key={job.id}>
                    <JobRow job={job} selected={job.id === selectedId} onOpen={() => openJob(job)} onSave={isAuthenticated ? undefined : () => save(job)} />
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

                {!loading && results.length > visible && (
                  <div className="wl-more">
                    <button className="wl-btn wl-btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                      Show more jobs ({results.length - visible} left)
                    </button>
                  </div>
                )}
              </div>

              {selected && (
                <JobDetails
                  job={selected}
                  isAuthenticated={isAuthenticated}
                  onClose={closeDetails}
                  onCustomize={(from) => customize(selected, from)}
                  onApply={() => trackLandingEvent('job_apply_click', { job_id: selected.id, company: selected.company })}
                />
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
                  <p>Free to get started. No commitment required.</p>
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
    </div>
  )
}

function JobTags({ job }: { job: LandingJob }) {
  return (
    <div className="wl-tags">
      {isFresh(job.postedAt) && <span className="wl-tag wl-tag-new">New</span>}
      {job.eligibility.length ? job.eligibility.map((l) => <span key={l} className="wl-tag wl-tag-region">{l}</span>) : <span className="wl-tag wl-tag-region">Remote</span>}
      {job.salaryText && <span className="wl-tag wl-tag-pay">{job.salaryText}</span>}
      {job.jobType && <span className="wl-tag">{job.jobType}</span>}
    </div>
  )
}

function JobRow({ job, selected, onOpen, onSave }: { job: LandingJob; selected: boolean; onOpen: () => void; onSave?: () => void }) {
  return (
    <div
      className={`wl-row${selected ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <div className="wl-logo-tile" aria-hidden>{initials(job.company)}</div>
      <div className="wl-row-main">
        <h3 className="wl-row-title">{job.title}</h3>
        <div className="wl-row-company">{job.company}</div>
        <JobTags job={job} />
      </div>
      <div className="wl-row-side">
        <span className="wl-age">{postedAgo(job.postedAt)}</span>
        {onSave && (
          <button
            type="button"
            className="wl-icon-btn"
            aria-label={`Save ${job.title}`}
            title="Save job"
            onClick={(e) => { e.stopPropagation(); onSave() }}
          >
            <Bookmark size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

function JobDetails({ job, isAuthenticated, onClose, onCustomize, onApply }: {
  job: LandingJob
  isAuthenticated: boolean
  onClose: () => void
  onCustomize: (from: string) => void
  onApply: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }) }, [job.id])

  return (
    <aside className="wl-panel" ref={panelRef} aria-label={`${job.title} details`}>
      <div className="wl-panel-bar">
        <button className="wl-icon-btn" onClick={onClose} aria-label="Back to jobs"><ArrowLeft size={18} aria-hidden /></button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Back to jobs</span>
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
    </aside>
  )
}

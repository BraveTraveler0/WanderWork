import { Trash2, Filter, X, RotateCcw, Sparkles } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { submitCustomRequest, updateJobSeeker } from '../api/jobseeker.ts'
import CustomJobRequestModal, { type CustomJobRequestOptions } from './CustomJobRequestModal'

// ─── Module-level description processing ─────────────────────────────────────
// Defined outside the component so they are never recreated on re-render.

const FALLBACK_DESC = "Unfortunately, we don't have much information about this job. Check out the \"Apply\" link to learn more — Wander/Work Team."

const _stripHtml = (html: string): string => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return (tmp.textContent || tmp.innerText || '').trim()
}

const _stripJunkMeta = (text: string): string => {
  let s = text
  s = s.replace(/^[\s\S]*?skip\s+to\s+main\s+content\s*/i, '')
  s = s.replace(/^\s*why\s+you\s+were\s+matched\s*:?\s*/i, '')
  s = s.replace(/^best\s+\S.*?\bjobs?\b[^.]*?\d{4}\s*/i, '')
  s = s.replace(/\b(?:re)?posted\s+\d+\s+days?\s+ago\s*saved?\b/gi, '')
  s = s.replace(/\b\d+\s+days?\s+ago\s*saved?\b/gi, '')
  s = s.replace(/\bany\s+time\s+\(\d[\d,]+\)[\s\S]*$/i, '')
  return s.replace(/\s{3,}/g, '  ').trim()
}

const _stripMarkdown = (text: string): string => {
  return text
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1')
    .replace(/(^|\n)\s{0,3}[-*_]{3,}\s*(?=\n|$)/g, '$1')
    .replace(/(^|\n)\s{0,3}(\*\*|__)\s*about\s+[^*\n_:]{2,80}\s*:?\s*\2\s*/gi, '$1')
    .replace(/(^|\n)\s{0,3}(\*|_)\s*about\s+[^*\n_:]{2,80}\s*:?\s*\2\s*/gi, '$1')
    .replace(/(^|\n)\s{0,3}(\*\*|__)\s*(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|company\s+description|company|description)\s*:?\s*\2\s*:?\s*/gi, '$1')
    .replace(/(^|\n)\s{0,3}(\*|_)\s*(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|company\s+description|company|description)\s*:?\s*\2\s*:?\s*/gi, '$1')
    .replace(/(^|\n)\s{0,3}(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|company\s+description|company|description)\s*:?\s*/gi, '$1')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/___([^_\n]+)___/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/\*\*/g, '')
    .trim()
}

const _stripDuplicateAboutHeading = (text: string): string => {
  return text
    .replace(/^about\s+(.{2,80}?)\s+\1\b\s*/i, '$1 ')
    .trim()
}

const _stripLeadingPresentationLines = (text: string): string => {
  const presentationOnly =
    /^(?:#{1,6}|[-*_]{3,}|(?:\*\*|__|\*|_)?\s*(?:about\s+(?:the\s+role|us|the\s+opportu?nity)|company\s+description|company|description|job\s+details|position|hiring)\s*:?\s*(?:\*\*|__|\*|_)?)$/i
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  while (lines.length && presentationOnly.test(lines[0])) {
    lines.shift()
  }
  return lines.join('\n\n').trim()
}

const LEAD_IN_PATTERNS: RegExp[] = [
  /^company[:,\s-]*/i,
  /^about\s+the\s+role[:,\s-]*/i,
  /^about\s+us[:,\s-]*/i,
  /^about\s+us":?,?\s*/i,
  /^company\s+description[:,\s-]*/i,
  /^join[:,\s-]*/i,
  /^who\s+we\s+are[:,\s-]*/i,
  /^open\s+to\s+applicants[:,\s-]*/i,
  /^this\s+is\s+us[:,\s-]*/i,
  /^description[:,\s-]*/i,
  /^position[:,\s-]*/i,
  /^hiring[:,\s-]*/i,
  /^job\s+details[:,\s-]*/i,
  /^about\s+the\s+opportu?nity[:,\s-]*/i,
  /^about\s+[^.!?\n:]{2,80}[:\-]\s*/i,
]

const _stripLeadIns = (text: string): string => {
  let cleaned = text.trim()
  let replaced = true
  while (replaced) {
    replaced = false
    for (const pattern of LEAD_IN_PATTERNS) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, '').trim()
        replaced = true
      }
    }
  }
  return cleaned
}

const SECTION_KEYWORDS = [
  'responsibilities', 'responsibility', 'requirements', 'qualifications',
  'what you will do', 'what you ll do', "what you'll do", 'what you will bring',
  'what we are looking for', 'who you are', 'about the role', 'about the opportunity',
  'benefits', 'compensation', 'skills', 'nice to have', 'preferred', 'position', 'job details',
]

const SECTION_ESCAPED = SECTION_KEYWORDS.map((s) => ({
  raw: s,
  title: s.replace(/\b\w/g, (m) => m.toUpperCase()),
  re: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'),
  glued: new RegExp(`([a-z])(${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[A-Z])`, 'ig'),
}))

const _addBreaks = (text: string): string => {
  let withSections = text
  for (const { title, re, glued } of SECTION_ESCAPED) {
    withSections = withSections.replace(glued, `$1\n\n${title} `)
    withSections = withSections.replace(re, `\n\n${title}`)
  }
  const lines = withSections
    .replace(/([.!?])\s+(?=[A-Z0-9])/g, '$1\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.join('\n\n')
}

const _isTooShort = (value: string): boolean => {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length < 120 && (trimmed.match(/[.!?]/g) || []).length < 2
}

function processJobDescription(d: unknown): string {
  const run = (raw: string) => {
    const formatted = _stripLeadingPresentationLines(
      _addBreaks(_stripLeadIns(_stripDuplicateAboutHeading(_stripMarkdown(_stripJunkMeta(_stripHtml(raw))))))
    )
    return !formatted || _isTooShort(formatted) ? FALLBACK_DESC : formatted
  }
  if (typeof d === 'string') return run(d)
  if (Array.isArray(d)) return run((d as unknown[]).filter(Boolean).join(' '))
  if (d && typeof d === 'object') return run(Object.values(d as Record<string, unknown>).filter((v): v is string => typeof v === 'string').join(' '))
  return FALLBACK_DESC
}

interface JobFeedProps {
  onSelectJob: (id: number | null) => void
  selectedJobId: number | null
  data?: any
  onSignUp?: () => void
  jobs?: any[]
  showNewOnly: boolean
  onToggleNewFilter: () => void
  loading?: boolean
  isAuthenticated?: boolean
  onSignIn?: () => void
  onTopJobChange?: (id: number | null) => void
}

const BATCH = 15
const NEW_JOB_WINDOW_DAYS = 30

const parseJobDate = (value: unknown): Date | null => {
  if (!value) return null
  const parsed = new Date(value as any)
  if (!Number.isNaN(parsed.getTime())) return parsed
  if (typeof value === 'string') {
    const withZ = new Date(`${value}Z`)
    if (!Number.isNaN(withZ.getTime())) return withZ
  }
  if (!Number.isNaN(Number(value))) {
    const numeric = new Date(Number(value))
    if (!Number.isNaN(numeric.getTime())) return numeric
  }
  return null
}

const getObjectIdDate = (id: unknown): Date | null => {
  if (typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000)
  }
  return null
}

const getJobAddedDate = (job: any): Date | null => {
  return (
    parseJobDate(job?.createdAt) ||
    parseJobDate(job?.addedAt) ||
    parseJobDate(job?.importedAt) ||
    getObjectIdDate(job?._id || job?.backendId) ||
    parseJobDate(job?.postedAt || job?.rawDate || job?.datePosted || job?.preparedAt)
  )
}

function getJobTime(job: any): number {
  const raw = job?.postedAt || job?.rawDate || job?.datePosted || job?.preparedAt
  if (!raw) return 0
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  if (typeof raw === 'string') {
    const withZ = new Date(`${raw}Z`)
    if (!Number.isNaN(withZ.getTime())) return withZ.getTime()
  }
  if (!Number.isNaN(Number(raw))) {
    const asNum = new Date(Number(raw))
    if (!Number.isNaN(asNum.getTime())) return asNum.getTime()
  }
  return 0
}

const _normSearch = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const JUNK_LOCATION_RE = /^(remote|worldwide|global|anywhere|online|virtual|home|platform|product|engineering|marketing|sales|design|tech|media|data|software|hardware|mobile|web|cloud|human|devops|backend|frontend|fullstack|operations|finance|legal|hr|it|various|multiple|flexible|tbd|na|n\/a|unknown|all|any|other)\b/i
const isRealLocation = (loc: string): boolean => {
  if (!loc) return false
  const t = loc.trim()
  if (t.length < 2) return false
  if (JUNK_LOCATION_RE.test(t)) return false
  return /^[A-Z]/.test(t) // proper noun — real city names are capitalized
}

const LOW_LEVEL_JOB_RE = /\b(junior|jr|entry level|intern|internship|apprentice|apprenticeship|trainee|new grad|new graduate|early career|campus|student|co op|fellowship)\b/

const SENIORITY_TIERS = [
  { level: 5, re: /\b(vp|vice president|chief|cto|cpo|c level|partner|managing director)\b/ },
  { level: 4, re: /\b(director|head of|principal)\b/ },
  { level: 3, re: /\b(senior|sr|lead|staff|manager|architect)\b/ },
  { level: 2, re: /\b(mid|mid level|associate|ii|iii)\b/ },
  { level: 1, re: LOW_LEVEL_JOB_RE },
]

function seniorityLevelFromText(value: unknown): number {
  const text = _normSearch(Array.isArray(value) ? value.join(' ') : String(value || ''))
  for (const tier of SENIORITY_TIERS) {
    if (tier.re.test(text)) return tier.level
  }
  return 2
}

function candidateSeniorityLevel(candidate: any): number {
  const explicit = seniorityLevelFromText(candidate?.seniority)
  if (explicit !== 2) return explicit
  return seniorityLevelFromText([
    candidate?.targetRoles,
    candidate?.work_experience,
    candidate?.summary,
  ].filter(Boolean).join(' '))
}

function isLowLevelJobForSeniorFilter(job: any): boolean {
  const text = _normSearch([
    job?.title,
    job?.jobType,
    job?.description,
    Array.isArray(job?.skills) ? job.skills.join(' ') : job?.skills,
  ].filter(Boolean).join(' '))
  return LOW_LEVEL_JOB_RE.test(text)
}

const JobFeed = ({ onSelectJob, selectedJobId, data, jobs = [], showNewOnly, loading, isAuthenticated = true, onSignIn, onSignUp, onTopJobChange }: JobFeedProps) => {
  const [visibleCount, setVisibleCount] = useState(BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [discardedJobs, setDiscardedJobs] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('wanderworkDiscardedJobs')
    if (!saved) return new Set()
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((id) => Number.isFinite(id)))
      }
      return new Set()
    } catch {
      return new Set()
    }
  })
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [fadingJobId, setFadingJobId] = useState<number | null>(null)
  const [showCustomRequestModal, setShowCustomRequestModal] = useState<{ jobId: string | number; jobTitle: string; company: string; job?: any } | null>(null)
  const [interestedOverrides, setInterestedOverrides] = useState<Record<number, boolean>>(() => {
    const saved = localStorage.getItem('wanderworkInterestedJobs')
    if (!saved) return {}
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed.reduce((acc: Record<number, boolean>, id: number) => {
          acc[id] = true
          return acc
        }, {})
      }
      if (parsed && typeof parsed === 'object') return parsed as Record<number, boolean>
      return {}
    } catch {
      return {}
    }
  })
  const [showInterestedOnly, setShowInterestedOnly] = useState(false)
  const [showMatchedOnly, setShowMatchedOnly] = useState(isAuthenticated)
  const [showFilters, setShowFilters] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (showNewOnly) setShowMatchedOnly(false)
  }, [showNewOnly])

  // Debounce the search bar input
  useEffect(() => {
    if (searchInput === searchQuery) return
    setSearchLoading(true)
    const t = setTimeout(() => {
      setSearchQuery(searchInput)
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset visible count whenever filters change
  useEffect(() => {
    setVisibleCount(BATCH)
  }, [showMatchedOnly, showInterestedOnly, showNewOnly, locationQuery, dateRange, keywords.join(','), searchQuery])

  // Load more as user scrolls to the sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((n) => n + BATCH)
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ALWAYS use jobs from props - they're already transformed and safe
  // Never fall back to data?.Jobs which may have untransformed objects
  const visibleJobsList = jobs || []

  const handleDiscardJob = (jobId: number) => {
    const shouldAdvanceSelection = selectedJobId === jobId
    const nextJobId = shouldAdvanceSelection
      ? visibleJobs.find((job: any) => job.id !== jobId && !discardedJobs.has(job.id))?.id ?? null
      : null
    setFadingJobId(jobId)
    setTimeout(() => {
      setDiscardedJobs(prev => {
        const next = new Set([...prev, jobId])
        localStorage.setItem('wanderworkDiscardedJobs', JSON.stringify([...next]))
        return next
      })
      setFadingJobId(null)
      if (shouldAdvanceSelection) {
        onSelectJob(nextJobId)
      }
    }, 300)
  }

  const handleRestoreJob = (jobId: number) => {
    setDiscardedJobs(prev => {
      const newSet = new Set(prev)
      newSet.delete(jobId)
      localStorage.setItem('wanderworkDiscardedJobs', JSON.stringify([...newSet]))
      return newSet
    })
  }

  const isNewJob = (job: any) => {
    if (job.hasNewBadge !== undefined) return job.hasNewBadge
    const added = getJobAddedDate(job)
    if (!added) return false
    const now = Date.now()
    const diffDays = (now - added.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= NEW_JOB_WINDOW_DAYS
  }

  const getJobPostedAt = (job: any) => {
    const raw = job?.postedAt || job?.rawDate || job?.datePosted || job?.preparedAt
    if (!raw) return null
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed
    if (typeof raw === 'string') {
      const withZ = new Date(`${raw}Z`)
      if (!Number.isNaN(withZ.getTime())) return withZ
    }
    if (!Number.isNaN(Number(raw))) {
      const asNum = new Date(Number(raw))
      if (!Number.isNaN(asNum.getTime())) return asNum
    }
    return null
  }

  const isJobInterested = (job: any) => {
    const override = interestedOverrides[job.id]
    if (override !== undefined) return override
    return Boolean(job.interested)
  }

  const candidate = data?.Candidates?.[0]
  const candidateId = candidate?._id
  const candidateLevel = useMemo(() => candidateSeniorityLevel(candidate), [candidate])
  const candidateKeywords = useMemo(() => {
    const values: string[] = []
    const addValue = (value: any) => {
      if (!value) return
      if (Array.isArray(value)) {
        value.forEach((item) => addValue(item))
        return
      }
      const text = String(value).trim()
      if (!text) return
      values.push(...text.split(',').map((item) => item.trim()).filter(Boolean))
    }

    addValue(candidate?.skills)
    addValue(candidate?.skills_2)
    addValue(candidate?.inferredKeywords)
    addValue(candidate?.inferredSkills)
    addValue(candidate?.inferred_skills)
    addValue(candidate?.extractedSkills)
    addValue(candidate?.extracted_skills)
    addValue(candidate?.targetRoles)

    if (typeof window !== 'undefined') {
      const storedProfileRaw = localStorage.getItem('wanderworkProfile')
      if (storedProfileRaw) {
        try {
          const stored = JSON.parse(storedProfileRaw)
          addValue(stored?.skills)
        } catch {
          // ignore local parse errors
        }
      }
    }

    const normalize = (text: string) =>
      text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

    const shortAllowlist = new Set(['ux', 'dev', 'fe', 'be'])
    const aliasMap: Record<string, string[]> = {
      ui: ['user interface'],
      ux: ['ux', 'user experience'],
      dev: ['developer', 'development'],
      fe: ['fe', 'front end', 'frontend', 'front-end'],
      be: ['be', 'back end', 'backend', 'back-end'],
      'front end': ['front end', 'frontend', 'front-end'],
      'back end': ['back end', 'backend', 'back-end'],
    }

    const normalized = Array.from(new Set(values))
      .map((value) => normalize(value))
      .filter(Boolean)

    const expanded: string[] = []
    for (const keyword of normalized) {
      if (aliasMap[keyword]) {
        expanded.push(...aliasMap[keyword].map((value) => normalize(value)))
        continue
      }
      if (keyword.length <= 2 && !shortAllowlist.has(keyword)) {
        continue
      }
      if (keyword.length === 3 && !shortAllowlist.has(keyword) && keyword === 'end') {
        continue
      }
      expanded.push(keyword)
    }

    return Array.from(new Set(expanded)).filter(Boolean)
  }, [
    candidate?.skills,
    candidate?.skills_2,
    candidate?.inferredKeywords,
    candidate?.inferredSkills,
    candidate?.inferred_skills,
    candidate?.extractedSkills,
    candidate?.extracted_skills,
    candidate?.targetRoles,
  ])
  const matchedJobIds = useMemo(() => {
    const apps = Array.isArray(data?.Applications) ? data!.Applications : []
    const appMatches = candidateId
      ? apps.filter((app: any) => app?.candidateId === candidateId)
      : apps
    const pairings = Array.isArray(data?.CandidateJobPairing) ? data!.CandidateJobPairing : []
    const pairingMatches = candidateId
      ? pairings.filter((pairing: any) => String(pairing?.candidateId) === String(candidateId))
      : pairings

    return new Set([
      ...appMatches
        .filter((app: any) => app?.jobId && app?.status !== 'not_interested')
        .map((app: any) => String(app.jobId)),
      ...pairingMatches
        .filter((pairing: any) => pairing?.jobId && Number(pairing?.score || 0) > 0)
        .map((pairing: any) => String(pairing.jobId)),
    ])
  }, [data?.Applications, data?.CandidateJobPairing, candidateId])

  // Build search text for every job once — shared by matchedSet and keyword filter
  const jobSearchTexts = useMemo(() => {
    const map = new Map<number, { txt: string; tokens: Set<string> }>()
    for (const job of visibleJobsList) {
      const skillsRaw = Array.isArray(job.skills) ? job.skills : (typeof job.skills === 'string' ? job.skills.split(',') : [])
      const txt = _normSearch([job.title, job.company, job.location, job.description, skillsRaw.join(' ')].filter(Boolean).join(' '))
      map.set(job.id, { txt, tokens: new Set(txt.split(' ').filter(Boolean)) })
    }
    return map
  }, [visibleJobsList])

  // Pre-compute which jobs match the candidate — O(jobs × keywords) once, not per render
  const matchedSet = useMemo(() => {
    const set = new Set<number>()
    for (const job of visibleJobsList) {
      if (candidateLevel >= 3 && isLowLevelJobForSeniorFilter(job)) continue
      if (candidateKeywords.length > 0) {
        const entry = jobSearchTexts.get(job.id)
        if (!entry) continue
        const { txt, tokens } = entry
        const hit = candidateKeywords.some((kw) => {
          if (kw === 'ui') return txt.includes('user interface')
          if (kw === 'ux') return tokens.has('ux') || txt.includes('user experience')
          if (kw === 'dev') return tokens.has('developer') || tokens.has('development')
          if (kw === 'fe') return txt.includes('front end') || tokens.has('frontend')
          if (kw === 'be') return txt.includes('back end') || tokens.has('backend')
          const parts = kw.split(' ').filter(Boolean)
          return parts.length === 1 ? tokens.has(kw) : txt.includes(kw)
        })
        if (hit) set.add(job.id)
      } else if (matchedJobIds.has(String(job.backendId))) {
        set.add(job.id)
      }
    }
    return set
  }, [visibleJobsList, candidateKeywords, matchedJobIds, jobSearchTexts, candidateLevel])

  const visibleJobs = useMemo(() => visibleJobsList
    .filter((job: any) => !discardedJobs.has(job.id))
    .filter((job: any) => !showMatchedOnly || matchedSet.has(job.id))
    .filter((job: any) => !showInterestedOnly || isJobInterested(job))
    .filter((job: any) => !showNewOnly || isNewJob(job))
    .filter((job: any) => {
      const text = [job.title, job.company, job.description].filter(Boolean).join(' ')
      if (!text) return true
      const hasCyrillic = /[\u0400-\u04FF]/.test(text)
      const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)
      return !(hasCyrillic || hasArabic)
    })
    .filter((job: any) => {
      if (dateRange === 'all') return true
      if (!job.postedAt) return true
      const posted = new Date(job.postedAt)
      const now = new Date()
      const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24)
      const sameMonth = posted.getMonth() === now.getMonth() && posted.getFullYear() === now.getFullYear()
      const sameYear = posted.getFullYear() === now.getFullYear()

      switch (dateRange) {
        case 'today':
          return diffDays < 1
        case 'yesterday':
          return diffDays >= 1 && diffDays < 2
        case 'this_week':
          return diffDays <= 7
        case 'two_weeks':
          return diffDays <= 14
        case 'this_month':
          return sameMonth
        case 'this_year':
          return sameYear
        default:
          return true
      }
    })
    .filter((job: any) => {
      if (!locationQuery.trim()) return true
      return (job.location || '').toLowerCase().includes(locationQuery.trim().toLowerCase())
    })
    .filter((job: any) => {
      if (keywords.length === 0) return true
      const entry = jobSearchTexts.get(job.id)
      if (!entry) return true
      return keywords.every((kw) => entry.txt.includes(kw.toLowerCase()))
    })
    .filter((job: any) => {
      if (!searchQuery.trim()) return true
      const terms = _normSearch(searchQuery).split(' ').filter(Boolean)
      if (terms.length === 0) return true
      const entry = jobSearchTexts.get(job.id)
      const tokens = entry?.tokens ?? new Set(_normSearch([job.title, job.company, job.description].filter(Boolean).join(' ')).split(' ').filter(Boolean))
      // Every search term must match as a whole word token, or as a prefix for terms ≥3 chars
      return terms.every(term =>
        tokens.has(term) || (term.length >= 3 && Array.from(tokens).some(t => t.startsWith(term)))
      )
    })
    .sort((a: any, b: any) => {
      // When searching, rank title matches above description-only matches
      if (searchQuery.trim()) {
        const terms = _normSearch(searchQuery).split(' ').filter(Boolean)
        const titleScore = (job: any) => {
          const titleTokens = new Set(_normSearch(job.title || '').split(' ').filter(Boolean))
          const allInTitle = terms.every(t => titleTokens.has(t) || (t.length >= 3 && Array.from(titleTokens).some(tk => tk.startsWith(t))))
          const anyInTitle = terms.some(t => titleTokens.has(t) || (t.length >= 3 && Array.from(titleTokens).some(tk => tk.startsWith(t))))
          return allInTitle ? 2 : anyInTitle ? 1 : 0
        }
        const diff = titleScore(b) - titleScore(a)
        if (diff !== 0) return diff
      }
      return getJobTime(b) - getJobTime(a)
    })
  , [visibleJobsList, discardedJobs, showMatchedOnly, matchedSet, showInterestedOnly, showNewOnly, locationQuery, dateRange, keywords, interestedOverrides, jobSearchTexts, searchQuery])
  const discardedJobsList = visibleJobsList.filter((job: any) => discardedJobs.has(job.id))

  // Report the top visible job to the parent whenever the list changes
  useEffect(() => {
    onTopJobChange?.(visibleJobs[0]?.id ?? null)
  }, [visibleJobs[0]?.id])

  // Process descriptions only for the jobs currently rendered — not the full list
  const jobDescriptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const job of visibleJobs.slice(0, visibleCount + BATCH)) {
      map.set(job.id, processJobDescription(job.description))
    }
    return map
  }, [visibleJobs, visibleCount])

  const toggleInterested = async (job: any) => {
    let nextValue = false
    setInterestedOverrides((prev) => {
      const base = Boolean(job.interested)
      const current = prev[job.id]
      nextValue = !(current !== undefined ? current : base)
      const next = { ...prev, [job.id]: nextValue }
      localStorage.setItem('wanderworkInterestedJobs', JSON.stringify(next))
      return next
    })
    try {
      const candidateId = data?.Candidates?.[0]?._id
      const jobId = job?.backendId
      if (candidateId && jobId) {
        const status = nextValue ? 'interested' : 'not_interested'
        await updateJobSeeker({
          Applications: [
            {
              jobId,
              candidateId,
              preparedAt: new Date().toISOString(),
              status,
              resume: {},
              coverLetter: ''
            }
          ]
        })
      }
    } catch (e) {
      // keep UI responsive even if backend update fails
      console.warn('Failed to persist interest state', e)
    }
  }

  const clearFilters = () => {
    setLocationQuery('')
    setDateRange('all')
    setKeywords([])
    setKeywordInput('')
  }

  const addKeyword = () => {
    const value = keywordInput.trim()
    if (!value) return
    setKeywords((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setKeywordInput('')
  }

  const removeKeyword = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw))

  const baseCredits = (() => {
    const tokenValue = candidate?.tokenBalance ?? candidate?.tokens
    if (Number.isFinite(tokenValue)) return tokenValue as number
    const creditValue = candidate?.creditsBalance
    return Number.isFinite(creditValue) ? (creditValue as number) : 0
  })()
  const [creditBalanceOverride, setCreditBalanceOverride] = useState<number | null>(null)

  useEffect(() => {
    setCreditBalanceOverride(baseCredits)
  }, [baseCredits])

  const currentCredits = creditBalanceOverride ?? baseCredits

  const handleCustomRequest = async (options: CustomJobRequestOptions) => {
    if (!showCustomRequestModal) return
    const totalCost = (options.resume ? 1 : 0) + (options.coverLetter ? 1 : 0)
    if (totalCost <= 0) return

    const webhookPayload = {
      email: candidate?.email || '',
      firstName: candidate?.firstName || '',
      lastName: candidate?.lastName || '',
      jobId: showCustomRequestModal.jobId,
      jobTitle: showCustomRequestModal.jobTitle,
      company: showCustomRequestModal.company,
      jobUrl: showCustomRequestModal.job?.url || '',
      resume: options.resume,
      coverLetter: options.coverLetter,
      fileFormat: options.fileFormat
    }

    const result = await submitCustomRequest(webhookPayload)

    const nextCredits = result?.tokensRemaining ?? Math.max(0, currentCredits - totalCost)
    setCreditBalanceOverride(nextCredits)
    return result
  }


  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar pr-2" style={{ fontFamily: 'Manrope' }}>
      <p className="text-[24px] sm:text-[28px] lg:text-[32px]" style={{ color: '#787878' }}>
        Hey there, Let's get you hired.
      </p>

      {/* Search bar */}
      <div className="relative w-full max-w-[600px]">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search jobs, companies, skills..."
          className="w-full px-4 py-3 pr-10 rounded-[14px] text-[14px] outline-none"
          style={{ border: '1.5px solid #D1D9DB', background: 'white', color: '#306770', fontFamily: 'Manrope' }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5">
          {searchLoading ? (
            <div className="animate-spin rounded-full border-2 border-[#C8DDE0] border-t-[#306770]" style={{ width: 16, height: 16 }} />
          ) : searchInput ? (
            <button onClick={() => { setSearchInput(''); setSearchQuery('') }} style={{ color: '#9ca3af', lineHeight: 1 }}>
              <X size={15} />
            </button>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <svg className="animate-spin h-7 w-7 text-[#306770]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Custom Request Modal */}
      {showCustomRequestModal && (
        <CustomJobRequestModal
          jobTitle={showCustomRequestModal.jobTitle}
          company={showCustomRequestModal.company}
          onClose={() => setShowCustomRequestModal(null)}
          onSubmit={handleCustomRequest}
          currentCredits={currentCredits}
          isAuthenticated={isAuthenticated}
          onSignUp={onSignUp}
        />
      )}

      {/* Filters — sticky so job cards scroll behind this line */}
      <div
        className="flex flex-col gap-2 sm:gap-3 sticky top-0 z-20 py-2 -mx-1 px-1"
        style={{ background: 'rgba(249,250,251,0.88)', backdropFilter: 'blur(14px) saturate(180%)', WebkitBackdropFilter: 'blur(14px) saturate(180%)', borderBottom: '1px solid rgba(220,224,230,0.7)' }}
      >
        <div className="flex gap-2 sm:gap-3 items-center flex-wrap">
          <button
            onClick={() => isAuthenticated && setShowMatchedOnly((v) => !v)}
            className="flex items-center gap-3 px-2 py-1 rounded-[12px] transition-colors"
            style={{ border: `1px solid ${isAuthenticated ? '#306770' : '#DCDCDC'}`, background: isAuthenticated ? 'white' : '#f9fafb', cursor: isAuthenticated ? 'pointer' : 'default' }}
          >
            <span className="text-[12px]" style={{ color: isAuthenticated ? '#306770' : '#9ca3af' }}>Matched</span>
            <div className="relative w-[32px] h-[22px]">
              <div className="absolute inset-0 rounded-[12px]" style={{ background: '#DCDCDC', border: '0.5px solid #8A8A8A' }} />
              <div
                className="absolute top-[1px] w-[20px] h-[20px] rounded-full transition-all"
                style={{
                  left: showMatchedOnly ? '10px' : '0px',
                  background: isAuthenticated ? '#306770' : '#D1D5DB',
                  border: `0.5px solid ${isAuthenticated ? '#306770' : '#9ca3af'}`
                }}
              />
            </div>
          </button>
          <button
            onClick={() => isAuthenticated && setShowInterestedOnly((v) => !v)}
            className="flex items-center gap-3 px-2 py-1 rounded-[12px] transition-colors"
            style={{ border: `1px solid ${isAuthenticated ? '#306770' : '#DCDCDC'}`, background: isAuthenticated ? 'white' : '#f9fafb', cursor: isAuthenticated ? 'pointer' : 'default' }}
          >
            <span className="text-[12px]" style={{ color: isAuthenticated ? '#306770' : '#9ca3af' }}>Interested</span>
            <div className="relative w-[32px] h-[22px]">
              <div className="absolute inset-0 rounded-[12px]" style={{ background: '#DCDCDC', border: '0.5px solid #8A8A8A' }} />
              <div
                className="absolute top-[1px] w-[20px] h-[20px] rounded-full transition-all"
                style={{
                  left: showInterestedOnly ? '10px' : '0px',
                  background: isAuthenticated ? '#306770' : '#D1D5DB',
                  border: `0.5px solid ${isAuthenticated ? '#306770' : '#9ca3af'}`
                }}
              />
            </div>
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] transition-colors"
            style={{ border: '1px solid #306770', color: '#306770', background: showFilters ? '#30677010' : 'transparent' }}
            title={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <Filter size={16} />
            <span className="text-[12px]">Filters</span>
          </button>
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] transition-colors"
            style={{ border: '1px solid #306770', color: '#306770', background: 'transparent' }}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
            <span className="text-[12px]">Clear</span>
          </button>
        </div>

        <div
          style={{
            maxHeight: showFilters ? '320px' : '0px',
            opacity: showFilters ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.45s ease',
            pointerEvents: showFilters ? 'auto' : 'none',
          }}
        >
          <div className="flex flex-col gap-2 sm:gap-2" style={{ paddingTop: '2px' }}>
            <div className="flex gap-2 sm:gap-3 items-center flex-wrap lg:flex-nowrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addKeyword()
                    }
                  }}
                  placeholder="Add keyword"
                  className="px-3 py-2 rounded-[10px] text-[12px] border w-[150px] sm:w-[170px] lg:w-[160px]"
                  style={{ borderColor: '#306770', background: 'white', color: '#306770' }}
                />
                <button
                  onClick={addKeyword}
                  className="px-3 py-2 rounded-[10px] text-[12px] flex-shrink-0"
                  style={{ border: '1px solid #306770', color: '#306770', background: '#ffffff' }}
                >
                  Add
                </button>
              </div>

              {keywords.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="flex items-center gap-1 px-3 py-1 rounded-[10px] text-[12px]"
                      style={{ background: '#30677010', color: '#306770', border: '1px solid #306770' }}
                    >
                      {kw}
                      <button onClick={() => removeKeyword(kw)} aria-label={`Remove ${kw}`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowDiscarded(!showDiscarded)}
                disabled={discardedJobsList.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-[10px] transition-colors relative flex-shrink-0"
                style={{
                  border: `1px solid ${discardedJobsList.length === 0 ? '#CCCCCC' : '#306770'}`,
                  color: discardedJobsList.length === 0 ? '#CCCCCC' : '#306770',
                  background: 'white',
                  cursor: discardedJobsList.length === 0 ? 'not-allowed' : 'pointer'
                }}
                title={`${discardedJobsList.length} discarded jobs`}
              >
                <Trash2 size={18} style={{ color: discardedJobsList.length === 0 ? '#CCCCCC' : '#306770' }} />
                <span className="text-[12px]">Not interested</span>
                {discardedJobsList.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                    {discardedJobsList.length}
                  </div>
                )}
              </button>
            </div>

            <div className="flex gap-2 sm:gap-3 items-center flex-wrap lg:flex-nowrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  list="location-options"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Location"
                  className="px-3 py-2 rounded-[10px] text-[12px] border w-[160px] sm:w-[190px] lg:w-[180px]"
                  style={{ borderColor: '#306770', background: 'white', color: '#306770' }}
                />
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-3 py-2 rounded-[10px] text-[12px] border w-[150px] sm:w-[170px] lg:w-[160px] outline-none"
                  style={{ borderColor: '#306770', background: 'white', color: '#306770' }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This week</option>
                  <option value="this_month">This month</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Discarded Jobs View */}
      {showDiscarded && discardedJobsList.length > 0 && (
        <div className="bg-gray-50 rounded-[15px] p-4 border" style={{ borderColor: '#DCDCDC' }}>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: '#306770' }}>Not Interested ({discardedJobsList.length})</h3>
          <p className="text-[11px] mb-3" style={{ color: '#A0A0A0' }}>Jobs are removed from the database after 60 days.</p>
          <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
            {discardedJobsList.map((job: any) => {
              const posted = getJobPostedAt(job)
              const daysUntilPurge = posted
                ? Math.max(0, 60 - Math.floor((Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24)))
                : null
              const isSoonPurge = daysUntilPurge !== null && daysUntilPurge <= 7
              return (
                <div key={job.id} className="flex items-center justify-between bg-white p-3 rounded-[10px]" style={{ borderLeft: `3px solid ${isSoonPurge ? '#F59E0B' : '#306770'}` }}>
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-[14px] font-semibold text-black truncate">{job.title}</p>
                    <p className="text-[12px]" style={{ color: '#787878' }}>{job.company}</p>
                    {daysUntilPurge !== null && (
                      <p className="text-[11px] mt-0.5" style={{ color: isSoonPurge ? '#F59E0B' : '#AAAAAA' }}>
                        {daysUntilPurge === 0 ? 'Removes today' : `Removes in ${daysUntilPurge} day${daysUntilPurge === 1 ? '' : 's'}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestoreJob(job.id)}
                    className="px-3 py-1 rounded-[8px] text-[11px] bg-white transition-all hover:bg-[#306770] hover:text-white flex-shrink-0"
                    style={{ border: '1px solid #306770', color: '#306770' }}
                  >
                    Restore
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Job Cards */}
      <div className="flex flex-col gap-5">
        {showInterestedOnly && visibleJobs.length === 0 && (
          <div className="rounded-[15px] bg-white p-6 text-center border" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-[14px] font-medium" style={{ color: '#306770' }}>
              Nothing to see here yet! Favorite your next dream job and it'll show up here.
            </p>
          </div>
        )}
        {!showInterestedOnly && showMatchedOnly && visibleJobs.length === 0 && (
          <div className="rounded-[15px] bg-white p-6 text-center border" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-[14px] font-medium" style={{ color: '#306770' }}>
              Nothing to see here yet, Come back later to catch your dream job!
            </p>
          </div>
        )}
        {visibleJobs.slice(0, visibleCount).map((job: any, _jobIndex: number) => {
          const isInterested = isJobInterested(job)
          const isNew = isNewJob(job)
          const expiringDays = (() => {
            const posted = getJobPostedAt(job)
            if (!posted) return null
            const ageDays = Math.floor((Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24))
            const remaining = 60 - ageDays
            if (remaining < 0 || remaining > 7) return null
            return remaining
          })()
          const safeDescription = jobDescriptions.get(job.id) ?? FALLBACK_DESC
          return (
            <JobCard
              key={job.id}
              {...job}
              description={safeDescription}
              interested={isInterested}
              hasNewBadge={isNew}
              expiringDays={expiringDays}
              onClick={() => onSelectJob(job.id)}
              isSelected={selectedJobId === job.id}
              onDiscard={handleDiscardJob}
              onToggleInterested={() => toggleInterested(job)}
              onCustomRequest={() => setShowCustomRequestModal({
                jobId: job.backendId || job._id || job.job_code || job.id,
                jobTitle: job.title,
                company: job.company,
                job
              })}
              fadingId={fadingJobId}
              cardIndex={_jobIndex}
            />
          )
        })}
        {visibleCount < visibleJobs.length ? (
          <div ref={sentinelRef} className="flex justify-center py-6">
            <div
              className="animate-spin"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid #C8DDE0',
                borderTopColor: '#1e5560',
              }}
            />
          </div>
        ) : (
          <div ref={sentinelRef} />
        )}

        {!isAuthenticated && (
          <div className="flex flex-col items-center gap-3 py-10 px-6">
            <p className="text-[13px] text-center" style={{ color: '#787878', fontFamily: 'Manrope' }}>
              Sign in to see hundreds more remote jobs matched to your profile.
            </p>
            <button
              onClick={() => onSignIn?.()}
              style={{
                background: '#306770',
                color: 'white',
                fontFamily: 'Manrope',
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 12,
                padding: '10px 28px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              View More Jobs
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Note: filter buttons removed in favor of direct inputs for location and keywords.

// Format date as relative (Today, Yesterday, X days ago) or short date
const formatPostedDate = (postedAt: string | null | undefined): string => {
  if (!postedAt) return 'Unknown'
  const posted = new Date(postedAt)
  if (isNaN(posted.getTime())) return 'Unknown'
  const now = new Date()
  const diffMs = now.getTime() - posted.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return `${diffDays} days ago`
  
  // After a week, show the actual date
  const month = posted.toLocaleString('en-US', { month: 'short' })
  const day = posted.getDate()
  const year = posted.getFullYear()
  return `${month} ${day}, ${year}`
}

const JobCard = memo(({ id, title, company, location, description, skills, hasNewBadge, expiringDays, interested, onClick, isSelected, onDiscard, onToggleInterested, onCustomRequest, fadingId, postedAt, rawDate, cardIndex }: {
  id: number
  title: string
  company: string
  location: string
  description: string
  skills: string | string[]
  hasNewBadge: boolean
  expiringDays?: number | null
  interested: boolean
  onClick: () => void
  isSelected: boolean
  onDiscard: (id: number) => void
  onToggleInterested: () => void
  onCustomRequest: () => void
  fadingId: number | null
  postedAt?: string | null
  rawDate?: string | null
  cardIndex?: number
}) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [inView, setInView] = useState((cardIndex ?? 0) < 3)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = cardRef.current
    if (!el || inView) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const [dontShowAgain, setDontShowAgain] = useState(() => {
    const saved = localStorage.getItem('wanderworkDisableDiscardConfirm')
    return saved === 'true'
  })
  const [expandingInterested, setExpandingInterested] = useState(false)

  const handleInterestClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (interested) {
      onToggleInterested()
      return
    }
    setExpandingInterested(true)
    setTimeout(() => {
      onToggleInterested()
      setExpandingInterested(false)
    }, 400)
  }

  const handleDiscardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (dontShowAgain) {
      onDiscard(id)
      return
    }
    
    setShowDiscardConfirm(true)
  }

  const confirmDiscard = () => {
    if (dontShowAgain) {
      localStorage.setItem('wanderworkDisableDiscardConfirm', 'true')
    }
    setShowDiscardConfirm(false)
    onDiscard(id)
  }

  return (
    <>
      <div
        ref={cardRef}
        onClick={onClick}
        className="bg-white rounded-[20px] p-4 sm:p-6 w-full cursor-pointer overflow-hidden"
        style={{
          boxShadow: isSelected
            ? '0px 20px 25px -5px rgba(0,0,0,0.1), 0px 10px 10px -5px rgba(0,0,0,0.04)'
            : '0px 4px 6px -1px rgba(0,0,0,0.05), 0px 2px 4px -1px rgba(0,0,0,0.03)',
          fontFamily: 'Manrope',
          opacity: fadingId === id ? 0 : inView ? 1 : 0,
          transform: fadingId === id
            ? 'none'
            : inView
            ? isSelected ? 'translateY(-4px)' : 'translateY(0)'
            : 'translateY(22px)',
          transition: fadingId === id
            ? 'opacity 0.3s ease'
            : 'opacity 0.5s cubic-bezier(0.22,1,0.36,1), transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.boxShadow = '0px 20px 25px -5px rgba(0,0,0,0.1), 0px 10px 10px -5px rgba(0,0,0,0.04)'
            e.currentTarget.style.transform = 'translateY(-4px)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.boxShadow = '0px 4px 6px -1px rgba(0,0,0,0.05), 0px 2px 4px -1px rgba(0,0,0,0.03)'
            e.currentTarget.style.transform = 'translateY(0)'
          }
        }}
      >
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[20px] sm:text-[24px] text-black line-clamp-2 min-w-0 break-words">{title}</h3>
            <div className="flex items-center gap-3 flex-shrink-0 justify-end">
              {hasNewBadge && (
                <div 
                  className="px-4 py-1 rounded-[10px] text-[12px] text-white text-center"
                  style={{ background: '#36BF8F' }}
                >
                  New
                </div>
              )}
              {expiringDays !== null && expiringDays !== undefined && (
                <div
                  className="px-4 py-1 rounded-[10px] text-[12px] text-white text-center"
                  style={{ background: '#F59E0B' }}
                >
                  {`Expiring in ${expiringDays} day${expiringDays === 1 ? '' : 's'}`}
                </div>
              )}
              {interested ? (
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-full border"
                    style={{
                      borderColor: '#36BF8F',
                      color: '#36BF8F',
                      background: '#36BF8F10',
                      borderWidth: '2px',
                    }}
                  >
                    <span className="text-[16px]">✓</span>
                    <span className="text-[12px]">Interested</span>
                  </div>
                  <button
                    onClick={handleInterestClick}
                    className="w-10 h-10 rounded-full border flex items-center justify-center transition-all"
                    style={{ borderColor: '#DCDCDC', color: '#306770', background: 'white', borderWidth: '1px', fontSize: '22px', lineHeight: 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.borderColor = '#FF6B6B'; e.currentTarget.style.color = '#FF6B6B'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.borderColor = '#DCDCDC'; e.currentTarget.style.color = '#306770'; }}
                    title="Remove interest"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInterestClick}
                    className="rounded-full border flex items-center justify-center text-[16px] transition-all overflow-hidden"
                    style={{ 
                      borderColor: expandingInterested ? '#36BF8F' : '#DCDCDC', 
                      color: '#306770', 
                      background: expandingInterested ? '#36BF8F10' : 'white',
                      borderWidth: '1px',
                      width: expandingInterested ? '150px' : '40px',
                      height: '40px',
                      minWidth: '40px',
                      padding: expandingInterested ? '0 12px' : '0',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.45s ease'
                    }}
                    onMouseEnter={(e) => { if (!expandingInterested) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.borderColor = '#36BF8F'; } }}
                    onMouseLeave={(e) => { if (!expandingInterested) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.borderColor = '#DCDCDC'; } }}
                    title="Mark as interested"
                  >
                    <span className="text-[16px]">✓</span>
                    {expandingInterested && <span className="text-[12px] ml-2 whitespace-nowrap">Interested</span>}
                  </button>
                  {!expandingInterested && (
                    <button
                      onClick={handleDiscardClick}
                      className="w-10 h-10 rounded-full border flex items-center justify-center transition-all"
                      style={{ borderColor: '#DCDCDC', color: '#306770', background: 'white', borderWidth: '1px', fontSize: '22px', lineHeight: 1 }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.borderColor = '#FF6B6B'; e.currentTarget.style.color = '#FF6B6B'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.borderColor = '#DCDCDC'; e.currentTarget.style.color = '#306770'; }}
                      title="Not interested"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            <div className="flex-1 min-w-0">
              <p
                className="text-[14px] mb-3 line-clamp-6 break-words leading-relaxed"
                style={{ color: '#787878', whiteSpace: 'pre-line' }}
              >
                {description || 'No description available'}
              </p>
              <p className="text-[10px] mb-4" style={{ color: '#787878' }}>
                {Array.isArray(skills) ? skills.join(', ') : skills}
              </p>
              
              {/* Customize Application Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCustomRequest()
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all"
                style={{
                  border: '1px solid rgba(48,103,112,0.2)',
                  color: '#306770',
                  background: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '1.5px solid #306770'
                  e.currentTarget.style.background = '#30677008'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(48,103,112,0.2)'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Sparkles size={16} />
                <span className="text-[12px] font-medium">Customize Application</span>
              </button>
            </div>
            <div className="text-left sm:text-right" style={{ color: '#787878' }}>
              <p className="text-[12px] mb-2">{formatPostedDate(postedAt ?? rawDate)}</p>
              <p className="text-[14px] sm:text-[16px] mb-2 line-clamp-1 max-w-[160px] sm:max-w-[180px] sm:ml-auto">{company}</p>
              <div className="mt-2 flex flex-col gap-2">
                {isRealLocation(location) && (
                  <p className="text-[10px] truncate max-w-[140px] sm:ml-auto">Based in {location}</p>
                )}
                <p className="text-[10px] sm:ml-auto" style={{ color: '#306770' }}>Remote</p>
              </div>
            </div>
          </div>

          {/* Actions removed per new header controls */}
        </div>
      </div>

      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={() => setShowDiscardConfirm(false)}>
          <div
            className="bg-white rounded-[20px] w-full max-w-[400px] shadow-[0_30px_90px_rgba(0,0,0,0.16)] p-6 relative"
            style={{ fontFamily: 'Manrope' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] mb-6 text-black font-semibold">
              Are you sure you want to move this to 'Not interested'?
            </p>

            <div className="flex items-center gap-3 mb-6">
              <input
                type="checkbox"
                id={`dont-show-${id}`}
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4"
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor={`dont-show-${id}`} className="text-[12px]" style={{ color: '#787878', cursor: 'pointer' }}>
                Don't show this message again
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 px-4 py-2 rounded-[10px] text-[12px] border transition-colors"
                style={{ borderColor: '#DCDCDC', color: '#306770', background: 'white' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscard}
                className="flex-1 px-4 py-2 rounded-[10px] text-[12px] text-white transition-colors"
                style={{ background: '#306770' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export default JobFeed

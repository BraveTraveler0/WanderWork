import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Briefcase, Coins, MailPlus, Sparkles, Users, Zap } from 'lucide-react'
import Sidebar from './components/Sidebar'
import RecruiterOutreach from './components/RecruiterOutreach'
import JobFeed from './components/JobFeed'
import StatsPanel from './components/StatsPanel'
import ParticleProfile from './components/ParticleProfile'
import SettingsPage from './components/SettingsPage'
import PrivacyPolicyPage from './components/PrivacyPolicyPage'
import TermsOfServicePage from './components/TermsOfServicePage'
import PlansPage from './components/PlansPage'
import ProfilePage from './components/ProfilePage'
import MessagesPage, { getUnseenCount } from './components/MessagesPage'
import ReportBugPage from './components/ReportBugPage'
import JoinTeamPage from './components/JoinTeamPage'
import BottomNav, { type BottomNavPage } from './components/BottomNav'

// Guest-only screens split out of the main bundle — signed-in users never
// pay for their code, matching the same split applied to the root web app.
const LoginPage = lazy(() => import('./components/LoginPage'))
const SignupPage = lazy(() => import('./components/SignupPage'))
const ForgotPasswordPage = lazy(() => import('./components/ForgotPasswordPage'))
const LandingPage = lazy(() => import('./landing/LandingPage'))

const suspenseFallback = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145.48deg,#F9FAFB 0%,#F0F2F5 100%)' }} />
)
import { API_BASE_URL } from './api/config'
import { registerBackHandler, exitApp } from './native'
import { configureIAP, resetIAPUser } from './native-iap'
import {
  getAllJobSeekerData,
  getJobs,
  getCandidates,
  getApplications,
  getContacts,
  getCandidateJobPairings,
  getContactJobPairings,
  type Candidate,
  type Job,
  type JobSeekerData,
  type Location,
} from './api/jobseeker.ts'
import { deleteAccount } from './api/users'
import { isNewJob } from './utils/jobUtils'

const API_BASE = API_BASE_URL

const NON_ENGLISH_CHARS = /[äöüßéèêëàâçñïîùûœæøåãõ]/i
const NON_ENGLISH_WORDS = /\b(und|oder|mit|für|auf|bei|wir|sind|haben|wird|eine|nicht|aber|mehr|auch|nach|wenn|noch|kann|muss|über|unter|durch|statt|unsere|unser|bewirb|stellenangebot|et|pour|avec|dans|sur|les|une|qui|par|notre|vous|nous|leur|des|offre|emploi|poste|empresa|trabajo|para|que|del|los|nuestro|con|desde|puesto|vaga|vagas|nosso|nossa|com|cargo|em|uma|och|eller|med|för|på|vid|är|har|bli|en|ett|og|til|av|er|som|vi|kan|dit|het|een|van|der|bij|zijn|naar|deze|wordt|worden|onze|per|con|nel|della|delle|lavoro|siamo|cerchiamo|offerta)\b/i
const isLikelyEnglish = (text: string) => {
  if (!text) return true
  if (NON_ENGLISH_CHARS.test(text)) return false
  if (NON_ENGLISH_WORDS.test(text)) return false
  return true
}

const getObjectIdDate = (id: unknown): Date | null => {
  if (typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000)
  }
  return null
}


const getMigratedStorageItem = (key: string, oldKeys: string[] = []) => {
  if (typeof window === 'undefined') return null
  const current = localStorage.getItem(key)
  if (current !== null) return current
  for (const oldKey of oldKeys) {
    const oldValue = localStorage.getItem(oldKey)
    if (oldValue !== null) {
      localStorage.setItem(key, oldValue)
      return oldValue
    }
  }
  return null
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const asText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

const asTextList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => asText(item).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

const asArray = (value: unknown): any[] => Array.isArray(value) ? value : []

const WELCOME_MODAL_VERSION = 'beta-welcome-tokens-v1'

const getWelcomeStorageKey = (user: any) => {
  const identifier = user?._id || user?.id || user?.email || user?.displayName || 'guest'
  return `wanderworkWelcomeSeen:${WELCOME_MODAL_VERSION}:${String(identifier).toLowerCase()}`
}

// Seed data (mirrors seed-backend.js) to keep UI populated if backend is empty
const seedJobs: Job[] = [
  {
    _id: 'seed-wh001',
    job_code: 'WH001',
    title: 'Senior Full Stack Developer',
    company: 'TechCorp',
    salary: '$120k-$160k',
    location: [{ city: 'San Francisco', state: 'CA', postalCode: '94102', country: 'USA' }],
    url: 'https://example.com/jobs/1',
    jobType: 'Full-time',
    datePosted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    shortDescription: 'Build scalable web applications with React, Node.js, and PostgreSQL.',
    tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS']
  },
  {
    _id: 'seed-wh002',
    job_code: 'WH002',
    title: 'Product Designer',
    company: 'DesignHub',
    salary: '$100k-$140k',
    location: [{ city: 'New York', state: 'NY', postalCode: '10001', country: 'USA' }],
    url: 'https://example.com/jobs/2',
    jobType: 'Full-time',
    datePosted: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    shortDescription: 'Create beautiful, user-centered designs for our mobile and web products.',
    tags: ['Figma', 'UI/UX', 'Prototyping', 'User Research']
  },
  {
    _id: 'seed-wh003',
    job_code: 'WH003',
    title: 'DevOps Engineer',
    company: 'CloudSystems',
    salary: '$130k-$170k',
    location: [{ city: 'Austin', state: 'TX', postalCode: '73301', country: 'USA' }],
    url: 'https://example.com/jobs/3',
    jobType: 'Full-time',
    datePosted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    shortDescription: 'Manage cloud infrastructure and CI/CD pipelines for a high-traffic platform.',
    tags: ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'CI/CD']
  }
]

const JOB_BOARDS = new Set([
  'linkedin', 'indeed', 'glassdoor', 'monster', 'ziprecruiter', 'wellfound', 'angellist',
  'greenhouse', 'lever', 'workday', 'ashby', 'smartrecruiters', 'jobvite', 'icims',
  'bamboohr', 'recruitee', 'workable', 'personio', 'teamtailor', 'jobs', 'careers',
  'remote', 'remoteok', 'weworkremotely', 'builtin', 'dice', 'simplyhired',
])

const isUnknownCompany = (value?: unknown) => {
  if (!value) return true
  const v = asText(value).trim().toLowerCase()
  if (/^(unknown|n\/a|na|none|null|undefined|\-|tbd)$/i.test(v)) return true
  // Treat job board names stored as company by scrapers as unknown
  if (JOB_BOARDS.has(v)) return true
  return false
}

const inferCompanyFromUrl = (url: string) => {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./i, '')
    const parts = host.split('.').filter(Boolean)
    if (parts.length === 0) return ''
    const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    const blocked = new Set([
      'greenhouse', 'lever', 'workday', 'myworkdayjobs', 'ashbyhq', 'ashby', 'smartrecruiters',
      'applytojob', 'jobvite', 'icims', 'jazz', 'recruitee', 'bamboohr', 'indeed', 'linkedin',
      'glassdoor', 'monster', 'ziprecruiter', 'wellfound', 'angellist', 'careers', 'jobs',
      'workable', 'personio', 'teamtailor'
    ])
    if (blocked.has(root.toLowerCase())) return ''
    return root
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  } catch {
    return ''
  }
}

const inferCompanyFromDescription = (description: string, jobTitle?: string) => {
  if (!description) return ''
  const text = description.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  const normalizeCandidate = (value: string) => {
    const cleaned = value.replace(/^[\"'“”‘’]+|[\"'“”‘’,.;:]+$/g, '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return ''
    if (/^(the|our|we|you|your|this|that|these|those)$/i.test(cleaned)) return ''
    if (/^(company|team|role|position)$/i.test(cleaned)) return ''
    return cleaned
  }

  const splitWords = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const titleWords = new Set(splitWords(jobTitle || ''))
  const roleWords = new Set([
    'senior', 'lead', 'principal', 'engineer', 'developer', 'designer', 'manager', 'director',
    'analyst', 'product', 'marketing', 'sales', 'ux', 'ui', 'full', 'stack', 'front', 'back',
    'software', 'data', 'business', 'project', 'brand', 'role', 'position'
  ])

  const isLikelyCompany = (value: string) => {
    const cleaned = normalizeCandidate(value)
    if (!cleaned) return false
    const words = splitWords(cleaned)
    if (!words.length) return false
    if (words.every((word) => titleWords.has(word))) return false
    if (words.every((word) => roleWords.has(word))) return false
    if (words.length === 1 && words[0].length < 3 && !/^[A-Z]{2,}$/.test(cleaned)) return false
    return true
  }

  const patterns = [
    /(?:^|[.!?\n]\s*)(?:at|with|join)\s+([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})/,
    /(?:^|[.!?\n]\s*)(?:company|company overview|about)\s*[:\-]?\s*([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})/,
    /\b([A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})\s+(?:is|are|was|were)\s+(?:a|an|the)\b/,
    /\b([A-Z]{2,}(?:\s+[A-Z]{2,}){0,3})\b/
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const candidate = normalizeCandidate(match[1])
      if (candidate && isLikelyCompany(candidate)) return candidate
    }
  }

  const candidateCounts = new Map<string, number>()
  const capsPattern = /\b([A-Z][a-z0-9&.'-]+(?:\s+[A-Z][a-z0-9&.'-]+){0,3})\b/g
  let found = capsPattern.exec(text)
  while (found) {
    const candidate = normalizeCandidate(found[1])
    if (candidate && isLikelyCompany(candidate)) {
      candidateCounts.set(candidate, (candidateCounts.get(candidate) || 0) + 1)
    }
    found = capsPattern.exec(text)
  }

  let best = ''
  let bestCount = 0
  for (const [candidate, count] of candidateCounts.entries()) {
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return best
}

const cleanCompanyName = (raw: unknown): string => {
  // Strip junk patterns like "Oriient About Oriient", "Acme Inc About Acme Inc"
  let s = asText(raw, 'Unknown').trim()
  // Remove trailing "About <anything>" suffixes
  s = s.replace(/\s+About\s+.+$/i, '').trim()
  // Remove leading "About <Company>" prefixes
  s = s.replace(/^About\s+/i, '').trim()
  // Remove "@ CompanyName" suffixes in job titles that leaked into company field
  s = s.replace(/\s*@\s*.+$/, '').trim()
  return s
}

const inferCompanyName = (company: unknown, description: string, url: string, title?: string) => {
  if (!isUnknownCompany(company)) return cleanCompanyName(company)
  const fromDescription = inferCompanyFromDescription(description, title)
  if (fromDescription) return cleanCompanyName(fromDescription)
  const fromUrl = inferCompanyFromUrl(url)
  if (fromUrl) return fromUrl
  return asText(company, 'Unknown').trim() || 'Unknown'
}

const cleanLocationString = (raw: string): string => {
  // If it looks like a sentence/description rather than a real location, fall back to Remote
  const descriptionLike = /\b(we|our|the company|globally|across|worldwide|seeking|hiring|looking|team|opportunity)\b/i
  if (descriptionLike.test(raw) && raw.length > 40) return 'Remote'
  // Strip "About X" or trailing company names that leaked in
  let s = raw.replace(/\s*-\s*(Remote|Hybrid|On-site)$/i, (_, type) => ` - ${type}`).trim()
  // If it's very long and contains a dash followed by Remote, keep just "Remote"
  if (/^\s*remote\s*$/i.test(s)) return 'Remote'
  return s
}

// Fix Wellfound job URLs that are missing a numeric ID — those URLs always 404 in the browser.
// Wellfound's current format is /company/[slug]/jobs/[numeric-id]-[title-slug].
// When the stored URL has no numeric prefix (e.g. /jobs/machine-learning-engineer), fall back
// to the company's jobs listing page which is always a working URL.
function normalizeJobUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (!u.hostname.includes('wellfound.com')) return url
    const match = u.pathname.match(/^\/company\/([^/]+)\/jobs\/([^/]+)$/)
    if (match) {
      const jobSlug = match[2]
      // If the job slug starts with a numeric ID the URL is current-format and should work
      if (/^\d/.test(jobSlug)) return url
      // No numeric ID — fall back to the company's jobs page
      return `https://wellfound.com/company/${match[1]}/jobs`
    }
  } catch { /* invalid URL, return as-is */ }
  return url
}

// Transform backend job data to component format
const buildRemoteLocationPrefix = (rawLocation: unknown, normalizedLocation: string): string | null => {
  const rawText = typeof rawLocation === 'string'
    ? rawLocation
    : Array.isArray(rawLocation)
      ? rawLocation
          .map((loc: any) => [loc?.city, loc?.state].filter(Boolean).join(', '))
          .filter(Boolean)
          .join(' / ')
      : ''

  const text = rawText.trim()
  if (!text) return null

  const isRemoteLike = /\b(remote|work from home|wfh|virtual|online)\b/i.test(text)
  if (!isRemoteLike && !/^remote$/i.test(normalizedLocation)) return null

  const cleanedText = text
    .replace(/^(?:remote|work from home|wfh|virtual|online)\b[\s\-/,:]*/i, '')
    .trim()

  const onlyMatch = cleanedText.match(/([A-Za-z0-9][A-Za-z0-9 .,'-]+?)\s+only\b/i)
  if (!onlyMatch) return null

  const qualifier = onlyMatch[1].trim().replace(/^[\-/]\s*/, '').trim()
  if (!qualifier || /^(remote|work from home|wfh|virtual|online)$/i.test(qualifier)) return null

  return `Remote — ${qualifier}`
}

function transformJob(job: Job, index: number) {
  const locationString = (() => {
    const locVal: any = (job as any).location
    if (Array.isArray(locVal)) {
      const parts = locVal
        .map((loc: Location) => [loc?.city, loc?.state].filter(Boolean).join(', '))
        .filter(Boolean)
      if (parts.length) return parts.join(' / ')
    }
    if (typeof locVal === 'string') return cleanLocationString(locVal)
    return 'Remote'
  })()

  const rawDate = (job as any).datePosted || (job as any).postedAt || (job as any).postedDate || (job as any).date_posted || null

  // Try parsing the date - handle various formats
  let parsedDate = null
  if (rawDate) {
    parsedDate = new Date(rawDate)
    if (isNaN(parsedDate.getTime()) && typeof rawDate === 'string') {
      parsedDate = new Date(rawDate + 'Z')
    }
    if (isNaN(parsedDate.getTime()) && !isNaN(Number(rawDate))) {
      parsedDate = new Date(Number(rawDate))
    }
  }
  if (parsedDate && isNaN(parsedDate.getTime())) parsedDate = null

  // Fallback: extract creation timestamp from MongoDB ObjectId (first 4 bytes = unix seconds)
  const objectIdDate = getObjectIdDate((job as any)._id)

  const dateStr = parsedDate ? parsedDate.toISOString() : (objectIdDate?.toISOString() ?? null)

  const description = (() => {
    const isDateLike = (value: string) => {
      // simple ISO-ish check to avoid using dates as descriptions
      return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    }

    const stripHtml = (html: string) => {
      const tmp = document.createElement('div')
      tmp.innerHTML = html
      return tmp.textContent || tmp.innerText || ''
    }

    const normalizeString = (value: string) => {
      const trimmed = value.trim()
      const plain = trimmed.includes('<') ? stripHtml(trimmed) : trimmed
      return plain.trim()
    }

    const stripDescriptionMeta = (value: string) => {
      let cleaned = value
      cleaned = cleaned.replace(/updated description\s*:/gi, '')
      cleaned = cleaned.replace(/\bcompany\s*name\s*:\s*[^.\n\r]*/gi, '')
      cleaned = cleaned.replace(/\bcompany\s*:\s*[^.\n\r]*/gi, '')
      cleaned = cleaned.replace(/\bname\s*:\s*/gi, '')
      cleaned = cleaned.replace(/\bsalary\s*:\s*[^.\n\r]*/gi, '')
      cleaned = cleaned.replace(/\bcompensation\s*:\s*[^.\n\r]*/gi, '')
      cleaned = cleaned.replace(/\bbenefits\s*:\s*[^.\n\r]*/gi, '')
      cleaned = cleaned.replace(/\bpay\s*:\s*[^.\n\r]*/gi, '')
      cleaned = cleaned.replace(/\s{2,}/g, ' ').trim()
      return cleaned
    }

    const isMetaOnly = (value: string) => {
      const lower = value.toLowerCase()
      const hasMeta = lower.includes('company name') || lower.includes('salary') || lower.includes('compensation') || lower.includes('benefits') || lower.includes('pay')
      return hasMeta && value.length < 80
    }

    const candidates = [
      (job as any).description,
      (job as any).shortDescription,
      (job as any).description_short,
      (job as any).descriptionShort,
      (job as any).description_text,
      (job as any).descriptionText,
      (job as any)['Job Description'],
      (job as any).jobDescription,
      (job as any).summary,
    ]
    for (const candidate of candidates) {
      if (!candidate) continue
      if (typeof candidate === 'string') {
        const normalized = normalizeString(candidate)
        const cleaned = stripDescriptionMeta(normalized)
        if (cleaned && !isDateLike(cleaned) && !isMetaOnly(cleaned)) return cleaned
      } else if (Array.isArray(candidate)) {
        const joined = candidate.filter(Boolean).join(' ')
        const normalized = normalizeString(joined)
        const cleaned = stripDescriptionMeta(normalized)
        if (cleaned && !isDateLike(cleaned) && !isMetaOnly(cleaned)) return cleaned
      } else if (typeof candidate === 'object') {
        const values = Object.values(candidate).filter((v) => typeof v === 'string') as string[]
        const combined = normalizeString(values.join(' '))
        const cleaned = stripDescriptionMeta(combined)
        if (cleaned && !isDateLike(cleaned) && !isMetaOnly(cleaned)) return cleaned
      }
    }

    // Generic sniff: find the first non-trivial string field on the job
    const excludedKeys = new Set([
      '_id', 'title', 'company', 'salary', 'location', 'job_code', 'code', 'jobType', 'type', 'url',
      'datePosted', 'postedAt', 'preparedAt', 'createdAt', 'updatedAt'
    ])
    for (const [key, value] of Object.entries(job as any)) {
      if (excludedKeys.has(key)) continue
      if (typeof value === 'string') {
        const normalized = normalizeString(value)
        if (normalized.length >= 20 && !normalized.startsWith('http') && !isDateLike(normalized)) return normalized
      }
      if (Array.isArray(value)) {
        const normalized = normalizeString(value.filter(Boolean).join(' '))
        if (normalized.length >= 20 && !isDateLike(normalized)) return normalized
      }
      if (value && typeof value === 'object') {
        const normalized = normalizeString(Object.values(value).filter((v) => typeof v === 'string').join(' '))
        if (normalized.length >= 20 && !isDateLike(normalized)) return normalized
      }
    }

    return 'No description available'
  })()

  const remoteLocationPrefix = buildRemoteLocationPrefix((job as any).location, locationString)
  const descriptionWithRemoteNote = remoteLocationPrefix ? `${remoteLocationPrefix}\n\n${description}` : description

  const jobTitle = asText((job as any).title, 'Untitled')
  const inferredCompany = inferCompanyName((job as any).company, descriptionWithRemoteNote, asText((job as any).url), jobTitle)

  return {
    id: index + 1,
    backendId: job._id,
    title: jobTitle,
    company: inferredCompany,
    description: descriptionWithRemoteNote,
    location: locationString,
    skills: (job as any).tags || (job as any).skills || [],
    hasNewBadge: isNewJob({ postedAt: dateStr }),
    interested: false,
    showCoverLetter: false,
    postedAt: dateStr,
    salary: (job as any).salary,
    url: normalizeJobUrl((job as any).url),
    apply_url: (job as any).apply_url || (job as any).applyUrl || null,
    company_url: (job as any).company_url || null,
    jobType: (job as any).jobType || (job as any).job_type || (job as any).type,
    job_code: (job as any).job_code || (job as any).code,
    rawDate: dateStr, // Use the parsed dateStr instead of original rawDate
  }
}

function App() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [selectedJobRecord, setSelectedJobRecord] = useState<any | null>(null)
  const [data, setData] = useState<JobSeekerData | null>(null)
  const [transformedJobs, setTransformedJobs] = useState<any[]>([])
  const [publicJobs, setPublicJobs] = useState<any[]>([])
  const [publicJobsLoading, setPublicJobsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [topVisibleJobId, setTopVisibleJobId] = useState<number | null>(null)
  const [topVisibleJobRecord, setTopVisibleJobRecord] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNewOnly, setShowNewOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'settings' | 'privacy' | 'terms' | 'plans' | 'profile' | 'accountsettings' | 'personal' | 'payment' | 'upgrade' | 'messages' | 'reportbug' | 'jointeam'>(() => {
    const path = window.location.pathname
    if (path === '/privacy') return 'privacy'
    if (path === '/terms') return 'terms'
    if (path === '/bug-report' || path === '/report-bug') return 'reportbug'
    return 'dashboard'
  })
  const [unseenAppCount, setUnseenAppCount] = useState(0)
  const [settingsTab, setSettingsTab] = useState<'account' | 'personal' | 'payment' | 'upgrade' | 'extension'>('personal')
  const [pendingCoverLetterJobId, setPendingCoverLetterJobId] = useState<string | null>(null)
  const [autoOpenCoverLetterJobId, setAutoOpenCoverLetterJobId] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [hamburgerHovered, setHamburgerHovered] = useState(false)
  const [logoText, setLogoText] = useState('')
  useEffect(() => {
    const FULL = 'WANDER/WORK'
    let i = 0
    const timer = setInterval(() => {
      i++
      setLogoText(FULL.slice(0, i))
      if (i >= FULL.length) clearInterval(timer)
    }, 75)
    return () => clearInterval(timer)
  }, [])

  const [oauthError, setOauthError] = useState<string | null>(null)
  const [tokenClaimNotice, setTokenClaimNotice] = useState<{ text: string; success: boolean } | null>(null)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  // Handle OAuth callbacks (LinkedIn redirect, etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('token')
    const oauthUser = params.get('user')
    const oauthErr = params.get('error')
    const claimToken = params.get('claimToken')
    const claimEmail = params.get('claimEmail')

    if (claimToken && claimEmail) {
      window.history.replaceState({}, '', window.location.pathname)
      fetch(`${API_BASE}/jobseeker/claim-weekly-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: claimEmail, token: claimToken }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const plural = data.tokensAdded > 1
            setTokenClaimNotice({ text: `+${data.tokensAdded} free token${plural ? 's' : ''} added to your account!`, success: true })
          } else {
            setTokenClaimNotice({ text: data.error || 'Token claim failed.', success: false })
          }
          setTimeout(() => setTokenClaimNotice(null), 8000)
        })
        .catch(() => {
          setTokenClaimNotice({ text: 'Something went wrong claiming your token. Please try again.', success: false })
          setTimeout(() => setTokenClaimNotice(null), 6000)
        })
    } else if (oauthToken && oauthUser) {
      try {
        const userData = JSON.parse(decodeURIComponent(oauthUser))
        localStorage.setItem('wanderworkToken', oauthToken)
        localStorage.setItem('wanderworkUser', JSON.stringify(userData))
        setToken(oauthToken)
        setUser(userData)
        setShowLogin(false)
        window.history.replaceState({}, '', window.location.pathname)
      } catch (e) {
        console.warn('OAuth callback parse error', e)
      }
    } else if (oauthErr === 'linkedin_scope') {
      setOauthError('LinkedIn connection failed. Please enable "Sign In with LinkedIn using OpenID Connect" in your LinkedIn developer app, then try again.')
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setOauthError(null), 10000)
    } else if (oauthErr === 'linkedin') {
      setOauthError('LinkedIn sign-in failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setOauthError(null), 6000)
    } else if (params.get('checkout') === 'success') {
      const plan = params.get('plan')
      const type = params.get('type')
      window.history.replaceState({}, '', window.location.pathname)
      if (type === 'tokens') {
        const qty = params.get('tokens')
        setTokenClaimNotice({ text: qty ? `${qty} tokens added to your account!` : 'Tokens added to your account!', success: true })
      } else if (plan) {
        const planLabel = plan === 'pro' ? 'Pro' : plan === 'premium' ? 'Premium' : plan
        setTokenClaimNotice({ text: `You're now on Wander/Work ${planLabel}. Welcome!`, success: true })
      } else {
        setTokenClaimNotice({ text: 'Payment successful. Your account has been upgraded!', success: true })
      }
      setTimeout(() => setTokenClaimNotice(null), 8000)
    } else if (params.get('checkout') === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('upgrade') === '1') {
      setCurrentPage('plans')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('coverletter') === '1') {
      setCurrentPage('dashboard')
      const jobId = params.get('jobId')
      if (jobId) setPendingCoverLetterJobId(jobId)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])
  const [showRecruiterNavModal, setShowRecruiterNavModal] = useState(false)
  const [showAutoApplyPopover, setShowAutoApplyPopover] = useState(false)
  const autoApplyBtnRef = useRef<HTMLButtonElement>(null)
  const [profileImage, setProfileImage] = useState<string | null>(() => {
    return getMigratedStorageItem('wanderworkProfileImage', ['wanderHireProfileImage'])
  })
    const [_user, setUser] = useState<any | null>(() => {
      const stored = getMigratedStorageItem('wanderworkUser', ['wanderHireUser'])
      if (!stored) return null
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.warn('Invalid wanderworkUser in localStorage, clearing')
        localStorage.removeItem('wanderworkUser')
        return null
      }
    })
  const [_token, setToken] = useState<string | null>(() => {
    return getMigratedStorageItem('wanderworkToken', ['wanderHireToken'])
  })

  useEffect(() => {
    if (!_token || !_user) {
      setShowWelcomeModal(false)
      return
    }
    const key = getWelcomeStorageKey(_user)
    setShowWelcomeModal(localStorage.getItem(key) !== 'true')
  }, [_token, _user])

  // RevenueCat's app_user_id is set to the account email so the backend
  // webhook (keyed the same way Stripe checkout already is) can credit the
  // right account for a native purchase.
  useEffect(() => {
    configureIAP(_user?.email || undefined)
  }, [_user?.email])


  const dismissWelcomeModal = () => {
    if (_user) localStorage.setItem(getWelcomeStorageKey(_user), 'true')
    setShowWelcomeModal(false)
  }

  useEffect(() => {
    if (!showAutoApplyPopover) return
    const handler = (e: MouseEvent) => {
      const anchor = autoApplyBtnRef.current?.closest('[data-auto-apply-anchor]')
      if (!anchor || !anchor.contains(e.target as Node)) {
        setShowAutoApplyPopover(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAutoApplyPopover])

  useEffect(() => {
    if (!showWelcomeModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissWelcomeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showWelcomeModal, _user])

  useEffect(() => {
    if (!pendingCoverLetterJobId || !transformedJobs.length) return
    const match = transformedJobs.find((j: any) => j.backendId === pendingCoverLetterJobId || j.backendId?.toString() === pendingCoverLetterJobId)
    if (match) {
      setSelectedJobId(match.id)
      setAutoOpenCoverLetterJobId(match.id)
      setPendingCoverLetterJobId(null)
    }
  }, [pendingCoverLetterJobId, transformedJobs])

  useEffect(() => {
    if (!_user?.email) { setUnseenAppCount(0); return }
    const fetchCount = () => {
      fetch(`${API_BASE}/jobseeker/application?email=${encodeURIComponent(_user.email)}`)
        .then(r => r.json())
        .then((apps: any[]) => { if (Array.isArray(apps)) setUnseenAppCount(getUnseenCount(apps)) })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [_user?.email])

  type Page = 'dashboard' | 'settings' | 'privacy' | 'terms' | 'plans' | 'profile' | 'accountsettings' | 'personal' | 'payment' | 'upgrade' | 'messages' | 'reportbug' | 'jointeam'
  const PAGE_URLS: Partial<Record<Page, string>> = { privacy: '/privacy', terms: '/terms', reportbug: '/bug-report' }

  // Tracks how many history entries navigateTo/the auth-screen effect below
  // have pushed but not yet had popped (via a real back-navigation or the
  // history.back() calls below). Without this, the Android hardware back
  // button — which changes screens by setting state directly rather than
  // navigating history — leaves those entries stranded, so the WebView's
  // history stack silently grows out of sync with what's on screen.
  const pushedHistoryDepth = useRef(0)

  const navigateTo = (page: Page) => {
    const url = PAGE_URLS[page] ?? '/'
    window.history.pushState({ wanderPage: page }, '', url)
    pushedHistoryDepth.current += 1
    setCurrentPage(page)
  }
  // Pops the history entry navigateTo pushed to get here, if one is open,
  // so the stack stays balanced; falls back to a direct state change when
  // this screen was reached some other way (e.g. bottom nav / menu, which
  // never push) and there's nothing to unwind.
  const navigateBack = () => {
    if (pushedHistoryDepth.current > 0) {
      window.history.back()
      return
    }
    setCurrentPage('dashboard')
  }

  const clearLocalAuth = () => {
    localStorage.removeItem('wanderworkToken')
    localStorage.removeItem('wanderworkUser')
    localStorage.removeItem('wanderworkProfileImage')
    setUser(null)
    setToken(null)
    setData(null)
    setProfileImage(null)
    resetIAPUser()
  }

  const handleDeleteAccount = async () => {
    try { await deleteAccount() } catch { /* account may already be gone */ }
    clearLocalAuth()
    setCurrentPage('dashboard')
  }

  const [showLogin, setShowLogin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('login') === 'true'
  })
  const [showSignup, setShowSignup] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('signup') === 'true'
  })
  const [showPlans, setShowPlans] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.location.pathname === '/landing'
  })

  useEffect(() => {
    return registerBackHandler(() => {
      if (showMenu) return setShowMenu(false)
      if (showRecruiterNavModal) return setShowRecruiterNavModal(false)
      if (selectedJobId !== null) return setSelectedJobId(null)
      if (showForgotPassword) return setShowForgotPassword(false)
      if (showSignup || showLogin) {
        // The auth-screen effect below pushed a history entry to get here —
        // pop it so the stack stays balanced, and let the popstate handler
        // apply the actual state change instead of doing it here too.
        if (pushedHistoryDepth.current > 0) { window.history.back(); return }
        if (showSignup) return setShowSignup(false)
        return setShowLogin(false)
      }
      if (showPlans) return setShowPlans(false)
      if (currentPage !== 'dashboard') {
        if (pushedHistoryDepth.current > 0) { window.history.back(); return }
        return setCurrentPage('dashboard')
      }
      exitApp()
    })
  }, [showMenu, showRecruiterNavModal, selectedJobId, showForgotPassword, showSignup, showLogin, showPlans, currentPage, showLandingPage])

  useEffect(() => {
    if (pendingCoverLetterJobId && !_token) {
      setShowLogin(true)
    }
  }, [pendingCoverLetterJobId, _token])

  // Push a history entry when navigating to auth screens so the browser back button
  // returns to the landing page instead of potentially bypassing auth.
  useEffect(() => {
    if (showLogin || showSignup) {
      window.history.pushState({ wanderAuth: true }, '')
      pushedHistoryDepth.current += 1
    }
  }, [showLogin, showSignup])

  // SEO: update document title and robots meta based on current page/auth state.
  // Private pages (dashboard, settings, auth screens) get noindex so Google doesn't
  // waste crawl budget on login walls or personal data views.
  useEffect(() => {
    const PAGE_META: Partial<Record<string, { title: string; noindex?: boolean }>> = {
      dashboard:      { title: 'Dashboard | WanderWork', noindex: true },
      settings:       { title: 'Settings | WanderWork', noindex: true },
      profile:        { title: 'My Profile | WanderWork', noindex: true },
      messages:       { title: 'Messages | WanderWork', noindex: true },
      accountsettings:{ title: 'Account Settings | WanderWork', noindex: true },
      personal:       { title: 'Personal Info | WanderWork', noindex: true },
      payment:        { title: 'Billing | WanderWork', noindex: true },
      upgrade:        { title: 'Upgrade | WanderWork', noindex: true },
      reportbug:      { title: 'Report a Bug | WanderWork', noindex: true },
      jointeam:       { title: 'Join the Team | WanderWork', noindex: true },
      plans:          { title: 'Plans & Pricing | WanderWork', noindex: false },
      privacy:        { title: 'Privacy Policy | WanderWork', noindex: false },
      terms:          { title: 'Terms of Service | WanderWork', noindex: false },
    }

    const effectivePage = showLandingPage ? '__landing__' : showLogin || showSignup ? '__auth__' : currentPage
    const meta = effectivePage === '__landing__'
      ? { title: 'WanderWork — Remote Jobs & AI Job Search', noindex: false }
      : effectivePage === '__auth__'
      ? { title: 'WanderWork — Remote Jobs & AI Job Search', noindex: true }
      : (PAGE_META[effectivePage] ?? { title: 'WanderWork — Remote Jobs & AI Job Search', noindex: false })

    document.title = meta.title

    let robotsTag = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robotsTag) {
      robotsTag = document.createElement('meta')
      robotsTag.name = 'robots'
      document.head.appendChild(robotsTag)
    }
    robotsTag.content = meta.noindex ? 'noindex, nofollow' : 'index, follow'

    let canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonicalTag) {
      canonicalTag = document.createElement('link')
      canonicalTag.rel = 'canonical'
      document.head.appendChild(canonicalTag)
    }
    canonicalTag.href = `https://wanderwork.io${window.location.pathname === '/' ? '/' : window.location.pathname}`
  }, [currentPage, showLogin, showSignup, showLandingPage])

  useEffect(() => {
    if (_token) return
    const JUNK_SALARY = /^(not listed|unlisted|competitive|tbd|negotiable|n\/a|see below|varies|open|flexible)$/i
    const EXCLUDE_SRC = /indeed|linkedin/i
    const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000
    const mapJobs = (raw: any[]) => raw.map((j: any, i: number) => {
      const postedAt = j.date_posted || j.datePosted || j.postedAt || null
      const parsedDate = postedAt ? new Date(postedAt) : null
      const validParsedDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null
      const objectIdDate = !validParsedDate ? getObjectIdDate(j._id) : null
      const effectiveDate = validParsedDate || objectIdDate
      return {
        id: i + 1,
        backendId: j._id,
        title: j.title || j.positionName || 'Untitled',
        company: j.company || 'Unknown',
        description: j.description_short || j.shortDescription || '',
        location: typeof j.location === 'string' ? j.location : 'Remote',
        salary: j.salary || 'Not Listed',
        url: j.url || '',
        apply_url: j.apply_url || j.applyUrl || null,
        company_url: j.company_url || null,
        jobType: j.job_type || j.jobType || '',
        source: j.source || '',
        skills: j.tags || j.skills || [],
        hasNewBadge: isNewJob(j),
        interested: false,
        showCoverLetter: false,
        postedAt: effectiveDate?.toISOString() || null,
      }
    })
    // Try the curated endpoint first; fall back to full list with client-side filtering
    fetch(`${API_BASE}/jobseeker/featured-jobs`)
      .then(async r => {
        if (!r.ok) throw new Error('featured-jobs not available')
        return r.json()
      })
      .then(data => {
        const jobs = (Array.isArray(data) ? data : (data?.Jobs || data?.jobs || []))
          .filter((j: any) => {
            const t = String(j.title || ''); const d = String(j.description_short || j.shortDescription || j.description || '')
            return isLikelyEnglish(t) && isLikelyEnglish(d)
          })
        setPublicJobs(mapJobs(jobs))
      })
      .catch(() =>
        fetch(`${API_BASE}/jobseeker/job`)
          .then(r => r.json())
          .then(data => {
            const all: any[] = Array.isArray(data) ? data : (data?.Jobs || data?.jobs || [])
            const filtered = all
              .filter(j => {
                const src = String(j.source || '').toLowerCase()
                if (EXCLUDE_SRC.test(src)) return false
                const raw = j.date_posted || j.datePosted || j.postedAt
                if (raw) {
                  const ts = new Date(raw).getTime()
                  if (!Number.isNaN(ts) && ts < THIRTY_DAYS_AGO) return false
                }
                const title = String(j.title || j.positionName || '').trim()
                const company = String(j.company || '').trim()
                const descText = String(j.description_short || j.shortDescription || j.description || '')
                if (!isLikelyEnglish(title) || !isLikelyEnglish(descText)) return false
                return title && title !== 'Untitled' && company && company !== 'Unknown' && (j.url || j.apply_url)
              })
              .map(j => {
                const salary = String(j.salary || '')
                const hasSalary = salary && !JUNK_SALARY.test(salary) && /\d/.test(salary)
                const desc = String(j.description_short || j.shortDescription || '')
                let score = 0
                if (hasSalary) score += 3
                if (desc.length >= 250) score += 3
                else if (desc.length >= 80) score += 2
                else if (desc.length >= 20) score += 1
                score += Math.random() * 0.5
                return { j, score }
              })
              .sort((a, b) => b.score - a.score)
              .slice(0, 60)
              .map(({ j }) => j)
            setPublicJobs(mapJobs(filtered))
          })
          .catch(() => {})
      )
      .finally(() => setPublicJobsLoading(false))
  }, [_token])

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      pushedHistoryDepth.current = Math.max(0, pushedHistoryDepth.current - 1)
      setShowLogin(false)
      setShowSignup(false)
      setShowForgotPassword(false)
      if (!_token) setShowPlans(false)
      const page = (e.state as any)?.wanderPage
      if (page) {
        setCurrentPage(page)
      } else {
        const path = window.location.pathname
        if (path === '/privacy') setCurrentPage('privacy')
        else if (path === '/terms') setCurrentPage('terms')
        else if (path === '/bug-report' || path === '/report-bug') setCurrentPage('reportbug')
        else setCurrentPage('dashboard')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [_token])

  const buildFallbackCandidate = (): Candidate => {
    const storedProfileRaw = getMigratedStorageItem('wanderworkProfile', ['wanderHireProfile'])
    let storedProfile: any = null
    if (storedProfileRaw) {
      try {
        storedProfile = JSON.parse(storedProfileRaw)
      } catch {
        storedProfile = null
      }
    }

    const storedUserRaw = getMigratedStorageItem('wanderworkUser', ['wanderHireUser'])
    let storedUser: any = _user
    if (!storedUser && storedUserRaw) {
      try {
        storedUser = JSON.parse(storedUserRaw)
      } catch {
        storedUser = null
      }
    }

    const displayName =
      storedUser?.displayName ||
      storedProfile?.fullName ||
      storedProfile?.name ||
      storedUser?.email ||
      storedProfile?.email ||
      'Wanderwork Member'
    const nameParts = String(displayName || '').trim().split(' ')
    const firstName = storedProfile?.firstName || storedUser?.firstName || nameParts[0] || 'Wanderwork'
    const lastName = storedProfile?.lastName || storedUser?.lastName || nameParts.slice(1).join(' ') || 'Member'
    const resumeUrl = typeof storedProfile?.resume === 'string'
      ? storedProfile.resume
      : storedProfile?.resume?.url || storedProfile?.resumeLink || ''
    return {
      _id: storedUser?._id || storedUser?.id || 'local-profile',
      email: storedUser?.email || storedProfile?.email || '',
      firstName,
      lastName,
      phone: storedProfile?.phone || '',
      location: storedProfile?.location
        ? [{ locationName: storedProfile.location, city: storedProfile.location }]
        : [{ locationName: 'New York, NY', city: 'New York', state: 'NY' }],
      targetRoles: storedProfile?.title ? [storedProfile.title] : [],
      seniority: [],
      skills: storedProfile?.skills ? String(storedProfile.skills).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      urls: storedProfile ? [
        storedProfile.linkedin ? { urlName: 'LinkedIn', urlAddress: storedProfile.linkedin } : null,
        storedProfile.portfolio ? { urlName: 'Portfolio', urlAddress: storedProfile.portfolio } : null,
        storedProfile.github ? { urlName: 'GitHub', urlAddress: storedProfile.github } : null,
        storedProfile.calendly ? { urlName: 'Calendly', urlAddress: storedProfile.calendly } : null
      ].filter(Boolean) : [],
      resume: storedProfile?.resume || {},
      resumeLink: resumeUrl,
      status: 'active',
      paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  }
  const handleCandidateUpdate = (patch: any) => {
    if (!patch || typeof patch !== 'object') return
    setData((prev) => {
      const base = prev ?? {
        Applications: [],
        Contacts: [],
        CandidateJobPairing: [],
        ContactJobPairing: [],
        Jobs: seedJobs,
        Candidates: [],
      }
      const baseCandidate = (base.Candidates && base.Candidates[0]) || buildFallbackCandidate() || {}
      const updated = { ...baseCandidate, ...patch }
      const restCandidates = Array.isArray(base.Candidates) ? base.Candidates.slice(1) : []
      return { ...base, Candidates: [updated, ...restCandidates] }
    })
  }

  const refreshPairings = async () => {
    try {
      const pairings = await getCandidateJobPairings()
      if (Array.isArray(pairings)) {
        setData((prev) => prev ? { ...prev, CandidateJobPairing: pairings } : prev)
      }
    } catch (_) {}
  }

  const searchJobsFromDatabase = useCallback(async (query: string) => {
    const results = await getJobs({ query, limit: 200 })
    return results.map((job, index) => transformJob(job as Job, 50000 + index))
  }, [])

  // Defensive default to avoid null data usage
  const fallbackCandidate = buildFallbackCandidate()
  const safeDataBase: JobSeekerData = (data ?? {
    Applications: [],
    Contacts: [],
    CandidateJobPairing: [],
    ContactJobPairing: [],
    Jobs: seedJobs,
    Candidates: [],
  }) as JobSeekerData
  const safeCandidates = safeDataBase.Candidates?.length
    ? safeDataBase.Candidates
    : (fallbackCandidate ? [fallbackCandidate] : [])
  const safeData: JobSeekerData = {
    ...safeDataBase,
    Candidates: safeCandidates
  }

  // Mock jobs with varied data
  const mockJobs = [
    {
      id: 1,
      title: 'Full Stack Developer',
      company: 'Delta',
      description: 'Build scalable web applications with modern technologies. We\'re looking for experienced full stack developers to join our innovative team.',
      location: 'Atlanta, GA',
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      hasNewBadge: true,
      interested: true,
      showCoverLetter: true,
      postedAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: 'Product Designer',
      company: 'Coca - Cola',
      description: 'Stand out with AI-optimized resumes and personalized job matches. Create experiences that impact millions.',
      location: 'New York, NY',
      skills: ['UX Design', 'Art Direction', 'Marketing'],
      hasNewBadge: true,
      interested: false,
      showCoverLetter: false,
      postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      title: 'Product Owner',
      company: 'Mitsubishi',
      description: 'Lead product strategy and development for our next-generation automotive technology platform.',
      location: 'Los Angeles, CA',
      skills: ['Product Strategy', 'Agile', 'Data Analysis'],
      hasNewBadge: true,
      interested: true,
      showCoverLetter: false,
      postedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      title: 'UX/UI Designer',
      company: 'Adobe',
      description: 'Join our design team to create innovative digital experiences used by millions worldwide. Shape the future of design.',
      location: 'San Francisco, CA',
      skills: ['Figma', 'User Research', 'Prototyping'],
      hasNewBadge: true,
      interested: false,
      showCoverLetter: false,
      postedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]

  useEffect(() => {
    const controller = new AbortController()

    const useJobs = (payload: {
      jobs: Job[]
      candidates: any[]
      applications?: any[]
      contacts?: any[]
      cjPairings?: any[]
      contactPairings?: any[]
    }) => {
      const jobsMapped = payload.jobs.map((job, index) => transformJob(job as Job, index))
      setTransformedJobs(jobsMapped.length > 0 ? jobsMapped : mockJobs)
      setData({
        Applications: payload.applications || [],
        Contacts: payload.contacts || [],
        CandidateJobPairing: payload.cjPairings || [],
        ContactJobPairing: payload.contactPairings || [],
        Jobs: payload.jobs,
        Candidates: payload.candidates,
      })
      // Auto-select first job on tablet and desktop (md = 768px+)
      if (jobsMapped.length > 0 && window.innerWidth >= 768) {
        setSelectedJobId((current) => current ?? jobsMapped[0].id)
      }
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Preferred: single aggregate call
        try {
          const result = await getAllJobSeekerData({ signal: controller.signal })
          const sourceJobs = result?.Jobs?.length ? result.Jobs : seedJobs
          let sourceCandidates = result?.Candidates?.length ? result.Candidates : []

          // Narrow to the logged-in user's candidate when we have multiple
          if (_user?.email && sourceCandidates.length > 1) {
            const match = sourceCandidates.find((c: any) => (c.email || '').toLowerCase() === (_user.email || '').toLowerCase())
            if (match) sourceCandidates = [match]
          }

          // Logged-in user has no candidate record — account was deleted server-side
          if (_user && sourceCandidates.length === 0) {
            clearLocalAuth()
            setLoading(false)
            return
          }

          if (sourceCandidates.length === 0) {
            const fallbackCandidate = buildFallbackCandidate()
            if (fallbackCandidate) sourceCandidates = [fallbackCandidate]
          }

          setData({
            ...(result || {}),
            Jobs: sourceJobs,
            Candidates: sourceCandidates,
          } as JobSeekerData)
          useJobs({
            jobs: sourceJobs,
            candidates: sourceCandidates,
            applications: result?.Applications,
            contacts: result?.Contacts,
            cjPairings: result?.CandidateJobPairing,
            contactPairings: result?.ContactJobPairing,
          })
          return
        } catch (aggregateErr) {
          if (controller.signal.aborted) return
          // 401 = token expired or account deleted — clear auth and show landing
          if (String(aggregateErr).includes('401')) {
            clearLocalAuth()
            setLoading(false)
            return
          }
          console.warn('Aggregate fetch failed, trying split endpoints:', aggregateErr)
        }

        // Fallback: parallel endpoint calls
        try {
          const [jobs, candidates, applications, contacts, cjPairings, contactPairings] = await Promise.all([
            getJobs({ signal: controller.signal }),
            getCandidates({ signal: controller.signal }),
            getApplications({ signal: controller.signal }),
            getContacts({ signal: controller.signal }),
            getCandidateJobPairings({ signal: controller.signal }),
            getContactJobPairings({ signal: controller.signal }),
          ])

          let sourceCandidates = candidates?.length ? candidates : []

          if (_user?.email && sourceCandidates.length > 1) {
            const match = sourceCandidates.find((c: any) => (c.email || '').toLowerCase() === (_user.email || '').toLowerCase())
            if (match) sourceCandidates = [match]
          }

          if (sourceCandidates.length === 0) {
            const fallbackCandidate = buildFallbackCandidate()
            if (fallbackCandidate) {
              sourceCandidates = [fallbackCandidate]
            }
          }

          const merged: JobSeekerData = {
            Jobs: jobs?.length ? jobs : seedJobs,
            Candidates: sourceCandidates,
            Applications: applications || [],
            Contacts: contacts || [],
            CandidateJobPairing: cjPairings || [],
            ContactJobPairing: contactPairings || [],
          }
          setData(merged)
          useJobs({
            jobs: merged.Jobs,
            candidates: merged.Candidates,
            applications: merged.Applications,
            contacts: merged.Contacts,
            cjPairings: merged.CandidateJobPairing,
            contactPairings: merged.ContactJobPairing,
          })
          return
        } catch (endpointErr) {
          if (controller.signal.aborted) return
          console.warn('Endpoint fetch failed, using seeds:', endpointErr)
        }

        // Final fallback: seeds + mock
        const fallbackCandidate = buildFallbackCandidate()
        const fallbackCandidates = fallbackCandidate ? [fallbackCandidate] : []
        setData({
          Jobs: seedJobs,
          Candidates: fallbackCandidates,
          Applications: [],
          Contacts: [],
          CandidateJobPairing: [],
          ContactJobPairing: [],
        })
        useJobs({
          jobs: seedJobs,
          candidates: fallbackCandidates,
          applications: [],
          contacts: [],
          cjPairings: [],
          contactPairings: [],
        })
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setTransformedJobs(mockJobs)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    return () => controller.abort()
  }, [_user])

  const displayedJobId = selectedJobId ?? topVisibleJobId ?? (_token ? (transformedJobs[0]?.id ?? null) : (publicJobs[0]?.id ?? null))
  const handleSelectJob = useCallback((id: number | null, job?: any) => {
    setSelectedJobId(id)
    setSelectedJobRecord(id === null ? null : (job ?? null))
  }, [])
  const handleTopJobChange = useCallback((id: number | null, job?: any) => {
    setTopVisibleJobId(id)
    setTopVisibleJobRecord(id === null ? null : (job ?? null))
  }, [])

  const handleBottomNavigate = (page: BottomNavPage) => {
    if (page === 'messages') setUnseenAppCount(0)
    if (page === 'dashboard') setSelectedJobId(null)
    navigateTo(page)
  }

  // Menu dropdown component
  const menuItems = [
    { label: 'My Profile',      action: () => { setCurrentPage('profile'); setShowMenu(false) } },
    { label: 'Messages',        action: () => { setCurrentPage('messages'); setUnseenAppCount(0); setShowMenu(false) } },
    { label: 'Settings',        action: () => { setCurrentPage('settings'); setSettingsTab('personal'); setShowMenu(false) } },
    { label: 'Upgrade',         action: () => { setCurrentPage('plans'); setShowMenu(false) } },
    { label: 'Report a Bug',    action: () => { navigateTo('reportbug'); setShowMenu(false) } },
    { label: 'Join Our Team!',  action: () => { setCurrentPage('jointeam'); setShowMenu(false) } },
    { label: 'Sign Out',        action: () => {
      clearLocalAuth()
      setShowLogin(false)
      setShowMenu(false)
    }},
  ]

  // Shown in the mobile "More" sheet instead of menuItems when the visitor
  // isn't signed in — everything else in menuItems needs an account.
  const guestMenuItems = [
    { label: 'Sign In',        action: () => { setShowLogin(true); setShowMenu(false) } },
    { label: 'Create Account', action: () => { setShowSignup(true); setShowMenu(false) } },
    { label: 'Report a Bug',   action: () => { navigateTo('reportbug'); setShowMenu(false) } },
    { label: 'Join Our Team!', action: () => { setCurrentPage('jointeam'); setShowMenu(false) } },
  ]

  const MenuDropdown = () => (
    <div
      className="hidden lg:block absolute top-full right-0 mt-2 w-[210px] rounded-[14px] z-40 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.90)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(210,220,224,0.7)',
        boxShadow: '0 8px 32px rgba(48,103,112,0.13), 0 2px 8px rgba(0,0,0,0.07)',
      }}
    >
      {menuItems.map((item, i) => (
        <button
          key={item.label}
          onClick={item.action}
          className="w-full text-left px-5 py-[11px] text-[13px] font-medium group transition-all duration-200"
          style={{
            color: '#306770',
            fontFamily: 'Manrope',
            borderTop: i > 0 ? '1px solid rgba(220,220,220,0.35)' : 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(48,103,112,0.06)'
            const span = e.currentTarget.querySelector('span') as HTMLElement | null
            if (span) span.style.transform = 'translateX(5px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            const span = e.currentTarget.querySelector('span') as HTMLElement | null
            if (span) span.style.transform = 'translateX(0)'
          }}
        >
          <span style={{ transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)', display: 'inline-block' }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  )

  // Same menuItems, presented as a bottom sheet for the BottomNav's "More"
  // button on phone widths — MenuDropdown above stays desktop/tablet-only.
  const MobileMoreSheet = () => (
    <div className="lg:hidden fixed inset-0 z-40" onClick={() => setShowMenu(false)}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />
      <div
        className="absolute left-3 right-3 rounded-[16px] overflow-hidden safe-area-bottom"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(210,220,224,0.7)',
          boxShadow: '0 8px 32px rgba(48,103,112,0.13), 0 2px 8px rgba(0,0,0,0.07)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(_token ? menuItems : guestMenuItems).map((item, i) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full text-left px-5 py-3 text-[14px] font-medium"
            style={{
              color: '#306770',
              fontFamily: 'Manrope',
              borderTop: i > 0 ? '1px solid rgba(220,220,220,0.35)' : 'none',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )

  // Marketing landing page — always shown at /landing regardless of auth state
  if (showLandingPage) {
    return (
      <Suspense fallback={suspenseFallback}>
        <LandingPage
          onSignIn={() => {
            setShowLandingPage(false)
            setShowLogin(true)
            window.history.pushState({}, '', '/?login=true')
          }}
          onSignUp={() => {
            setShowLandingPage(false)
            setShowSignup(true)
            window.history.pushState({}, '', '/?signup=true')
          }}
        />
      </Suspense>
    )
  }

  // Plans page accessible to unauthenticated users
  if (!_token && showPlans && !showLogin && !showSignup) {
    return (
      <PlansPage
        onBack={() => setShowPlans(false)}
        onSignUp={() => { setShowPlans(false); setShowSignup(true) }}
        onSignIn={() => { setShowPlans(false); setShowLogin(true) }}
      />
    )
  }

  if (showSignup) {
    return (
      <Suspense fallback={suspenseFallback}>
        <SignupPage
          onSignup={(userData, authToken) => {
            setUser(userData)
            setToken(authToken)
            setShowSignup(false)
            setShowLogin(false)
            if (window.location.search.includes('signup=true')) {
              window.history.replaceState({}, '', window.location.pathname)
            }
          }}
          onSignIn={() => { setShowSignup(false); setShowLogin(true) }}
          onBackToLanding={() => setShowSignup(false)}
        />
      </Suspense>
    )
  }

  // Show login / forgot-password pages
  if (showLogin) {
    if (showForgotPassword) {
      return (
        <Suspense fallback={suspenseFallback}>
          <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />
        </Suspense>
      )
    }
    return (
      <Suspense fallback={suspenseFallback}>
        <LoginPage
          onLogin={(userData, authToken) => {
            setUser(userData)
            setToken(authToken)
            setShowLogin(false)
            if (window.location.search.includes('login=true')) {
              window.history.replaceState({}, '', window.location.pathname)
            }
          }}
          onForgotPassword={() => setShowForgotPassword(true)}
          onBackToLanding={() => setShowLogin(false)}
          onCreateAccount={() => { setShowLogin(false); setShowSignup(true) }}
        />
      </Suspense>
    )
  }

  // Render different pages
  if (currentPage === 'settings') {
    return <>
      <SettingsPage onBack={() => setCurrentPage('dashboard')} currentPage={settingsTab} onPageChange={setSettingsTab} data={safeData} onCandidateUpdate={handleCandidateUpdate} onDeleteAccount={handleDeleteAccount} onSaved={refreshPairings} />
      <div className="lg:hidden h-20" />
      <BottomNav active="more" unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  if (currentPage === 'reportbug') {
    return <>
      <ReportBugPage onBack={navigateBack} userEmail={_user?.email} />
      <div className="lg:hidden h-20" />
      <BottomNav active="more" unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  if (currentPage === 'jointeam') {
    return <>
      <JoinTeamPage onBack={() => setCurrentPage('dashboard')} />
      <div className="lg:hidden h-20" />
      <BottomNav active="more" unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  if (currentPage === 'privacy') {
    return <>
      <PrivacyPolicyPage onBack={navigateBack} />
      <div className="lg:hidden h-20" />
      <BottomNav active="more" unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  if (currentPage === 'terms') {
    return <>
      <TermsOfServicePage onBack={navigateBack} />
      <div className="lg:hidden h-20" />
      <BottomNav active="more" unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  if (currentPage === 'plans') {
    return <>
      <PlansPage onBack={() => setCurrentPage('dashboard')} userEmail={_user?.email} />
      <div className="lg:hidden h-20" />
      <BottomNav active={null} unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  if (currentPage === 'profile') {
    const backendCandidate = safeData?.Candidates?.[0] as any
    const localFallback = buildFallbackCandidate() as any
    const storedImage = localStorage.getItem('wanderworkProfileImage')
    const backendTargetRoles = asTextList(backendCandidate?.targetRoles)
    const backendSkills = asTextList(backendCandidate?.skills)
    const backendLocation = asArray(backendCandidate?.location)
    const backendUrls = asArray(backendCandidate?.urls)
    const profileCandidate = backendCandidate ? {
      ...backendCandidate,
      targetRoles: backendTargetRoles.length ? backendTargetRoles : (localFallback?.targetRoles || []),
      skills: backendSkills.length ? backendSkills : (localFallback?.skills || []),
      location: backendLocation.length ? backendLocation : (localFallback?.location || []),
      urls: backendUrls.length ? backendUrls : (localFallback?.urls || []),
      phone: backendCandidate.phone || localFallback?.phone || '',
      profileImage: backendCandidate.profileImage || storedImage || undefined,
    } : (localFallback || (_user ? {
        _id: _user._id || _user.id || '',
        firstName: (_user.displayName || _user.email || '').split(' ')[0] || '',
        lastName: (_user.displayName || '').split(' ').slice(1).join(' ') || '',
        email: _user.email || '',
        phone: '', location: [], targetRoles: [], seniority: [],
        skills: [], urls: [], resume: {}, status: 'active',
        paidUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
      } : null))
    return <>
      <ProfilePage candidate={profileCandidate} onBack={() => setCurrentPage('dashboard')} onCandidateUpdate={handleCandidateUpdate} onSaved={refreshPairings} />
      <div className="lg:hidden h-20" />
      <BottomNav active="profile" unseenCount={unseenAppCount} onNavigate={handleBottomNavigate} onOpenRecruiters={() => setShowRecruiterNavModal(true)} onOpenMore={() => setShowMenu(true)} isGuest={!_token} onRequireAuth={() => setShowLogin(true)} />
      {showMenu && <MobileMoreSheet />}
    </>
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145.48deg, #F9FAFB 0%, #F0F2F5 100%)', backgroundAttachment: 'fixed' }}>
      {oauthError && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, maxWidth: 480, width: 'calc(100% - 40px)', background: '#1A1A2E', color: '#fff', borderRadius: 12, padding: '14px 20px', fontSize: 13, fontFamily: 'Manrope', lineHeight: 1.5, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ color: '#F87171', flexShrink: 0, marginTop: 1 }}>!</span>
          <span>{oauthError}</span>
          <button onClick={() => setOauthError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0, flexShrink: 0, fontSize: 16, lineHeight: 1 }}>x</button>
        </div>
      )}
      {tokenClaimNotice && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, maxWidth: 480, width: 'calc(100% - 40px)', background: tokenClaimNotice.success ? '#306770' : '#1A1A2E', color: '#fff', borderRadius: 12, padding: '14px 20px', fontSize: 13, fontFamily: 'Manrope', lineHeight: 1.5, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flexShrink: 0, fontSize: 18 }}>{tokenClaimNotice.success ? '✨' : '!'}</span>
          <span>{tokenClaimNotice.text}</span>
          <button onClick={() => setTokenClaimNotice(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, flexShrink: 0, fontSize: 18, lineHeight: 1, opacity: 0.7 }}>x</button>
        </div>
      )}
      {showWelcomeModal && _token && (
        <WelcomeModal onClose={dismissWelcomeModal} />
      )}

      {/* Full-width sticky header */}
      <div className="sticky top-0 z-50 w-full safe-area-top" style={{ background: 'rgba(249,250,251,0.82)', backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)', borderBottom: '1px solid rgba(220,224,230,0.8)' }}>
        <header className="max-w-[1460px] mx-auto px-4 sm:px-6 flex items-center justify-between py-4">
          <h1 className="font-bold text-[16px] sm:text-[24px] tracking-[1.6px] sm:tracking-[3.6px] shrink-0" style={{ color: '#306770', fontFamily: 'Manrope' }}>
            {logoText.length <= 6 ? logoText : 'WANDER'}
            {logoText.length >= 7 && <span style={{ opacity: 0.45 }}>/</span>}
            {logoText.length > 7 ? logoText.slice(7) : ''}
          </h1>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {!_token ? (
              <>
                <button
                  onClick={() => setShowLogin(true)}
                  style={{ fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, color: '#306770', background: 'transparent', border: '2px solid #306770', cursor: 'pointer', fontFamily: 'Manrope', whiteSpace: 'nowrap' }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowSignup(true)}
                  style={{ fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, color: 'white', background: '#306770', border: 'none', cursor: 'pointer', fontFamily: 'Manrope', whiteSpace: 'nowrap' }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                {/* Auto Apply — active button, coming soon label only inside the drawer */}
                <div className="relative" data-auto-apply-anchor>
                  <button
                    ref={autoApplyBtnRef}
                    onClick={() => setShowAutoApplyPopover(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all duration-200"
                    style={{ border: '1px solid #C8DEDE', color: '#306770', background: 'transparent', cursor: 'pointer' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6F7' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    title="Auto Apply"
                  >
                    <Zap size={13} />
                    <span className="hidden sm:inline">Auto Apply</span>
                  </button>
                  {showAutoApplyPopover && (
                    <div
                      className="absolute right-0 z-50 mt-2 rounded-2xl overflow-hidden"
                      style={{ width: 308, top: '100%', background: '#fff', border: '1px solid rgba(48,103,112,0.1)', boxShadow: '0 24px 64px rgba(48,103,112,0.18), 0 4px 16px rgba(0,0,0,0.06)' }}
                    >
                      {/* Hero */}
                      <div style={{ background: 'linear-gradient(135deg, #112e33 0%, #1e5560 55%, #306770 100%)', padding: '20px 20px 18px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                        <div style={{ position: 'absolute', bottom: -14, left: 30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
                        <div className="flex items-center gap-2" style={{ marginBottom: 10, position: 'relative' }}>
                          <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 8, padding: '5px 6px', display: 'flex' }}>
                            <Zap size={15} color="#fff" fill="#fff" />
                          </div>
                          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', fontFamily: 'Manrope, sans-serif' }}>Auto Apply</span>
                        </div>
                        <p style={{ color: 'rgba(180,215,220,0.88)', fontSize: 12, margin: 0, lineHeight: 1.6, position: 'relative' }}>
                          Apply to jobs in seconds with your Wanderwork profile. No retyping, no tab switching.
                        </p>
                      </div>

                      {/* Features */}
                      <div style={{ padding: '16px 18px 4px' }}>
                        {([
                          { icon: <Zap size={12} />, bg: '#EEF6F7', color: '#306770', label: 'One-click autofill on Greenhouse, Lever, Ashby and more' },
                          { icon: <Sparkles size={12} />, bg: '#F3EEFF', color: '#7B5EA7', label: 'AI tailors your resume and cover letter per job' },
                          { icon: <Briefcase size={12} />, bg: '#FFF4EE', color: '#B06A1A', label: 'Track every application automatically as you go' },
                        ] as { icon: React.ReactNode; bg: string; color: string; label: string }[]).map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11 }}>
                            <div style={{ background: f.bg, color: f.color, borderRadius: 7, padding: '5px 6px', display: 'flex', flexShrink: 0, marginTop: 1 }}>
                              {f.icon}
                            </div>
                            <p style={{ fontSize: 12, color: '#4a4a4a', margin: 0, lineHeight: 1.55 }}>{f.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <div style={{ padding: '4px 18px 18px' }}>
                        <div style={{ borderTop: '1px solid #F0F2F4', paddingTop: 14 }}>
                          <a
                            href="https://chromewebstore.google.com/detail/wanderwork-autofill/iddgmiajobadogdnjdmhfdecbfkfhjfi"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', width: '100%', padding: '10px 0', background: 'linear-gradient(135deg, #1a3d42, #306770)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.2px', fontFamily: 'Manrope, sans-serif', textAlign: 'center', textDecoration: 'none' }}
                          >
                            Get the Chrome Extension
                          </a>
                          <p style={{ textAlign: 'center', fontSize: 11, color: '#b0b8bb', margin: '8px 0 0', fontFamily: 'Manrope, sans-serif' }}>Free on the Chrome Web Store</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowRecruiterNavModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all duration-200"
                  style={{ border: '1px solid #C8DEDE', color: '#306770' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6F7' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  title="Contact Recruiters"
                >
                  <Users size={13} />
                  <span className="hidden sm:inline">Contact Recruiters</span>
                </button>
                <button
                  className="relative"
                  onClick={() => { setCurrentPage('messages'); setUnseenAppCount(0) }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  title="Messages"
                >
                  <div className="w-[31px] h-[31px] rounded-full overflow-hidden flex items-center justify-center text-[11px] font-semibold" style={{ background: '#EEF6F7', color: '#306770', fontFamily: 'Manrope' }}>
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(`${safeData.Candidates[0]?.firstName || ''} ${safeData.Candidates[0]?.lastName || ''}`.trim() || _user?.displayName || _user?.email || 'User')
                    )}
                  </div>
                  {unseenAppCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-bold text-white pointer-events-none" style={{ background: '#36BF8F', fontFamily: 'Manrope' }}>
                      {unseenAppCount > 9 ? '9+' : unseenAppCount}
                    </span>
                  )}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    onMouseEnter={() => setHamburgerHovered(true)}
                    onMouseLeave={() => setHamburgerHovered(false)}
                    className="p-2 rounded-full transition-all duration-300 hover:bg-[#306770]/10"
                  >
                    <svg width="16" height="13" viewBox="0 0 50 42" fill="none">
                      <rect width="50" height="6" rx="3" fill={hamburgerHovered || showMenu ? '#306770' : '#AAAAAA'} style={{ transition: 'fill 0.3s ease' }}/>
                      <rect y="18" width="50" height="6" rx="3" fill={hamburgerHovered || showMenu ? '#306770' : '#AAAAAA'} style={{ transition: 'fill 0.3s ease' }}/>
                      <rect y="36" width="50" height="6" rx="3" fill={hamburgerHovered || showMenu ? '#306770' : '#AAAAAA'} style={{ transition: 'fill 0.3s ease' }}/>
                    </svg>
                  </button>
                  {showMenu && <MenuDropdown />}
                </div>
              </>
            )}
          </div>
        </header>
      </div>

      {showRecruiterNavModal && safeData?.Candidates?.[0]?._id && (
        <RecruiterOutreach
          candidateId={safeData.Candidates[0]._id}
          currentTokens={safeData.Candidates[0]?.tokenBalance ?? safeData.Candidates[0]?.creditsBalance ?? 0}
          dailyLimit={safeData.Candidates[0]?.recruiterContactsLeft ?? 10}
          onClose={() => setShowRecruiterNavModal(false)}
          onTokensChanged={() => {}}
        />
      )}

      <div className="max-w-[1460px] mx-auto p-4 sm:p-6 md:h-[calc(100vh-65px)] md:overflow-hidden md:flex md:flex-col">
        {/* Main Content */}
        {error && (
          <div className="p-4 rounded-lg bg-red-100 text-red-700 mb-4">
            Error loading data: {error}. Using fallback data.
          </div>
        )}
        
        {currentPage === 'messages' ? (
          <MessagesPage
            onBack={() => setCurrentPage('dashboard')}
            email={_user?.email || safeData.Candidates[0]?.email || ''}
            onGoToProfile={() => setCurrentPage('profile')}
            inline
          />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="animate-spin"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '4px solid #C8DDE0',
                borderTopColor: '#1e5560',
              }}
            />
            <p style={{ color: '#787878', fontFamily: 'Manrope', fontSize: 14 }}>Putting in Work</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 md:gap-3 xl:gap-5 md:flex-1 md:min-h-0">

            {/* Left panel: profile sidebar (auth) or particle sign-up panel (guest) */}
            {_token
              ? <Sidebar data={safeData} onProfileImageChange={setProfileImage} onCandidateUpdate={handleCandidateUpdate} />
              : <div className="hidden xl:flex xl:flex-col xl:w-[300px] 2xl:w-[320px] shrink-0 xl:h-full xl:min-h-0 xl:overflow-y-auto no-scrollbar">
                  <ParticleProfile onSignIn={() => setShowLogin(true)} onSignUp={() => setShowSignup(true)} />
                </div>
            }

            {/* Job Feed */}
            <div className="flex-1 md:flex-[1.65] xl:flex-[1.8] min-h-[60vh] md:min-h-0 md:overflow-hidden">
              <div className={selectedJobId !== null ? 'hidden md:block h-full' : 'block h-full'}>
                <JobFeed
                  onSelectJob={handleSelectJob}
                  selectedJobId={selectedJobId}
                  data={safeData}
                  jobs={_token ? transformedJobs : publicJobs}
                  showNewOnly={showNewOnly}
                  onToggleNewFilter={() => setShowNewOnly((v) => !v)}
                  loading={_token ? loading : publicJobsLoading}
                  isAuthenticated={!!_token}
                  onSearchJobs={searchJobsFromDatabase}
                  onSignIn={() => setShowLogin(true)}
                  onSignUp={() => setShowSignup(true)}
                  onTopJobChange={handleTopJobChange}
                  onRecruiterContactsClick={() => setShowRecruiterNavModal(true)}
                  onBuyCredits={() => setCurrentPage('plans')}
                />
              </div>

              {/* Mobile-only: full-screen job details with back button */}
              {selectedJobId !== null && (
                <div className="md:hidden flex flex-col" style={{ background: 'linear-gradient(145.48deg, #F9FAFB 0%, #F0F2F5 100%)' }}>
                  <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: '#DCDCDC' }}>
                    <button onClick={() => setSelectedJobId(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#306770" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h2 className="text-[18px] font-bold" style={{ color: '#306770', fontFamily: 'Manrope' }}>Job Details</h2>
                  </div>
                  <div className="p-4 pb-24">
                    <StatsPanel
                      jobId={selectedJobId}
                      selectedJob={selectedJobRecord}
                      onClose={() => setSelectedJobId(null)}
                      data={safeData}
                      jobs={_token ? transformedJobs : publicJobs}
                      onNewJobsClick={() => setShowNewOnly(true)}
                      onRecruiterContactsClick={() => setShowRecruiterNavModal(true)}
                      isAuthenticated={!!_token}
                      onSignUp={() => setShowSignup(true)}
                      autoOpenCoverLetterJobId={autoOpenCoverLetterJobId}
                      onAutoOpenCoverLetterHandled={() => setAutoOpenCoverLetterJobId(null)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right: Stats Panel */}
            <div id="stats-panel" className="hidden md:flex md:flex-col md:w-[320px] lg:w-[480px] xl:w-[520px] 2xl:w-[600px] md:shrink-0 md:h-full md:min-h-0 md:overflow-y-auto no-scrollbar md:pl-2 xl:pl-3">
              {displayedJobId !== null && (
                <StatsPanel
                  jobId={displayedJobId}
                  selectedJob={selectedJobId !== null ? selectedJobRecord : topVisibleJobRecord}
                  onClose={() => setSelectedJobId(null)}
                  data={safeData}
                  jobs={_token ? transformedJobs : publicJobs}
                  onNewJobsClick={() => setShowNewOnly(true)}
                  onRecruiterContactsClick={() => setShowRecruiterNavModal(true)}
                  isAuthenticated={!!_token}
                  onSignUp={() => setShowSignup(true)}
                  autoOpenCoverLetterJobId={autoOpenCoverLetterJobId}
                  onAutoOpenCoverLetterHandled={() => setAutoOpenCoverLetterJobId(null)}
                />
              )}
            </div>

          </div>
        )}
        {/* Footer */}
        <footer className="mt-10 border-t pt-6 md:hidden" style={{ borderColor: '#DCDCDC' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] sm:text-[13px]" style={{ color: '#787878', fontFamily: 'Manrope' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: '#306770', letterSpacing: '3px' }}>WANDER<span style={{ opacity: 0.45 }}>/</span>WORK</span>
              <span className="hidden sm:inline" aria-hidden="true">•</span>
              <span>Designing better job matches</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => navigateTo('privacy')} className="transition-colors hover:text-black">Privacy</button>
              <button onClick={() => navigateTo('terms')} className="transition-colors hover:text-black">Terms</button>
              <button className="transition-colors hover:text-black">Support</button>
            </div>
          </div>
        </footer>
        <div className="lg:hidden h-20" />
      </div>
      <BottomNav
        active={currentPage === 'messages' ? 'messages' : 'dashboard'}
        unseenCount={unseenAppCount}
        onNavigate={handleBottomNavigate}
        onOpenRecruiters={() => setShowRecruiterNavModal(true)}
        onOpenMore={() => setShowMenu(true)}
        isGuest={!_token}
        onRequireAuth={() => setShowLogin(true)}
      />
      {showMenu && <MobileMoreSheet />}
    </div>
  )
}

function WelcomeModal({ onClose }: { onClose: () => void }) {
  const features = [
    {
      icon: <Briefcase size={18} />,
      title: 'Matched jobs',
      text: 'We compare your profile and resume to remote roles so the dashboard shows jobs that fit your skills.',
    },
    {
      icon: <Coins size={18} />,
      title: 'Tokens',
      text: 'Tokens power services like tailored resumes, cover letters, and recruiter outreach. Each request shows its cost before you use it.',
    },
    {
      icon: <MailPlus size={18} />,
      title: 'Contact a recruiter',
      text: 'This connects you with recruiters in your field and helps draft a targeted message using your profile.',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wanderwork-welcome-title"
    >
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-6 shadow-2xl sm:p-8" style={{ fontFamily: 'Manrope' }}>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF6F7] text-[#306770]">
          <Sparkles size={24} />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#306770]">Welcome to Wander/Work</p>
        <h2 id="wanderwork-welcome-title" className="text-2xl font-bold leading-tight text-[#1A1A2E] sm:text-3xl">
          You're in. Let's get started.
        </h2>
        <p className="mt-3 text-base font-semibold leading-7 text-[#306770]">
          Here is 20 tokens to get you started.
        </p>
        <div className="mt-6 grid gap-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex gap-3 rounded-xl border border-[#C8DEDE] bg-[#F7FBFB] p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#306770]">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1A1A2E]">{feature.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#5f6878]">{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-7 w-full rounded-xl bg-[#306770] px-5 py-3 text-base font-bold text-white shadow-lg transition hover:bg-[#245460]"
        >
          Get Started
        </button>
        <p className="mt-3 text-center text-xs font-medium text-[#7b8494]">Click anywhere to close.</p>
      </div>
    </div>
  )
}

export default App

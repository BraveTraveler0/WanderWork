import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import Sidebar from './components/Sidebar'
import RecruiterOutreach from './components/RecruiterOutreach'
import JobFeed from './components/JobFeed'
import StatsPanel from './components/StatsPanel'
import SettingsPage from './components/SettingsPage'
import LoginPage from './components/LoginPage'
import PrivacyPolicyPage from './components/PrivacyPolicyPage'
import TermsOfServicePage from './components/TermsOfServicePage'
import PlansPage from './components/PlansPage'
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

const isUnknownCompany = (value?: string) => {
  if (!value) return true
  return /^(unknown|n\/a|na|none|null|undefined|\-|tbd)$/i.test(value.trim())
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

const inferCompanyName = (company: string | undefined, description: string, url: string, title?: string) => {
  if (!isUnknownCompany(company)) return company?.trim() || ''
  const fromDescription = inferCompanyFromDescription(description, title)
  if (fromDescription) return fromDescription
  const fromUrl = inferCompanyFromUrl(url)
  if (fromUrl) return fromUrl
  return company?.trim() || 'Unknown'
}

// Transform backend job data to component format
function transformJob(job: Job, index: number) {
  const locationString = (() => {
    const locVal: any = (job as any).location
    if (Array.isArray(locVal)) {
      return locVal
        .map((loc: Location) => [loc?.city, loc?.state].filter(Boolean).join(', '))
        .filter(Boolean)
        .join(' / ')
    }
    if (typeof locVal === 'string') return locVal
    return 'Remote'
  })()

  const rawDate = (job as any).datePosted || (job as any).postedAt || (job as any).postedDate || (job as any).date_posted || null
  
  // Try parsing the date - handle various formats
  let parsedDate = null
  if (rawDate) {
    parsedDate = new Date(rawDate)
    // If invalid, try adding 'Z' for UTC
    if (isNaN(parsedDate.getTime()) && typeof rawDate === 'string') {
      parsedDate = new Date(rawDate + 'Z')
    }
    // Still invalid? Try as timestamp
    if (isNaN(parsedDate.getTime()) && !isNaN(Number(rawDate))) {
      parsedDate = new Date(Number(rawDate))
    }
  }
  
  if (parsedDate && isNaN(parsedDate.getTime())) parsedDate = null

  const dateStr = parsedDate ? parsedDate.toISOString() : null
  const daysAgo = parsedDate ? Math.floor((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)) : null

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

  const inferredCompany = inferCompanyName(job.company, description, (job as any).url || '', job.title)

  return {
    id: index + 1,
    backendId: job._id,
    title: job.title,
    company: inferredCompany,
    description,
    location: locationString,
    skills: (job as any).tags || (job as any).skills || [],
    hasNewBadge: daysAgo !== null && daysAgo <= 7,
    interested: false,
    showCoverLetter: false,
    postedAt: dateStr,
    salary: (job as any).salary,
    url: (job as any).url,
    jobType: (job as any).jobType || (job as any).type,
    job_code: (job as any).job_code || (job as any).code,
    rawDate: dateStr, // Use the parsed dateStr instead of original rawDate
  }
}

function App() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [data, setData] = useState<JobSeekerData | null>(null)
  const [transformedJobs, setTransformedJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewOnly, setShowNewOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'settings' | 'privacy' | 'terms' | 'plans' | 'accountsettings' | 'personal' | 'payment' | 'upgrade'>('dashboard')
  const [settingsTab, setSettingsTab] = useState<'account' | 'personal' | 'payment' | 'upgrade'>('personal')
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
  const [showRecruiterNavModal, setShowRecruiterNavModal] = useState(false)
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
  const [loggedOut, setLoggedOut] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('login') === 'true'
  })
  const buildFallbackCandidate = (): Candidate | null => {
    if (!_user?.email) return null
    const storedProfileRaw = getMigratedStorageItem('wanderworkProfile', ['wanderHireProfile'])
    let storedProfile: any = null
    if (storedProfileRaw) {
      try {
        storedProfile = JSON.parse(storedProfileRaw)
      } catch {
        storedProfile = null
      }
    }
    const displayName = _user.displayName || storedProfile?.name || _user.email
    const nameParts = String(displayName || '').trim().split(' ')
    const firstName = nameParts[0] || 'User'
    const lastName = nameParts.slice(1).join(' ') || ''
    return {
      _id: _user._id || _user.id,
      email: _user.email,
      firstName,
      lastName,
      phone: storedProfile?.phone || '',
      location: storedProfile?.location ? [{ locationName: storedProfile.location, city: storedProfile.location }] : [],
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
      resumeLink: storedProfile?.resume,
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
      hasNewBadge: false,
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
      hasNewBadge: false,
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
      hasNewBadge: false,
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
      console.log('useJobs called with:', payload.jobs.length, 'jobs')
      if (payload.jobs.length > 0) {
        const raw = payload.jobs[0] as any
        console.log('Sample raw job fields:', {
          title: raw?.title,
          company: raw?.company,
          description: raw?.description,
          shortDescription: raw?.shortDescription,
          jobDescription: raw?.jobDescription,
          summary: raw?.summary,
          datePosted: raw?.datePosted,
          postedAt: raw?.postedAt,
          preparedAt: raw?.preparedAt,
          createdAt: raw?.createdAt,
        })
      }

      const jobsMapped = payload.jobs.map((job, index) => transformJob(job as Job, index))
      console.log('Transformed jobs:', jobsMapped.length)
      if (jobsMapped.length > 0) {
        const sample = jobsMapped[0]
        console.log('Sample job after transform:', {
          id: sample.id,
          title: sample.title,
          company: sample.company,
          descriptionPreview: (sample.description || '').slice(0, 200),
          descriptionLength: sample.description?.length ?? 0,
          postedAt: sample.postedAt,
          rawDate: (sample as any).rawDate,
        })
      }
      
      // Debug: Check first few jobs' date fields
      if (jobsMapped.length > 0) {
        console.log('Sample backend job dates:', jobsMapped.slice(0, 3).map((j: any) => ({
          postedAt: j.postedAt,
          rawDate: j.rawDate
        })))
      }
      
      setTransformedJobs(jobsMapped.length > 0 ? jobsMapped : mockJobs)
      setData({
        Applications: payload.applications || [],
        Contacts: payload.contacts || [],
        CandidateJobPairing: payload.cjPairings || [],
        ContactJobPairing: payload.contactPairings || [],
        Jobs: payload.jobs,
        Candidates: payload.candidates,
      })
      // Only auto-select on desktop (lg breakpoint = 1024px+)
      if (jobsMapped.length > 0 && window.innerWidth >= 1024) {
        setSelectedJobId((current) => current ?? jobsMapped[0].id)
      }
    }

    const fetchData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        // Check if we have a logged-in user
        let userCandidate = null
        if (_user?.email) {
          try {
            console.log('Fetching candidate data for logged-in user:', _user.email)
            const candidates = await getCandidates({ signal: controller.signal })
            if (candidates && candidates.length > 0) {
              // Find the candidate matching the logged-in user's email
              userCandidate = candidates.find((c: any) => c.email === _user.email)
              if (!userCandidate) {
                userCandidate = candidates[0] // Use first candidate as fallback
              }
              console.log('Found user candidate:', userCandidate?.email)
            }
          } catch (err) {
            console.warn('Failed to fetch user candidate:', err)
          }
        }

        // Preferred: single aggregate call
        try {
          console.log('Fetching data from /jobseeker/...')
          const result = await getAllJobSeekerData({ signal: controller.signal })
          console.log('Fetch result:', result?.Jobs?.length, 'jobs,', result?.Candidates?.length, 'candidates')
          const sourceJobs = result?.Jobs?.length ? result.Jobs : seedJobs
          let sourceCandidates = result?.Candidates?.length ? result.Candidates : []
          
          // Use logged-in user's candidate if available
          if (userCandidate) {
            sourceCandidates = [userCandidate]
          }
          if (sourceCandidates.length === 0) {
            const fallbackCandidate = buildFallbackCandidate()
            if (fallbackCandidate) {
              sourceCandidates = [fallbackCandidate]
            }
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
          
          // Use logged-in user's candidate if available
          if (userCandidate) {
            sourceCandidates = [userCandidate]
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
        const fallbackCandidate = userCandidate || buildFallbackCandidate()
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

  const displayedJobId = selectedJobId ?? (transformedJobs[0]?.id ?? null)

  // Menu dropdown component
  const menuItems = [
    { label: 'Settings',        action: () => { setCurrentPage('settings'); setSettingsTab('personal'); setShowMenu(false) } },
    { label: 'Upgrade',         action: () => { setCurrentPage('plans'); setShowMenu(false) } },
    { label: 'Privacy Policy',  action: () => { setCurrentPage('privacy'); setShowMenu(false) } },
    { label: 'Terms of Service',action: () => { setCurrentPage('terms'); setShowMenu(false) } },
    { label: 'Sign Out',        action: () => {
      localStorage.removeItem('wanderworkToken')
      localStorage.removeItem('wanderworkUser')
      setUser(null)
      setToken(null)
      setLoggedOut(true)
      setShowMenu(false)
    }},
  ]

  const MenuDropdown = () => (
    <div
      className="absolute top-full right-0 mt-2 w-[210px] rounded-[14px] z-40 overflow-hidden"
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

  // Show login page only when user explicitly logs out
  if (loggedOut) {
    return <LoginPage onLogin={(userData, authToken) => {
      setUser(userData)
      setToken(authToken)
      setLoggedOut(false)
      if (window.location.search.includes('login=true')) {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }} />
  }

  // Render different pages
  if (currentPage === 'settings') {
    return <SettingsPage onBack={() => setCurrentPage('dashboard')} currentPage={settingsTab} onPageChange={setSettingsTab} data={safeData} onCandidateUpdate={handleCandidateUpdate} />
  }

  if (currentPage === 'privacy') {
    return <PrivacyPolicyPage onBack={() => setCurrentPage('dashboard')} />
  }

  if (currentPage === 'terms') {
    return <TermsOfServicePage onBack={() => setCurrentPage('dashboard')} />
  }

  if (currentPage === 'plans') {
    return <PlansPage />
  }

  console.log('About to render main dashboard, loading:', loading, 'data:', !!data, 'transformedJobs:', transformedJobs.length)

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145.48deg, #F9FAFB 0%, #F0F2F5 100%)', backgroundAttachment: 'fixed' }}>
      {/* Full-width sticky header */}
      <div className="sticky top-0 z-50 w-full" style={{ background: 'rgba(249,250,251,0.82)', backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)', borderBottom: '1px solid rgba(220,224,230,0.8)' }}>
        <header className="max-w-[1460px] mx-auto px-4 sm:px-6 flex items-center justify-between py-4">
          <h1 className="font-bold text-[24px]" style={{ color: '#306770', fontFamily: 'Manrope', letterSpacing: '3.6px' }}>
            {logoText.length <= 6 ? logoText : 'WANDER'}
            {logoText.length >= 7 && <span style={{ opacity: 0.45 }}>/</span>}
            {logoText.length > 7 ? logoText.slice(7) : ''}
          </h1>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-[31px] h-[31px] rounded-full overflow-hidden border border-[#DCDCDC] bg-gray-200 flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-white/70" />
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
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                onMouseEnter={() => setHamburgerHovered(true)}
                onMouseLeave={() => setHamburgerHovered(false)}
                className="p-2 rounded-lg transition-all duration-300 hover:bg-[#306770]/10"
              >
                <svg width="32" height="27" viewBox="0 0 50 42" fill="none">
                  <rect width="50" height="6" rx="3" fill={hamburgerHovered || showMenu ? '#306770' : '#AAAAAA'} style={{ transition: 'fill 0.3s ease' }}/>
                  <rect y="18" width="50" height="6" rx="3" fill={hamburgerHovered || showMenu ? '#306770' : '#AAAAAA'} style={{ transition: 'fill 0.3s ease' }}/>
                  <rect y="36" width="50" height="6" rx="3" fill={hamburgerHovered || showMenu ? '#306770' : '#AAAAAA'} style={{ transition: 'fill 0.3s ease' }}/>
                </svg>
              </button>
              {showMenu && <MenuDropdown />}
            </div>
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

      <div className="max-w-[1460px] mx-auto p-4 sm:p-6 lg:h-[calc(100vh-65px)] lg:overflow-hidden lg:flex lg:flex-col">
        {/* Main Content */}
        {error && (
          <div className="p-4 rounded-lg bg-red-100 text-red-700 mb-4">
            Error loading data: {error}. Using fallback data.
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p style={{ color: '#787878' }}>Loading your data...</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row xl:flex-row gap-4 lg:gap-3 xl:gap-5 lg:flex-1 lg:min-h-0">
            <Sidebar data={safeData} onProfileImageChange={setProfileImage} onCandidateUpdate={handleCandidateUpdate} />
            
            {/* Mobile: Show either job list or job details */}
            <div className="flex-1 lg:flex-[1.65] xl:flex-[1.8] overflow-hidden min-h-[60vh] lg:min-h-0">
              {/* Job Feed - hidden when job selected on mobile */}
              <div className={selectedJobId !== null ? 'hidden lg:block h-full' : 'block h-full'}>
                <JobFeed 
                  onSelectJob={setSelectedJobId} 
                  selectedJobId={selectedJobId} 
                  data={safeData} 
                  jobs={transformedJobs} 
                  showNewOnly={showNewOnly}
                  onToggleNewFilter={() => setShowNewOnly((v) => !v)}
                />
              </div>
              
              {/* Job Details - shown when selected on mobile */}
              {selectedJobId !== null && (
                <div className="lg:hidden flex flex-col h-full" style={{ background: 'linear-gradient(145.48deg, #F9FAFB 0%, #F0F2F5 100%)' }}>
                  {/* Mobile Header with Back Button */}
                  <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: '#DCDCDC' }}>
                    <button
                      onClick={() => setSelectedJobId(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#306770" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                    </button>
                    <h2 className="text-[18px] font-bold" style={{ color: '#306770', fontFamily: 'Manrope' }}>
                      Job Details
                    </h2>
                  </div>
                  
                  {/* Mobile Details */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <StatsPanel 
                      jobId={selectedJobId} 
                      onClose={() => setSelectedJobId(null)} 
                      data={safeData} 
                      jobs={transformedJobs}
                      onNewJobsClick={() => setShowNewOnly(true)}
                      onRecruiterContactsClick={() => setShowRecruiterNavModal(true)}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Desktop: Stats Panel */}
            <div className="hidden lg:flex lg:flex-col lg:w-[520px] xl:w-[540px] 2xl:w-[620px] lg:shrink-0 lg:h-full lg:min-h-0 lg:overflow-y-auto no-scrollbar">
              {displayedJobId !== null && (
                <StatsPanel
                  jobId={displayedJobId}
                  onClose={() => setSelectedJobId(null)}
                  data={safeData}
                  jobs={transformedJobs}
                  onNewJobsClick={() => setShowNewOnly(true)}
                  onRecruiterContactsClick={() => setShowRecruiterNavModal(true)}
                />
              )}
            </div>
          </div>
        )}
        {/* Footer */}
        <footer className="mt-10 border-t pt-6 lg:hidden" style={{ borderColor: '#DCDCDC' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] sm:text-[13px]" style={{ color: '#787878', fontFamily: 'Manrope' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: '#306770', letterSpacing: '3px' }}>WANDER<span style={{ opacity: 0.45 }}>/</span>WORK</span>
              <span className="hidden sm:inline" aria-hidden="true">•</span>
              <span>Designing better job matches</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage('privacy')} className="transition-colors hover:text-black">Privacy</button>
              <button onClick={() => setCurrentPage('terms')} className="transition-colors hover:text-black">Terms</button>
              <button className="transition-colors hover:text-black">Support</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App

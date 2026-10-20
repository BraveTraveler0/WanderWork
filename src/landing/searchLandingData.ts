// Data helpers for the search-first landing page: turn raw public feed jobs into
// scannable rows (who can apply, salary, age) and filter them client-side.

export interface LandingJob {
  id: string
  title: string
  company: string
  summary: string
  location: string
  eligibility: string[]
  worldwide: boolean
  salaryText: string | null
  salaryAnnual: number | null
  jobType: string
  postedAt: Date | null
  applyUrl: string
  skills: string[]
  slug: string
  // The feed record as received, for components shared with the dashboard.
  raw: any
}

const JUNK_SALARY = /^(not listed|unlisted|competitive|tbd|negotiable|n\/a|see below|varies|open|flexible)$/i

// Regions are matched against the title, location and the opening of the
// summary, where postings usually state who can apply.
const REGIONS: { label: string; re: RegExp }[] = [
  // Case-sensitive on purpose so the pronoun "us" never counts.
  { label: 'US only', re: /\bU\.S\.(?:A\.?)?|\bUSA\b|United States|\bUS[- ](?:[Oo]nly|[Bb]ased|[Rr]emote)\b|\b[Rr]emote[\s,–—(-]+US\b|\(US\)|\bUS\b(?=\s*(?:\)|$|\/|,))/ },
  { label: 'Canada', re: /\bCanada\b|\bCanadian\b/i },
  { label: 'UK', re: /\bUK\b|United Kingdom/ },
  { label: 'Europe', re: /\bEurope\b|\bEU\b|\bEMEA\b|European/ },
  { label: 'LATAM', re: /\bLATAM\b|Latin America|South America/i },
  { label: 'APAC', re: /\bAPAC\b|Asia[- ]Pacific/i },
  { label: 'Philippines', re: /Philippines/i },
  { label: 'India', re: /\bIndia\b/i },
  { label: 'Australia', re: /Australia/i },
  { label: 'Americas', re: /\bAmericas\b|North America/i },
]
const WORLDWIDE = /\bworldwide\b|\banywhere\b|\bglobal(?:ly)? remote\b|work from anywhere|\bglobal\b(?= team| role| position)/i

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Postings often open with ATS metadata ("Requisition #: 20523 Functional
// Area: ... #LI-Remote") and repeat the job title before the real text. Strip
// that so the summary reads as prose.
const META_LABEL = /\b(?:Requisition(?: #| ID| Number)?|Req(?:uisition)? ?ID|Job (?:ID|Code|Number|Type|Family|Category)|Functional Area|Department|Employment Type|Position Type|Work Options|Work Location|Work Arrangement|Work Hours|Work Schedule|Schedule|Shift|Location(?:s)?|Travel|Pay Range|Salary Range|Compensation|Category|Reports To|Team)\s*#?\s*:/gi
const LEADING_HEADING = /^(?:About (?:the|this) (?:role|job|position|opportunity|team|company)|About us|Job Description|Position Summary|Role Summary|Job Summary|Overview|Summary|Description|The Role)\s*:?\s+/i

export function cleanSummary(text: string, title = ''): string {
  let s = text.replace(/#(?:LI|BI|IND|ZR)-[\w-]+/gi, ' ').replace(/\s+/g, ' ').trim()
  const head = s.slice(0, 600)
  const labels = Array.from(head.matchAll(META_LABEL))
  if (labels.length >= 2) {
    const last = labels[labels.length - 1]
    const after = (last.index ?? 0) + last[0].length
    const rest = s.slice(after)
    const lower = rest.toLowerCase()
    const starts = [
      title ? lower.indexOf(title.toLowerCase()) : -1,
      rest.search(/\bAbout (?:the|us|our|[A-Z])/),
      rest.search(/\b(?:We are|We're|Our |As an? |In this role|You will|Join )/),
    ].filter((i) => i > 0)
    if (starts.length) s = rest.slice(Math.min(...starts)).trim()
  }
  if (title && s.toLowerCase().startsWith(title.toLowerCase())) s = s.slice(title.length).replace(/^[\s:,.\-–|]+/, '')
  s = s.replace(LEADING_HEADING, '')
  // "About Acme Acme is a ..." -> "Acme is a ..."
  s = s.replace(/^About (.{2,60}?) (?=\1\b)/, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (s && !/[.!?)"”]$/.test(s)) s += '…'
  return s
}

export function deriveEligibility(title: string, location: string, summary: string): { labels: string[]; worldwide: boolean } {
  const haystack = `${title} | ${location} | ${summary.slice(0, 400)}`
  const labels = REGIONS.filter((r) => r.re.test(haystack)).map((r) => r.label)
  const worldwide = labels.length === 0 && WORLDWIDE.test(haystack)
  if (worldwide) return { labels: ['Worldwide'], worldwide }
  if (labels.length) return { labels: labels.slice(0, 2), worldwide }
  // Fall back to the posted location when it says more than "Remote".
  const loc = location.replace(/\bremote\b[\s,:–-]*/i, '').trim()
  return { labels: loc ? [loc] : [], worldwide }
}

// Returns the top of the posted range as a yearly figure, or null.
export function annualSalary(text: string): number | null {
  const nums = Array.from(text.replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)\s*(k)?/gi))
    .map((m) => parseFloat(m[1]) * (m[2] ? 1000 : 1))
    .filter((n) => n > 0)
  if (!nums.length) return null
  const top = Math.max(...nums)
  if (/\/\s*h(ou)?r|per hour|hourly/i.test(text)) return top * 2080
  if (/\/\s*mo(nth)?|per month|monthly/i.test(text)) return top * 12
  if (top < 1000) return null
  return top
}

export function toLandingJob(raw: any): LandingJob | null {
  const id = cleanText(raw?._id)
  const title = cleanText(raw?.title || raw?.positionName)
  const company = cleanText(raw?.company)
  if (!id || !title || !company) return null
  const summary = cleanSummary(cleanText(raw?.description_short || raw?.shortDescription || raw?.description), title)
  const location = cleanText(typeof raw?.location === 'string' ? raw.location : '') || 'Remote'
  const salaryRaw = cleanText(raw?.salary)
  const hasSalary = !!salaryRaw && !JUNK_SALARY.test(salaryRaw) && /\d/.test(salaryRaw)
  const dateRaw = raw?.date_posted || raw?.datePosted || raw?.postedAt
  const date = dateRaw ? new Date(dateRaw) : null
  const { labels, worldwide } = deriveEligibility(title, location, summary)
  return {
    id,
    title,
    company,
    summary,
    location,
    eligibility: labels,
    worldwide,
    salaryText: hasSalary ? salaryRaw : null,
    salaryAnnual: hasSalary ? annualSalary(salaryRaw) : null,
    jobType: cleanText(raw?.job_type || raw?.jobType),
    postedAt: date && !Number.isNaN(date.getTime()) ? date : null,
    applyUrl: cleanText(raw?.apply_url || raw?.applyUrl || raw?.url),
    skills: (Array.isArray(raw?.tags) && raw.tags.length ? raw.tags : Array.isArray(raw?.skills) ? raw.skills : [])
      .map((s: unknown) => cleanText(s)).filter(Boolean).slice(0, 8),
    slug: `${slugPart(title)}-at-${slugPart(company)}-${id}`,
    raw,
  }
}

export function postedAgo(date: Date | null, now = Date.now()): string {
  if (!date) return ''
  const hours = Math.max(0, (now - date.getTime()) / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function isFresh(date: Date | null, now = Date.now()): boolean {
  return !!date && now - date.getTime() <= 3 * 86_400_000
}

export type QuickFilter = 'worldwide' | 'us' | 'salary80' | 'engineering' | 'design' | 'marketing' | 'support' | 'product'

export const QUICK_FILTERS: { key: QuickFilter; label: string; group: 'region' | 'pay' | 'field' }[] = [
  { key: 'worldwide', label: 'Worldwide', group: 'region' },
  { key: 'us', label: 'United States', group: 'region' },
  { key: 'salary80', label: '$80k+', group: 'pay' },
  { key: 'engineering', label: 'Engineering', group: 'field' },
  { key: 'design', label: 'Design', group: 'field' },
  { key: 'marketing', label: 'Marketing', group: 'field' },
  { key: 'product', label: 'Product', group: 'field' },
  { key: 'support', label: 'Customer support', group: 'field' },
]

const FIELD_RE: Record<string, RegExp> = {
  engineering: /engineer|developer|software|devops|frontend|front-end|backend|back-end|full[- ]?stack|data scien|machine learning|\bml\b|\bsre\b|programmer/i,
  design: /design|\bux\b|\bui\b|figma|illustrat|creative/i,
  marketing: /marketing|seo|content|growth|brand|social media|copywrit/i,
  product: /product manager|product owner|product lead|\bproduct\b/i,
  support: /support|customer success|customer service|customer experience|help ?desk/i,
}

export type JobTypeFilter = '' | 'full' | 'part' | 'contract'
export type PostedFilter = 0 | 1 | 3 | 7 | 30
export type SortKey = 'newest' | 'salary'

export interface LandingFilters {
  query: string
  quick: QuickFilter[]
  jobType: JobTypeFilter
  postedWithinDays: PostedFilter
  salaryOnly: boolean
  sort: SortKey
}

export function filterJobs(jobs: LandingJob[], f: LandingFilters, now = Date.now()): LandingJob[] {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  const regions = f.quick.filter((q) => q === 'worldwide' || q === 'us')
  const fields = f.quick.filter((q) => FIELD_RE[q])
  const out = jobs.filter((j) => {
    if (terms.length) {
      const text = `${j.title} ${j.company} ${j.skills.join(' ')} ${j.summary}`.toLowerCase()
      if (!terms.every((t) => text.includes(t))) return false
    }
    if (regions.length) {
      const ok = regions.some((r) => r === 'worldwide'
        ? j.worldwide
        : j.worldwide || j.eligibility.some((l) => l === 'US only' || l === 'Americas'))
      if (!ok) return false
    }
    if (fields.length && !fields.some((k) => FIELD_RE[k].test(j.title))) return false
    if (f.quick.includes('salary80') && !(j.salaryAnnual && j.salaryAnnual >= 80_000)) return false
    if (f.salaryOnly && !j.salaryText) return false
    if (f.jobType) {
      const t = j.jobType.toLowerCase()
      if (f.jobType === 'full' && !/full/.test(t)) return false
      if (f.jobType === 'part' && !/part/.test(t)) return false
      if (f.jobType === 'contract' && !/contract|freelance|temporary/.test(t)) return false
    }
    if (f.postedWithinDays && (!j.postedAt || now - j.postedAt.getTime() > f.postedWithinDays * 86_400_000)) return false
    return true
  })
  if (f.sort === 'salary') return out.sort((a, b) => (b.salaryAnnual ?? -1) - (a.salaryAnnual ?? -1))
  out.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
  // Searching for a company should list all of its jobs together.
  return terms.length ? out : spreadCompanies(out)
}

// Feeds import a company's openings in one batch, so newest-first can fill the
// top of the page with one employer. Hold a company's next job back until
// `gap` other jobs have been shown, keeping the order otherwise.
export function spreadCompanies(jobs: LandingJob[], gap = 4): LandingJob[] {
  const out: LandingJob[] = []
  const waiting = [...jobs]
  const lastSeen = new Map<string, number>()
  while (waiting.length) {
    let idx = waiting.findIndex((j) => {
      const seen = lastSeen.get(j.company.toLowerCase())
      return seen === undefined || out.length - seen > gap
    })
    if (idx === -1) idx = 0
    const [job] = waiting.splice(idx, 1)
    lastSeen.set(job.company.toLowerCase(), out.length)
    out.push(job)
  }
  return out
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

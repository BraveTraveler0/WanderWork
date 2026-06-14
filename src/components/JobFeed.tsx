import { Trash2, Filter, X, RotateCcw, Sparkles } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { submitCustomRequest, updateJobSeeker } from '../api/jobseeker.ts'
import CustomJobRequestModal, { type CustomJobRequestOptions } from './CustomJobRequestModal'
import { getJobDate, isNewJob, JOB_PURGE_DAYS, MS_PER_DAY } from '../utils/jobUtils'

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
    .replace(/(^|\n)\s{0,3}(\*\*|__)\s*(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|role\s+description|company\s+description|company|description)\s*:?\s*\2\s*:?\s*/gi, '$1')
    .replace(/(^|\n)\s{0,3}(\*|_)\s*(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|role\s+description|company\s+description|company|description)\s*:?\s*\2\s*:?\s*/gi, '$1')
    .replace(/(^|\n)\s{0,3}(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|about\s+the\s+company|about\s+our\s+company|role\s+description|company\s+description|company|description)\s*:?\s*/gi, '$1')
    // "About [Company Name]" — catches "About Gusto", "About Toptal", etc. on their own line
    .replace(/(^|\n)\s{0,3}about\s+[\w&.'-]{2,}(?:\s+[\w&.'-]{2,}){0,3}\s*:?\s*(?=\n|$)/gi, '$1')
    // Strip leading alphanumeric job/req codes like "CSQ327R46" — caps+digits mixed, standalone at start
    .replace(/^\s*[A-Z][A-Z0-9]*\d[A-Z0-9]*\s*\n/, '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/___([^_\n]+)___/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/\*\*/g, '')
    .trim()
}

const _addBreaks = (text: string): string => {
  const lines = text
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
    const formatted = _addBreaks(_stripMarkdown(_stripJunkMeta(_stripHtml(raw))))
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

function getJobTime(job: any): number {
  return getJobDate(job)?.getTime() ?? 0
}

const _normSearch = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

// ---------------------------------------------------------------------------
// Semantic search expansion — derived from the same 20-cluster role ontology
// used for candidate-job matching (server/services/matching/roleOntology.js).
//
// Cluster distance guide (mirroring RAW_DISTANCES):
//   d1 = very close, d2 = adjacent, d3 = stretch (selective crossovers only)
//   d4+ excluded — too weak to surface as "Related results"
//
// Values are phrases that appear in job TITLES or DESCRIPTIONS for the
// related cluster(s).  Exact matches always rank above these.
// ---------------------------------------------------------------------------
const SEARCH_EXPANSION: Record<string, string[]> = {

  // ── ux_design cluster ─────────────────────────────────────────────────────
  // d1: ui_visual, design_systems  |  d2: brand_creative, design_content, frontend
  ux: [
    // d1 → ui_visual
    'ui designer', 'visual designer', 'graphic designer', 'web designer', 'digital designer', 'brand designer',
    // d1 → design_systems
    'design systems', 'design engineer', 'ux engineer',
    // d2 → design_content
    'content designer', 'ux writer',
    // d2 → brand_creative
    'creative director', 'art director', 'motion designer',
    // d2 → frontend (the "frontend design" the user mentioned)
    'frontend engineer', 'frontend developer', 'ui engineer', 'web developer',
  ],
  'user experience': [
    'ui designer', 'visual designer', 'design systems', 'design engineer',
    'content designer', 'ux writer', 'frontend engineer', 'web developer',
  ],
  'product designer': [
    'ux designer', 'ui designer', 'visual designer', 'interaction designer',
    'design systems', 'design engineer', 'content designer', 'ux writer',
  ],
  'interaction design': [
    'ux designer', 'ui designer', 'product designer', 'design systems', 'design engineer', 'frontend engineer',
  ],
  'service design': [
    'ux designer', 'product designer', 'ui designer', 'design systems',
  ],

  // ── ui_visual cluster ─────────────────────────────────────────────────────
  // d1: ux_design, design_systems, brand_creative, frontend  |  d2: design_content, marketing
  ui: [
    // d1 → ux_design
    'ux designer', 'product designer', 'interaction designer',
    // d1 → design_systems
    'design systems', 'design engineer', 'ux engineer',
    // d1 → brand_creative
    'creative director', 'art director', 'illustrator',
    // d1 → frontend
    'frontend engineer', 'frontend developer', 'web developer', 'ui engineer',
    // d2 → design_content
    'content designer', 'ux writer',
    // d2 → marketing
    'brand manager', 'digital marketer',
  ],
  'visual designer': [
    'ui designer', 'graphic designer', 'brand designer', 'digital designer',
    'ux designer', 'product designer', 'design systems', 'art director', 'creative director',
    'motion designer', 'illustrator',
  ],
  'visual design': [
    'ui designer', 'graphic designer', 'brand designer', 'ux designer',
    'design systems', 'art director', 'creative director',
  ],
  'graphic designer': [
    'visual designer', 'ui designer', 'brand designer', 'art director',
    'creative director', 'illustrator', 'motion designer',
  ],
  'graphic design': [
    'visual design', 'ui design', 'brand design', 'art direction',
    'creative director', 'illustration', 'motion design',
  ],
  'web designer': [
    'frontend engineer', 'frontend developer', 'ui designer', 'visual designer',
    'ux designer', 'design systems',
  ],
  'brand designer': [
    'graphic designer', 'visual designer', 'art director', 'creative director',
    'brand manager', 'marketing manager',
  ],
  'digital designer': [
    'ui designer', 'visual designer', 'graphic designer', 'ux designer',
    'frontend engineer', 'motion designer',
  ],

  // ── design_systems cluster ────────────────────────────────────────────────
  // d1: ux_design, ui_visual, frontend  |  d2: brand_creative, design_content, fullstack  |  d3: backend
  'design systems': [
    // d1
    'ux designer', 'product designer', 'ui designer', 'visual designer',
    'frontend engineer', 'frontend developer', 'ui engineer',
    // d2
    'creative director', 'content designer', 'ux writer', 'fullstack engineer',
  ],
  'design engineer': [
    'frontend engineer', 'ux engineer', 'ui engineer', 'design systems',
    'ux designer', 'ui designer', 'fullstack engineer',
  ],
  'ux engineer': [
    'frontend engineer', 'design engineer', 'ui engineer', 'design systems',
    'ux designer', 'ui designer',
  ],

  // ── design_content cluster ────────────────────────────────────────────────
  // d2: ux_design, ui_visual, design_systems, brand_creative, content_writing  |  d3: marketing, product_mgmt
  'content designer': [
    'ux writer', 'ux designer', 'ui designer', 'design systems',
    'content writer', 'copywriter', 'technical writer', 'creative director',
  ],
  'ux writer': [
    'content designer', 'ux designer', 'content writer', 'copywriter',
    'technical writer', 'ui designer',
  ],
  'ux writing': [
    'content design', 'copywriting', 'technical writing', 'content strategy',
    'ux designer', 'content writer',
  ],

  // ── brand_creative cluster ────────────────────────────────────────────────
  // d1: ui_visual  |  d2: ux_design, design_systems, design_content, marketing  |  d3: content_writing, frontend
  'creative director': [
    'art director', 'visual designer', 'graphic designer', 'brand designer',
    'ux designer', 'product designer', 'design systems',
    'marketing manager', 'brand manager', 'content writer', 'copywriter',
  ],
  'art director': [
    'creative director', 'visual designer', 'graphic designer', 'brand designer',
    'marketing manager', 'content writer',
  ],
  'motion designer': [
    'animator', 'video editor', 'visual designer', 'graphic designer',
    'creative director', 'art director',
  ],
  'motion design': [
    'animation', 'video editing', 'visual design', 'graphic design',
    'creative director', 'art direction',
  ],
  animator: [
    'motion designer', 'video editor', 'illustrator', 'creative director', 'visual designer',
  ],
  illustrator: [
    'graphic designer', 'visual designer', 'art director', 'creative director', 'motion designer',
  ],
  'video editor': [
    'motion designer', 'animator', 'creative director', 'content creator',
  ],

  // ── platform cluster ──────────────────────────────────────────────────────
  // d2: backend, fullstack, data_ml  |  d3: mobile
  devops: [
    // d2 → backend/fullstack
    'software engineer', 'backend engineer', 'systems engineer', 'fullstack engineer',
    'site reliability', 'sre', 'platform engineer', 'infrastructure engineer', 'cloud engineer',
    // d2 → data_ml
    'data engineer', 'ml engineer',
  ],
  sre: [
    'site reliability engineer', 'devops', 'platform engineer', 'infrastructure engineer',
    'cloud engineer', 'software engineer', 'backend engineer',
  ],
  'site reliability': [
    'sre', 'devops', 'platform engineer', 'infrastructure engineer',
    'backend engineer', 'software engineer',
  ],
  'platform engineer': [
    'devops', 'infrastructure engineer', 'site reliability', 'cloud engineer',
    'backend engineer', 'systems engineer', 'fullstack engineer', 'data engineer',
  ],
  'infrastructure engineer': [
    'devops', 'platform engineer', 'cloud engineer', 'site reliability',
    'backend engineer', 'systems engineer', 'network engineer',
  ],
  infrastructure: [
    'devops', 'platform engineer', 'cloud engineer', 'site reliability', 'sre',
    'backend engineer', 'systems engineer', 'data engineer',
  ],
  'cloud engineer': [
    'devops', 'platform engineer', 'infrastructure engineer', 'site reliability',
    'backend engineer', 'data engineer',
  ],
  aws: [
    'devops', 'platform engineer', 'cloud engineer', 'infrastructure engineer',
    'backend engineer', 'data engineer',
  ],
  kubernetes: [
    'devops', 'platform engineer', 'site reliability', 'infrastructure engineer',
    'backend engineer',
  ],
  docker: [
    'devops', 'platform engineer', 'backend engineer', 'fullstack engineer',
    'infrastructure engineer',
  ],
  terraform: [
    'devops', 'platform engineer', 'infrastructure engineer', 'cloud engineer',
  ],

  // ── data_ml cluster ───────────────────────────────────────────────────────
  // d2: backend, platform, fullstack  |  d3: finance, frontend
  'data scientist': [
    // d2 → backend/platform
    'data engineer', 'ml engineer', 'machine learning engineer', 'ai engineer',
    'research scientist', 'backend engineer', 'software engineer',
    'platform engineer', 'fullstack engineer',
    // d3 → finance
    'quantitative analyst', 'quant', 'financial analyst',
  ],
  'data engineer': [
    'data scientist', 'ml engineer', 'analytics engineer', 'backend engineer',
    'software engineer', 'platform engineer', 'fullstack engineer',
  ],
  'machine learning': [
    'ml engineer', 'ai engineer', 'data scientist', 'research scientist',
    'backend engineer', 'software engineer', 'data engineer',
    // d3 → finance (quants)
    'quantitative analyst', 'quant',
  ],
  'machine learning engineer': [
    'ml engineer', 'ai engineer', 'data scientist', 'research scientist',
    'backend engineer', 'software engineer',
  ],
  'ml engineer': [
    'machine learning engineer', 'ai engineer', 'data scientist', 'research scientist',
    'data engineer', 'backend engineer', 'software engineer',
  ],
  'ai engineer': [
    'ml engineer', 'machine learning engineer', 'data scientist', 'research scientist',
    'backend engineer', 'software engineer', 'data engineer',
  ],
  'data science': [
    'machine learning', 'data engineering', 'analytics', 'ml engineer',
    'research scientist', 'backend engineer', 'software engineer',
    'quantitative analyst',
  ],
  'research scientist': [
    'data scientist', 'ml engineer', 'ai engineer', 'machine learning engineer',
    'backend engineer', 'software engineer',
  ],
  'analytics engineer': [
    'data engineer', 'data analyst', 'business intelligence', 'backend engineer',
    'data scientist',
  ],
  analytics: [
    'data analyst', 'business intelligence', 'data scientist', 'data engineer',
    'backend engineer', 'tableau', 'sql',
  ],
  'data analyst': [
    'analytics engineer', 'business intelligence', 'data scientist', 'financial analyst',
    'sql', 'tableau',
  ],
  'business intelligence': [
    'data analyst', 'analytics engineer', 'data scientist', 'financial analyst',
    'tableau', 'power bi', 'sql',
  ],
  llm: ['ai engineer', 'ml engineer', 'machine learning engineer', 'backend engineer', 'software engineer'],
  nlp: ['ml engineer', 'ai engineer', 'data scientist', 'machine learning engineer', 'backend engineer'],
  sql: ['data analyst', 'data engineer', 'analytics engineer', 'backend engineer', 'business intelligence'],

  // ── mobile cluster ────────────────────────────────────────────────────────
  // d2: frontend, fullstack, backend  |  d3: platform
  ios: [
    'android', 'mobile engineer', 'mobile developer', 'react native', 'flutter',
    'frontend engineer', 'frontend developer', 'software engineer', 'fullstack engineer',
  ],
  android: [
    'ios', 'mobile engineer', 'mobile developer', 'react native', 'flutter',
    'frontend engineer', 'frontend developer', 'software engineer', 'fullstack engineer',
    'java developer',
  ],
  'mobile engineer': [
    'ios engineer', 'android engineer', 'mobile developer', 'react native', 'flutter',
    'frontend engineer', 'fullstack engineer', 'software engineer',
  ],
  'mobile developer': [
    'ios developer', 'android developer', 'react native developer', 'flutter developer',
    'frontend developer', 'fullstack developer', 'software developer',
  ],
  'react native': [
    'ios', 'android', 'mobile engineer', 'flutter', 'frontend engineer',
    'javascript developer', 'fullstack engineer',
  ],
  flutter: [
    'ios', 'android', 'mobile engineer', 'react native', 'frontend engineer',
    'fullstack engineer',
  ],
  swift: ['ios', 'mobile engineer', 'ios developer', 'frontend engineer'],
  kotlin: ['android', 'mobile engineer', 'android developer', 'java developer', 'fullstack engineer'],

  // ── frontend cluster ──────────────────────────────────────────────────────
  // d1: design_systems, ui_visual, fullstack  |  d2: ux_design, mobile  |  d3: backend, brand_creative, technical_sales
  frontend: [
    // d1 → design_systems
    'design systems', 'design engineer', 'ux engineer',
    // d1 → ui_visual
    'ui designer', 'visual designer', 'web designer',
    // d1 → fullstack
    'fullstack engineer', 'fullstack developer', 'full stack engineer',
    // d2 → ux_design
    'ux designer', 'product designer',
    // d2 → mobile
    'mobile engineer', 'ios developer', 'android developer', 'react native',
  ],
  'front end': [
    'design systems', 'design engineer', 'ui designer', 'visual designer',
    'fullstack engineer', 'full stack engineer', 'ux designer', 'mobile engineer',
  ],
  'frontend engineer': [
    'fullstack engineer', 'software engineer', 'ui engineer', 'design systems',
    'design engineer', 'mobile engineer', 'web developer', 'react developer',
    'ux designer', 'ui designer',
  ],
  'frontend developer': [
    'fullstack developer', 'software developer', 'web developer',
    'javascript developer', 'react developer', 'ui engineer', 'design engineer',
    'mobile developer',
  ],
  'web developer': [
    'frontend engineer', 'fullstack engineer', 'javascript developer', 'react developer',
    'software engineer', 'ui engineer', 'design engineer',
  ],
  'ui engineer': [
    'frontend engineer', 'design engineer', 'design systems', 'ux engineer',
    'web developer', 'fullstack engineer',
  ],
  react: [
    'javascript', 'typescript', 'frontend engineer', 'frontend developer',
    'fullstack engineer', 'next js', 'web developer', 'ui engineer',
    'design systems', 'mobile engineer',
  ],
  'react developer': [
    'frontend engineer', 'frontend developer', 'javascript developer',
    'fullstack engineer', 'software engineer', 'web developer',
  ],
  javascript: [
    'typescript', 'react', 'frontend engineer', 'fullstack engineer',
    'node', 'web developer', 'backend engineer', 'mobile engineer',
  ],
  'javascript developer': [
    'frontend developer', 'react developer', 'typescript developer',
    'fullstack developer', 'software developer', 'web developer',
    'node developer', 'mobile developer',
  ],
  typescript: [
    'javascript', 'react', 'frontend engineer', 'fullstack engineer',
    'backend engineer', 'node', 'web developer',
  ],
  'typescript developer': [
    'javascript developer', 'react developer', 'frontend developer',
    'fullstack developer', 'backend developer', 'software developer',
  ],
  vue: ['react', 'angular', 'javascript', 'frontend engineer', 'fullstack engineer', 'web developer'],
  angular: ['react', 'vue', 'javascript', 'typescript', 'frontend engineer', 'fullstack engineer'],
  css: ['frontend engineer', 'web developer', 'ui engineer', 'design engineer', 'design systems', 'fullstack engineer'],
  html: ['frontend engineer', 'web developer', 'ui engineer', 'fullstack engineer'],
  'next js': ['react', 'javascript', 'typescript', 'frontend engineer', 'fullstack engineer', 'web developer'],
  svelte: ['react', 'vue', 'javascript', 'frontend engineer', 'fullstack engineer'],
  'creative technologist': ['frontend engineer', 'design engineer', 'ui engineer', 'motion designer'],
  figma: [
    // Figma in a job means design or frontend
    'ux designer', 'ui designer', 'product designer', 'design systems',
    'frontend engineer', 'design engineer',
  ],

  // ── fullstack cluster ─────────────────────────────────────────────────────
  // d1: frontend, backend  |  d2: design_systems, mobile, platform  |  d3: data_ml, technical_sales
  fullstack: [
    'frontend engineer', 'backend engineer', 'software engineer',
    'design systems', 'design engineer', 'mobile engineer',
    'platform engineer', 'devops', 'data engineer', 'solutions engineer',
  ],
  'full stack': [
    'frontend engineer', 'backend engineer', 'software engineer',
    'design systems', 'mobile engineer', 'platform engineer', 'data engineer',
  ],
  'fullstack engineer': ['frontend engineer', 'backend engineer', 'software engineer', 'mobile engineer', 'platform engineer'],
  'fullstack developer': ['frontend developer', 'backend developer', 'software developer', 'mobile developer'],

  // ── backend cluster ───────────────────────────────────────────────────────
  // d1: fullstack  |  d2: platform, data_ml, mobile  |  d3: frontend, design_systems, technical_sales
  'software engineer': [
    // d1
    'fullstack engineer', 'fullstack developer', 'full stack engineer',
    // d2
    'platform engineer', 'devops', 'infrastructure engineer', 'cloud engineer',
    'data engineer', 'ml engineer', 'ai engineer', 'data scientist',
    'mobile engineer', 'ios developer', 'android developer',
    // d3
    'frontend engineer', 'web developer', 'design systems',
    'solutions engineer', 'sales engineer',
  ],
  'software developer': [
    'fullstack developer', 'frontend developer', 'backend developer',
    'platform engineer', 'data engineer', 'ml engineer', 'mobile developer',
  ],
  backend: [
    'fullstack engineer', 'software engineer', 'platform engineer',
    'data engineer', 'mobile engineer', 'frontend engineer',
    'solutions engineer',
  ],
  'back end': [
    'fullstack engineer', 'software engineer', 'platform engineer',
    'data engineer', 'mobile engineer',
  ],
  'backend engineer': [
    'software engineer', 'fullstack engineer', 'platform engineer',
    'data engineer', 'ml engineer', 'mobile engineer', 'frontend engineer',
    'solutions engineer',
  ],
  'backend developer': [
    'software developer', 'fullstack developer', 'frontend developer',
    'platform engineer', 'data engineer', 'mobile developer',
  ],
  'api engineer': ['backend engineer', 'software engineer', 'fullstack engineer', 'platform engineer'],
  'systems engineer': [
    'backend engineer', 'software engineer', 'platform engineer',
    'infrastructure engineer', 'network engineer', 'fullstack engineer',
  ],
  'security engineer': [
    'backend engineer', 'platform engineer', 'software engineer',
    'devops', 'infrastructure engineer',
  ],
  'network engineer': [
    'infrastructure engineer', 'platform engineer', 'devops', 'systems engineer',
    'backend engineer',
  ],
  engineer: [
    'software engineer', 'backend engineer', 'frontend engineer', 'fullstack engineer',
    'platform engineer', 'data engineer', 'mobile engineer', 'systems engineer',
    'devops', 'solutions engineer',
  ],
  developer: [
    'software developer', 'backend developer', 'frontend developer', 'fullstack developer',
    'mobile developer', 'data engineer',
  ],
  python: [
    'backend engineer', 'software engineer', 'fullstack engineer',
    'data scientist', 'ml engineer', 'data engineer',
    'platform engineer',
  ],
  'python developer': [
    'software developer', 'backend developer', 'fullstack developer',
    'data engineer', 'data scientist', 'ml engineer',
  ],
  java: [
    'backend engineer', 'software engineer', 'fullstack engineer',
    'android developer', 'systems engineer',
  ],
  'java developer': [
    'software developer', 'backend developer', 'fullstack developer',
    'android developer', 'systems engineer',
  ],
  golang: ['backend engineer', 'software engineer', 'platform engineer', 'systems engineer', 'fullstack engineer'],
  'go developer': ['backend developer', 'software developer', 'platform engineer', 'systems engineer'],
  rust: ['backend engineer', 'software engineer', 'systems engineer', 'platform engineer'],
  ruby: ['backend engineer', 'software engineer', 'fullstack engineer'],
  'ruby developer': ['backend developer', 'software developer', 'fullstack developer'],
  node: ['backend engineer', 'javascript developer', 'fullstack engineer', 'software engineer'],
  django: ['backend engineer', 'python developer', 'software engineer', 'fullstack engineer'],
  rails: ['backend engineer', 'ruby developer', 'software engineer', 'fullstack engineer'],
  graphql: ['backend engineer', 'fullstack engineer', 'software engineer', 'frontend engineer'],
  microservices: ['backend engineer', 'software engineer', 'platform engineer', 'fullstack engineer'],
  'solutions architect': ['backend engineer', 'software engineer', 'platform engineer', 'fullstack engineer'],

  // ── content_writing cluster ───────────────────────────────────────────────
  // d2: design_content, marketing  |  d3: brand_creative, ux_design, product_mgmt
  'content writer': [
    // d2
    'copywriter', 'technical writer', 'ux writer', 'content designer',
    'marketing manager', 'content marketer', 'digital marketer',
    // d3
    'creative director', 'art director', 'ux designer', 'product manager',
  ],
  copywriter: [
    'content writer', 'technical writer', 'ux writer', 'content designer',
    'marketing manager', 'brand manager', 'creative director',
  ],
  'technical writer': [
    'content writer', 'ux writer', 'content designer', 'developer relations',
    'documentation', 'marketing manager',
  ],
  editor: [
    'content writer', 'copywriter', 'journalist', 'communications manager',
    'content manager', 'marketing manager',
  ],
  journalist: [
    'reporter', 'editor', 'content writer', 'copywriter', 'communications manager',
  ],
  'communications manager': [
    'marketing manager', 'content writer', 'public relations', 'brand manager',
    'copywriter',
  ],
  'communications director': [
    'marketing director', 'content writer', 'public relations', 'brand manager',
  ],
  'public relations': [
    'communications manager', 'brand manager', 'marketing manager', 'content writer',
  ],
  pr: [
    'public relations', 'communications manager', 'marketing manager', 'brand manager',
  ],

  // ── marketing cluster ─────────────────────────────────────────────────────
  // d2: brand_creative, content_writing, ui_visual  |  d3: ux_design, design_content, product_mgmt, technical_sales, sales
  marketing: [
    // d2 → brand_creative
    'creative director', 'art director', 'motion designer', 'brand designer',
    // d2 → content_writing
    'content writer', 'copywriter', 'communications manager',
    // d2 → ui_visual
    'ui designer', 'visual designer', 'graphic designer',
    // d3 → product_mgmt
    'product manager',
    // d3 → technical_sales/sales
    'account manager', 'customer success manager', 'account executive',
  ],
  'marketing manager': [
    'brand manager', 'content marketer', 'demand generation', 'growth marketer',
    'digital marketer', 'social media manager', 'creative director', 'content writer',
    'product marketer',
  ],
  'growth marketer': [
    'demand generation', 'marketing manager', 'digital marketer', 'product marketer',
    'seo specialist', 'content marketer',
  ],
  growth: [
    'growth marketer', 'demand generation', 'marketing manager', 'product marketer',
    'digital marketer', 'account executive', 'business development',
  ],
  'demand generation': [
    'marketing manager', 'growth marketer', 'digital marketer', 'seo specialist',
    'email marketer', 'content marketer',
  ],
  seo: [
    'seo specialist', 'digital marketer', 'content marketer', 'growth marketer',
    'marketing manager', 'content writer',
  ],
  'digital marketing': [
    'marketing manager', 'seo specialist', 'demand generation', 'growth marketer',
    'social media manager', 'content marketer',
  ],
  'social media': [
    'social media manager', 'marketing manager', 'content marketer',
    'brand manager', 'digital marketer',
  ],
  'brand manager': [
    'marketing manager', 'brand strategist', 'creative director',
    'art director', 'content marketer',
  ],
  'content marketer': [
    'content writer', 'marketing manager', 'seo specialist',
    'copywriter', 'growth marketer',
  ],
  'product marketer': [
    'marketing manager', 'growth marketer', 'product manager',
    'demand generation', 'content marketer',
  ],
  'email marketer': [
    'marketing manager', 'demand generation', 'content marketer',
    'growth marketer', 'digital marketer',
  ],

  // ── product_mgmt cluster ──────────────────────────────────────────────────
  // d3: ux_design, design_content, marketing, content_writing, technical_sales
  'product manager': [
    'program manager', 'product lead', 'product owner', 'group product manager',
    'technical product manager',
    // d3
    'ux designer', 'product designer', 'content designer', 'ux writer',
    'marketing manager', 'customer success manager', 'account manager',
  ],
  'program manager': [
    'product manager', 'project manager', 'technical program manager',
    'operations manager', 'product owner',
  ],
  'product management': [
    'product manager', 'program manager', 'product lead', 'product owner',
    'technical product manager',
  ],
  'product owner': [
    'product manager', 'program manager', 'scrum master', 'project manager',
  ],
  'head of product': [
    'vp of product', 'product manager', 'program manager', 'chief product',
  ],
  'project manager': [
    'program manager', 'product manager', 'operations manager', 'scrum master',
    'product owner',
  ],

  // ── accounting cluster ────────────────────────────────────────────────────
  // d2: finance  |  d3: admin
  accounting: [
    // d2 → finance
    'financial analyst', 'financial planner', 'investment analyst', 'portfolio manager',
    'treasury analyst', 'risk analyst', 'quant analyst', 'finance manager',
    // d3 → admin
    'executive assistant', 'office manager', 'operations coordinator',
  ],
  accountant: [
    'controller', 'bookkeeper', 'auditor', 'tax accountant', 'financial analyst',
    'accounts payable', 'accounts receivable', 'payroll specialist',
    'investment analyst',
  ],
  bookkeeper: [
    'accountant', 'controller', 'accounts payable', 'accounts receivable',
    'payroll specialist', 'financial analyst',
  ],
  controller: [
    'accountant', 'auditor', 'financial analyst', 'bookkeeper',
    'finance manager', 'cfo',
  ],
  auditor: [
    'accountant', 'controller', 'tax specialist', 'compliance officer',
    'financial analyst', 'risk analyst',
  ],
  'accounts payable': [
    'accounts receivable', 'accountant', 'bookkeeper', 'controller',
    'payroll specialist', 'financial analyst',
  ],
  'accounts receivable': [
    'accounts payable', 'accountant', 'bookkeeper', 'controller',
    'billing specialist', 'financial analyst',
  ],
  tax: [
    'accountant', 'auditor', 'tax specialist', 'tax manager',
    'financial analyst', 'controller', 'cpa',
  ],
  payroll: [
    'hr specialist', 'accountant', 'bookkeeper', 'controller',
    'benefits administrator', 'people operations',
  ],

  // ── finance cluster ───────────────────────────────────────────────────────
  // d2: accounting  |  d3: data_ml
  finance: [
    // d2 → accounting
    'accountant', 'bookkeeper', 'controller', 'auditor', 'tax specialist',
    'payroll specialist', 'accounts payable', 'accounts receivable',
    // d3 → data_ml
    'data scientist', 'quantitative analyst', 'quant', 'data analyst',
  ],
  'financial analyst': [
    'investment analyst', 'portfolio manager', 'quant analyst', 'risk analyst',
    'treasury analyst', 'accountant', 'data analyst', 'controller',
  ],
  'financial planner': [
    'financial advisor', 'financial analyst', 'investment analyst',
    'wealth manager', 'portfolio manager',
  ],
  'financial advisor': [
    'financial planner', 'wealth manager', 'investment analyst',
    'financial analyst', 'portfolio manager',
  ],
  investing: [
    'investment analyst', 'portfolio manager', 'equity analyst',
    'financial analyst', 'risk analyst', 'quant analyst', 'fund manager',
    'accountant',
  ],
  investment: [
    'investment analyst', 'portfolio manager', 'equity analyst',
    'financial analyst', 'quant analyst', 'accountant',
  ],
  'investment analyst': [
    'portfolio manager', 'equity analyst', 'quant analyst', 'risk analyst',
    'financial analyst', 'data analyst',
  ],
  'investment banking': [
    'financial analyst', 'investment analyst', 'portfolio manager',
    'equity analyst', 'quant analyst', 'controller',
  ],
  'portfolio manager': [
    'investment analyst', 'financial analyst', 'risk analyst',
    'fund manager', 'equity analyst', 'quant analyst',
  ],
  'risk analyst': [
    'financial analyst', 'quant analyst', 'actuary', 'data analyst',
    'compliance officer', 'credit analyst',
  ],
  'credit analyst': [
    'financial analyst', 'risk analyst', 'investment analyst', 'accountant',
  ],
  'treasury analyst': [
    'financial analyst', 'controller', 'accountant', 'risk analyst',
    'finance manager',
  ],
  treasury: [
    'financial analyst', 'controller', 'accountant', 'risk analyst',
    'finance manager',
  ],
  quant: [
    'quantitative analyst', 'data scientist', 'financial analyst',
    'risk analyst', 'ml engineer', 'data analyst',
  ],
  actuary: [
    'risk analyst', 'financial analyst', 'quant analyst', 'data scientist',
  ],
  banking: [
    'financial analyst', 'investment analyst', 'portfolio manager',
    'credit analyst', 'accountant', 'controller',
  ],
  'equity analyst': [
    'investment analyst', 'financial analyst', 'portfolio manager',
    'quant analyst', 'risk analyst',
  ],

  // ── technical_sales cluster ───────────────────────────────────────────────
  // d2: sales  |  d3: marketing, backend, frontend, product_mgmt, fullstack
  'customer success': [
    // d2 → sales
    'account executive', 'bdr', 'sdr', 'business development representative',
    'sales manager',
    // d3 → marketing
    'marketing manager', 'demand generation',
    // d3 → backend/fullstack
    'software engineer', 'backend engineer', 'fullstack engineer',
    // d3 → product
    'product manager',
  ],
  'customer success manager': [
    'account manager', 'solutions engineer', 'account executive', 'sales manager',
    'implementation specialist', 'software engineer',
  ],
  csm: [
    'customer success manager', 'account manager', 'account executive',
    'solutions engineer', 'sales manager',
  ],
  'account manager': [
    'customer success manager', 'account executive', 'solutions engineer',
    'sales representative', 'business development manager',
  ],
  'solutions engineer': [
    'sales engineer', 'customer success engineer', 'implementation engineer',
    'technical account manager', 'software engineer', 'backend engineer',
    'account executive',
  ],
  'sales engineer': [
    'solutions engineer', 'customer success engineer', 'technical sales',
    'software engineer', 'account executive', 'backend engineer',
  ],
  'implementation engineer': [
    'solutions engineer', 'customer success manager', 'account manager',
    'technical consultant', 'software engineer',
  ],
  'client success': [
    'customer success manager', 'account manager', 'account executive',
    'solutions engineer',
  ],
  'customer support': [
    'customer success', 'support engineer', 'technical support', 'help desk',
    'account manager',
  ],

  // ── sales cluster ─────────────────────────────────────────────────────────
  // d2: technical_sales  |  d3: marketing, product_mgmt
  sales: [
    // d2 → technical_sales
    'solutions engineer', 'sales engineer', 'customer success manager',
    'account manager', 'implementation engineer', 'client success',
    // d3 → marketing
    'marketing manager', 'growth marketer', 'demand generation',
    // d3 → product_mgmt
    'product manager',
  ],
  'account executive': [
    'sales representative', 'business development', 'sales manager',
    'account manager', 'customer success manager', 'bdr', 'sdr',
  ],
  'business development': [
    'account executive', 'sales manager', 'partnerships manager', 'bdr', 'sdr',
    'growth marketer', 'marketing manager',
  ],
  bdr: ['sdr', 'account executive', 'business development', 'sales representative'],
  sdr: ['bdr', 'account executive', 'business development', 'sales representative'],
  'enterprise sales': [
    'account executive', 'sales manager', 'sales director',
    'solutions engineer', 'customer success manager',
  ],
  'inside sales': [
    'account executive', 'bdr', 'sdr', 'sales representative',
    'customer success manager',
  ],

  // ── legal cluster ─────────────────────────────────────────────────────────
  // d3: admin
  legal: [
    'attorney', 'paralegal', 'compliance officer', 'legal analyst',
    'legal assistant', 'counsel',
    // d3 → admin
    'executive assistant', 'administrative assistant', 'office manager',
    'operations coordinator',
  ],
  paralegal: [
    // legal cluster peers
    'legal assistant', 'legal coordinator', 'legal analyst',
    'attorney', 'compliance officer',
    // d3 → admin
    'executive assistant', 'administrative assistant', 'office coordinator',
    'operations coordinator',
  ],
  'legal assistant': [
    'paralegal', 'legal coordinator', 'compliance officer',
    'executive assistant', 'administrative assistant',
  ],
  attorney: [
    'counsel', 'paralegal', 'legal analyst', 'compliance officer',
    'legal manager', 'legal assistant',
  ],
  counsel: [
    'attorney', 'legal analyst', 'compliance officer', 'paralegal',
  ],
  'compliance officer': [
    'legal analyst', 'risk analyst', 'auditor', 'attorney', 'paralegal',
    'regulatory specialist',
  ],

  // ── admin cluster ─────────────────────────────────────────────────────────
  // d3: legal, accounting
  'executive assistant': [
    'administrative assistant', 'office manager', 'operations coordinator',
    'project coordinator',
    // d3 → legal
    'legal assistant', 'paralegal',
    // d3 → accounting
    'accountant', 'bookkeeper',
  ],
  'administrative assistant': [
    'executive assistant', 'office coordinator', 'office manager',
    'operations coordinator', 'legal assistant',
  ],
  'office manager': [
    'administrative assistant', 'executive assistant', 'operations coordinator',
    'office coordinator', 'paralegal',
  ],
  'operations coordinator': [
    'office manager', 'administrative assistant', 'project coordinator',
    'program coordinator', 'executive assistant',
  ],

  // ── cross-cutting / hr ────────────────────────────────────────────────────
  // HR isn't in the 20 clusters but appears frequently — mapped to nearest adjacent roles
  'human resources': [
    'hr specialist', 'people operations', 'talent acquisition', 'recruiter',
    'hrbp', 'executive assistant', 'administrative assistant', 'payroll specialist',
  ],
  hr: [
    'human resources', 'people operations', 'talent acquisition', 'recruiter',
    'hrbp', 'executive assistant', 'payroll specialist',
  ],
  recruiter: [
    'talent acquisition', 'sourcing specialist', 'hr specialist',
    'people operations', 'technical recruiter',
  ],
  recruiting: [
    'talent acquisition', 'recruiter', 'sourcing', 'hr specialist',
    'people operations', 'technical recruiting',
  ],
  'people operations': [
    'hr specialist', 'recruiter', 'talent acquisition', 'hrbp',
    'payroll specialist', 'executive assistant',
  ],

  // ── security (maps into platform/backend) ─────────────────────────────────
  security: [
    'cybersecurity', 'information security', 'infosec', 'penetration testing',
    'appsec', 'network security', 'compliance officer',
    // adjacent to platform and backend
    'devops', 'platform engineer', 'backend engineer', 'software engineer',
  ],
  cybersecurity: [
    'information security', 'infosec', 'penetration testing', 'appsec',
    'network security', 'compliance officer', 'platform engineer', 'backend engineer',
  ],
  'information security': [
    'cybersecurity', 'security engineer', 'compliance officer',
    'platform engineer', 'backend engineer',
  ],
}

const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'])
const CA_PROVINCES = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'])
const AU_STATES = new Set(['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'])

const COUNTRY_PATTERNS: Record<string, RegExp> = {
  US: /\b(usa|u\.s\.a\.?|united states?|america)\b/i,
  CA: /\b(canada|canadian|ontario|british columbia|alberta|quebec)\b/i,
  UK: /\b(uk|u\.k\.?|united kingdom|england|britain|london|manchester|birmingham|edinburgh|glasgow)\b/i,
  AU: /\b(australia|australian|sydney|melbourne|brisbane|perth|adelaide)\b/i,
  DE: /\b(germany|german|deutschland|berlin|hamburg|munich|münchen|frankfurt|cologne|köln)\b/i,
  FR: /\b(france|french|paris|lyon|marseille|toulouse|bordeaux)\b/i,
  IN: /\b(india|indian|bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune)\b/i,
}

function detectUserCountry(loc: any): string | null {
  if (!loc) return null
  const state = (loc.state || '').trim().toUpperCase()
  const city = (loc.city || '').toLowerCase().trim()
  const postal = (loc.postalCode || '').trim()
  if (US_STATES.has(state) || /^\d{5}(-\d{4})?$/.test(postal)) return 'US'
  if (CA_PROVINCES.has(state) || /^[A-Z]\d[A-Z]/.test(postal)) return 'CA'
  if (AU_STATES.has(state)) return 'AU'
  if (/^(london|manchester|birmingham|leeds|glasgow|liverpool|edinburgh|bristol|sheffield|cardiff|belfast)$/.test(city)) return 'UK'
  if (/^(berlin|hamburg|munich|münchen|frankfurt|cologne|köln|düsseldorf|stuttgart)$/.test(city)) return 'DE'
  if (/^(paris|lyon|marseille|toulouse|nice|nantes|bordeaux|strasbourg)$/.test(city)) return 'FR'
  if (/^(bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune|kolkata)$/.test(city)) return 'IN'
  return null
}

const ENGLISH_COUNTRIES = new Set(['US', 'CA', 'UK', 'AU'])

// 2 = user's country, 1 = remote/neutral, 0 = different country or non-English for English-speaking user
function getJobCountryScore(job: any, userCountry: string): number {
  // Non-English content always deprioritised for English-country users
  if (job.lang && job.lang !== 'en' && ENGLISH_COUNTRIES.has(userCountry)) return 0
  // Quick German-company heuristic for existing jobs without lang field
  if (!job.lang && /\bgmbh\b|\bag\b/i.test((job.company || '') + ' ' + (job.title || '')) && ENGLISH_COUNTRIES.has(userCountry)) return 0
  const loc = (job.location || '').trim()
  if (!loc || /^(remote|worldwide|global|anywhere|virtual|online)$/i.test(loc)) return 1
  const userPat = COUNTRY_PATTERNS[userCountry]
  if (userPat?.test(loc)) return 2
  for (const [c, re] of Object.entries(COUNTRY_PATTERNS)) {
    if (c !== userCountry && re.test(loc)) return 0
  }
  return 1
}

// Strip mojibake (UTF-8 emoji read as Latin-1) and stray emoji from display text
function cleanTitle(title: string): string {
  if (!title) return title
  return title
    .replace(/[-ÿ]{2,}/g, '') // mojibake sequences
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27FF}]/gu, '') // actual emoji
    .replace(/\s{2,}/g, ' ').trim()
}

const AGGREGATOR_HOSTS_FEED = new Set(['jobicy.com', 'remoteok.com', 'remotive.com', 'arbeitnow.com', 'workingnomads.com', 'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'simplyhired.com', 'smartremotejobs.com', 'remote.co', 'weworkremotely.com', 'jobboard.io', 'himalayas.app', 'himalayas.com', 'otta.com', 'getro.com', 'wellfound.com', 'angel.co', 'builtin.com', 'builtinsf.com', 'builtinnyc.com', 'builtinla.com', 'builtinboston.com', 'builtinchicago.com', 'builtincolorado.com', 'builtinaustin.com', 'builtinseattle.com'])
const _isAggregatorUrl = (u: string) => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return AGGREGATOR_HOSTS_FEED.has(h) || [...AGGREGATOR_HOSTS_FEED].some(a => h.endsWith('.' + a)) } catch { return false } }
const jobHasUsableUrl = (job: any): boolean => {
  const raw = String(job.apply_url || job.applyUrl || job.url || '')
  return !!(( raw && !_isAggregatorUrl(raw)) || job.company_url)
}

const JUNK_LOCATION_RE = /^(remote|worldwide|global|anywhere|online|virtual|home|platform|product|engineering|marketing|sales|design|tech|media|data|software|hardware|mobile|web|cloud|human|devops|backend|frontend|fullstack|operations|finance|legal|hr|it|various|multiple|flexible|tbd|na|n\/a|unknown|all|any|other)\b/i
const isRealLocation = (loc: string): boolean => {
  if (!loc) return false
  const t = loc.trim()
  if (t.length < 2) return false
  if (JUNK_LOCATION_RE.test(t)) return false
  return /^[A-Z]/.test(t) // proper noun — real city names are capitalized
}

// ---------------------------------------------------------------------------
// Lightweight client-side cluster classifier — mirrors server roleOntology IDs
// so affinity scores align with the matching algorithm's 20 clusters.
// Ordered most-specific first to avoid mis-classifications.
// ---------------------------------------------------------------------------
const CLUSTER_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'design_systems',  re: /\b(design[\s-]?systems?|ux[\s-]?engineer|design[\s-]?engineer|component[\s-]?library|design[\s-]?token)\b/i },
  { id: 'design_content',  re: /\b(content[\s-]?design(?:er)?|ux[\s-]?writ(?:er|ing)|microcopy)\b/i },
  { id: 'brand_creative',  re: /\b(creative[\s-]?director|art[\s-]?director|motion[\s-]?design(?:er)?|animator|video[\s-]?edit(?:or|ing))\b/i },
  { id: 'ux_design',       re: /\b(ux|user[\s-]?experience|product[\s-]?design(?:er)?|interaction[\s-]?design|service[\s-]?design|usability)\b/i },
  { id: 'ui_visual',       re: /\b(ui[\s-]?design(?:er)?|visual[\s-]?design(?:er)?|graphic[\s-]?design(?:er)?|web[\s-]?design(?:er)?|digital[\s-]?design(?:er)?|brand[\s-]?design(?:er)?|illustrat(?:or|ion))\b/i },
  { id: 'platform',        re: /\b(devops|site[\s-]?reliabil|platform[\s-]?engineer|infrastructure[\s-]?engineer|cloud[\s-]?engineer|\bsre\b|devsecops|mlops|terraform|kubernetes)\b/i },
  { id: 'data_ml',         re: /\b(data[\s-]?sci(?:entist|ence)|machine[\s-]?learn|ml[\s-]?engineer|ai[\s-]?engineer|research[\s-]?sci(?:entist)?|data[\s-]?engineer|analytics[\s-]?engineer|\bnlp\b|\bllm\b)\b/i },
  { id: 'mobile',          re: /\b(ios|android|mobile[\s-]?(?:engineer|developer|app)|react[\s-]?native|flutter|\bswift(?:ui)?\b|\bkotlin\b)\b/i },
  { id: 'frontend',        re: /\b(front[\s-]?end|frontend|ui[\s-]?engineer|react[\s-]?developer|javascript[\s-]?developer|typescript[\s-]?developer|web[\s-]?developer)\b/i },
  { id: 'fullstack',       re: /\b(full[\s-]?stack|fullstack)\b/i },
  { id: 'backend',         re: /\b(back[\s-]?end|backend|software[\s-]?engineer|software[\s-]?developer|api[\s-]?engineer|systems[\s-]?engineer|python[\s-]?developer|java[\s-]?developer|ruby[\s-]?developer|go[\s-]?developer|node[\s-]?developer)\b/i },
  { id: 'content_writing', re: /\b(content[\s-]?writ(?:er|ing)|copywriter|copywriting|technical[\s-]?writ(?:er|ing)|journalist|communications?[\s-]+(?:manager|director|specialist))\b/i },
  { id: 'marketing',       re: /\b(marketing[\s-]+(?:manager|director|specialist|analyst|strategist)|brand[\s-]?manager|growth[\s-]+(?:market|hacker)|demand[\s-]?gen|seo[\s-]?specialist|social[\s-]?media[\s-]+(?:manager|specialist)|product[\s-]?market(?:er|ing))\b/i },
  { id: 'product_mgmt',    re: /\b(product[\s-]?manager|product[\s-]?management|program[\s-]?manager|product[\s-]?owner|product[\s-]?lead|head[\s-]?of[\s-]?product|vp[\s-]+(?:of[\s-]+)?product)\b/i },
  { id: 'accounting',      re: /\b(accountant|bookkeeper|controller|auditor|accounts?[\s-]+(?:payable|receivable)|payroll[\s-]?specialist|tax[\s-]+(?:accountant|specialist|analyst))\b/i },
  { id: 'finance',         re: /\b(financial?[\s-]+(?:analyst|advisor|planner|director)|investment[\s-]+(?:analyst|banker)|portfolio[\s-]?manager|risk[\s-]?analyst|treasury|actuary|quant(?:itative)?[\s-]+analyst)\b/i },
  { id: 'technical_sales', re: /\b(solutions?[\s-]?engineer|sales[\s-]?engineer|customer[\s-]?success|account[\s-]?manager|client[\s-]?success|implementation[\s-]+(?:engineer|specialist)|technical[\s-]?account)\b/i },
  { id: 'sales',           re: /\b(account[\s-]?executive|business[\s-]?development|\bbdr\b|\bsdr\b|enterprise[\s-]?sales|inside[\s-]?sales|sales[\s-]+(?:manager|director|representative|rep))\b/i },
  { id: 'legal',           re: /\b(attorney|counsel|paralegal|legal[\s-]+(?:assistant|analyst|coordinator|manager|counsel)|compliance[\s-]?officer|general[\s-]?counsel)\b/i },
  { id: 'admin',           re: /\b(executive[\s-]?assistant|administrative[\s-]?assistant|office[\s-]?manager|office[\s-]?coordinator|operations?[\s-]?coordinator)\b/i },
]

function _detectCluster(title: string): string | null {
  if (!title) return null
  for (const { id, re } of CLUSTER_PATTERNS) {
    if (re.test(title)) return id
  }
  return null
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
  const [clusterAffinity, setClusterAffinity] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('wanderworkClusterAffinity')
      if (!saved) return {}
      const parsed = JSON.parse(saved)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch { return {} }
  })

  const _nudgeAffinity = (title: string, delta: number) => {
    const clusterId = _detectCluster(title)
    if (!clusterId) return
    setClusterAffinity(prev => {
      const next = { ...prev, [clusterId]: Math.max(-10, Math.min(10, (prev[clusterId] ?? 0) + delta)) }
      localStorage.setItem('wanderworkClusterAffinity', JSON.stringify(next))
      return next
    })
  }

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
    const discardedJob = visibleJobs.find((j: any) => j.id === jobId)
    if (discardedJob) _nudgeAffinity(discardedJob.title, -1)
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
    const restoredJob = visibleJobsList.find((j: any) => j.id === jobId)
    if (restoredJob) _nudgeAffinity(restoredJob.title, 1)
    setDiscardedJobs(prev => {
      const newSet = new Set(prev)
      newSet.delete(jobId)
      localStorage.setItem('wanderworkDiscardedJobs', JSON.stringify([...newSet]))
      return newSet
    })
  }

  const isJobInterested = (job: any) => {
    const override = interestedOverrides[job.id]
    if (override !== undefined) return override
    return Boolean(job.interested)
  }

  const candidate = data?.Candidates?.[0]
  const candidateId = candidate?._id
  const candidateLevel = useMemo(() => candidateSeniorityLevel(candidate), [candidate])
  const userCountry = useMemo(() => detectUserCountry(candidate?.location?.[0]), [candidate?.location?.[0]])
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
        .filter((pairing: any) => pairing?.jobId && Number(pairing?.score || 0) >= 10)
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

  const { visibleJobs, exactSearchCount } = useMemo(() => {
    const searchTerms = searchQuery.trim() ? _normSearch(searchQuery).split(' ').filter(Boolean) : []
    const exactIds = new Set<number>()

    // Hoist per-filter constants so they're computed once, not per-job
    const nowMs = Date.now()
    const trimmedLocation = locationQuery.trim().toLowerCase()
    const normalizedKeywords = keywords.map(k => k.toLowerCase())

    // Precompute search expansion once (not per-job \u00D7 per-term)
    type ExpandedEntry = { rt: string; multi: boolean }
    const expandedSearch: Array<{ entries: ExpandedEntry[] }> = searchTerms.map(term => ({
      entries: (SEARCH_EXPANSION[term] ?? []).map(phrase => {
        const rt = _normSearch(phrase)
        return { rt, multi: rt.includes(' ') }
      }),
    }))

    // Single combined filter pass \u2014 replaces 7 chained .filter() calls
    const jobs = visibleJobsList.filter((job: any) => {
      if (!jobHasUsableUrl(job)) return false
      if (discardedJobs.has(job.id)) return false
      if (showMatchedOnly && !matchedSet.has(job.id)) return false
      if (showInterestedOnly && !isJobInterested(job)) return false
      if (showNewOnly && !isNewJob(job)) return false

      // Script filter: drop Cyrillic / Arabic text
      const rawText = [job.title, job.company, job.description].filter(Boolean).join(' ')
      if (rawText && (/[\u0400-\u04FF]/.test(rawText) || /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(rawText))) return false

      // Date range (nowMs hoisted)
      if (dateRange !== 'all' && job.postedAt) {
        const posted = new Date(job.postedAt)
        const diffDays = (nowMs - posted.getTime()) / 86400000
        if (dateRange === 'today'     && diffDays >= 1)  return false
        if (dateRange === 'yesterday' && (diffDays < 1 || diffDays >= 2)) return false
        if (dateRange === 'this_week' && diffDays > 7)   return false
        if (dateRange === 'two_weeks' && diffDays > 14)  return false
        if (dateRange === 'this_month') {
          const n = new Date(nowMs)
          if (posted.getMonth() !== n.getMonth() || posted.getFullYear() !== n.getFullYear()) return false
        }
        if (dateRange === 'this_year' && posted.getFullYear() !== new Date(nowMs).getFullYear()) return false
      }

      // Location (trimmedLocation hoisted)
      if (trimmedLocation && !(job.location || '').toLowerCase().includes(trimmedLocation)) return false

      // Keywords (pre-lowercased above)
      if (normalizedKeywords.length > 0) {
        const entry = jobSearchTexts.get(job.id)
        if (entry && !normalizedKeywords.every(kw => entry.txt.includes(kw))) return false
      }

      // Semantic search
      if (searchTerms.length > 0) {
        const entry = jobSearchTexts.get(job.id)
        const tokens: Set<string> = entry?.tokens ?? new Set(_normSearch([job.title, job.company, job.description].filter(Boolean).join(' ')).split(' ').filter(Boolean))
        const txt = entry?.txt ?? ''

        // Exact: use for...of on Set to avoid Array.from allocation
        const isExact = searchTerms.every(term => {
          if (tokens.has(term)) return true
          if (term.length < 3) return false
          for (const t of tokens) { if (t.startsWith(term)) return true }
          return false
        })
        if (isExact) { exactIds.add(job.id); return true }

        // Related: use precomputed expanded entries (no per-job re-normalization)
        return expandedSearch.some(({ entries }) =>
          entries.some(({ rt, multi }) => multi ? txt.includes(rt) : tokens.has(rt))
        )
      }

      return true
    })


    // Precompute sort keys once O(N) — avoids recomputing per comparison O(N log N)
    const qualityCache = new Map<number, number>()
    const affinityCache = new Map<number, number>()
    const titleScoreCache = new Map<number, number>()

    for (const job of jobs) {
      qualityCache.set(job.id, (job.has_recruiter ? 2 : 0) + (job.ats_direct ? 1 : 0))

      const clusterId = _detectCluster(job.title)
      if (clusterId) {
        affinityCache.set(job.id, Math.max(-5, Math.min(5, clusterAffinity[clusterId] ?? 0)))
      }

      if (searchTerms.length > 0) {
        const titleTokens = new Set(_normSearch(job.title || '').split(' ').filter(Boolean))
        let all = true, any = false
        for (const t of searchTerms) {
          let hit = titleTokens.has(t)
          if (!hit && t.length >= 3) { for (const tk of titleTokens) { if (tk.startsWith(t)) { hit = true; break } } }
          if (hit) any = true; else all = false
        }
        titleScoreCache.set(job.id, all ? 2 : any ? 1 : 0)
      }
    }

    jobs.sort((a: any, b: any) => {
      if (searchTerms.length > 0) {
        const exactDiff = (exactIds.has(b.id) ? 1 : 0) - (exactIds.has(a.id) ? 1 : 0)
        if (exactDiff !== 0) return exactDiff
        const titleDiff = (titleScoreCache.get(b.id) ?? 0) - (titleScoreCache.get(a.id) ?? 0)
        if (titleDiff !== 0) return titleDiff
        const qDiff = (qualityCache.get(b.id) ?? 0) - (qualityCache.get(a.id) ?? 0)
        if (qDiff !== 0) return qDiff
        const affDiff = (affinityCache.get(b.id) ?? 0) - (affinityCache.get(a.id) ?? 0)
        if (affDiff !== 0) return affDiff
      } else {
        const qDiff = (qualityCache.get(b.id) ?? 0) - (qualityCache.get(a.id) ?? 0)
        if (qDiff !== 0) return qDiff
        const affDiff = (affinityCache.get(b.id) ?? 0) - (affinityCache.get(a.id) ?? 0)
        if (affDiff !== 0) return affDiff
        if (userCountry) {
          const diff = getJobCountryScore(b, userCountry) - getJobCountryScore(a, userCountry)
          if (diff !== 0) return diff
        }
      }
      return getJobTime(b) - getJobTime(a)
    })

    return { visibleJobs: jobs, exactSearchCount: searchTerms.length > 0 ? exactIds.size : jobs.length }
  }, [visibleJobsList, discardedJobs, showMatchedOnly, matchedSet, showInterestedOnly, showNewOnly, locationQuery, dateRange, keywords, interestedOverrides, jobSearchTexts, searchQuery, userCountry, clusterAffinity])
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
    _nudgeAffinity(job.title, nextValue ? 1 : -1)
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
          <p className="text-[11px] mb-3" style={{ color: '#A0A0A0' }}>Jobs are removed from the database after {JOB_PURGE_DAYS} days.</p>
          <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
            {discardedJobsList.map((job: any) => {
              const posted = getJobDate(job)
              const daysUntilPurge = posted
                ? Math.max(0, JOB_PURGE_DAYS - Math.floor((Date.now() - posted.getTime()) / MS_PER_DAY))
                : null
              const isSoonPurge = daysUntilPurge !== null && daysUntilPurge <= 7
              return (
                <div key={job.id} className="flex items-center justify-between bg-white p-3 rounded-[10px]" style={{ borderLeft: `3px solid ${isSoonPurge ? '#F59E0B' : '#306770'}` }}>
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-[14px] font-semibold text-black truncate">{cleanTitle(job.title)}</p>
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
        {visibleJobs.slice(0, visibleCount).flatMap((job: any, _jobIndex: number) => {
          const isInterested = isJobInterested(job)
          const isNew = isNewJob(job)
          const expiringDays = (() => {
            const posted = getJobDate(job)
            if (!posted) return null
            const ageDays = Math.floor((Date.now() - posted.getTime()) / MS_PER_DAY)
            const remaining = JOB_PURGE_DAYS - ageDays
            if (remaining < 0 || remaining > 7) return null
            return remaining
          })()
          const safeDescription = jobDescriptions.get(job.id) ?? FALLBACK_DESC
          const showDivider = searchQuery.trim() && _jobIndex === exactSearchCount && exactSearchCount < visibleJobs.length

          const card = (
            <JobCard
              key={job.id}
              {...job}
              title={cleanTitle(job.title)}
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

          if (!showDivider) return [card]
          return [
            <div key="related-divider" className="flex items-center gap-3 pt-2 pb-1">
              <div className="flex-1 border-t" style={{ borderColor: '#E5E7EB' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2" style={{ color: '#ABABAB', fontFamily: 'Manrope' }}>
                Related results
              </span>
              <div className="flex-1 border-t" style={{ borderColor: '#E5E7EB' }} />
            </div>,
            card,
          ]
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
            <div className="flex flex-col gap-2 text-center max-w-[340px]">
              <p className="text-[14px] font-semibold" style={{ color: '#306770', fontFamily: 'Manrope' }}>
                Sign up to unlock everything.
              </p>
              <div className="flex flex-col gap-1">
                {['Get paired with jobs automatically', 'Custom resumes and cover letters', 'Connect directly with recruiters'].map(item => (
                  <p key={item} className="text-[12px]" style={{ color: '#787878', fontFamily: 'Manrope' }}>
                    ✓ {item}
                  </p>
                ))}
              </div>
            </div>
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
              {hasNewBadge && expiringDays == null && (
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
                  {`Expires in ${expiringDays} day${expiringDays === 1 ? '' : 's'}`}
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

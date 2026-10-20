// Landing filters <-> URL. Ads and shared links can open the page already
// filtered (/landing?q=designer&region=us&field=design), and the URL follows
// the visitor's changes so a copied link shows the same results. Unknown
// params (utm_*, gclid, fbclid) are left alone.

import { QUICK_FILTERS, type JobTypeFilter, type LandingFilters, type PostedFilter, type QuickFilter, type SortKey } from './searchLandingData'

const REGION_KEYS: QuickFilter[] = ['worldwide', 'us']
const FIELD_KEYS = QUICK_FILTERS.filter((f) => f.group === 'field').map((f) => f.key)
const OWNED = ['q', 'region', 'field', 'salary', 'type', 'posted', 'sort']

export function readFiltersFromUrl(search = typeof window !== 'undefined' ? window.location.search : ''): LandingFilters {
  const p = new URLSearchParams(search)
  const quick: QuickFilter[] = []
  const region = p.get('region') as QuickFilter | null
  if (region && REGION_KEYS.includes(region)) quick.push(region)
  for (const f of (p.get('field') || '').split(',')) {
    if (FIELD_KEYS.includes(f as QuickFilter) && !quick.includes(f as QuickFilter)) quick.push(f as QuickFilter)
  }
  if (p.get('salary') === '80') quick.push('salary80')
  const type = p.get('type') as JobTypeFilter | null
  const posted = Number(p.get('posted'))
  return {
    query: (p.get('q') || p.get('utm_term') || '').slice(0, 80),
    quick,
    jobType: type && ['full', 'part', 'contract'].includes(type) ? type : '',
    postedWithinDays: ([1, 3, 7, 30].includes(posted) ? posted : 0) as PostedFilter,
    salaryOnly: p.get('salary') === 'listed',
    sort: (p.get('sort') === 'salary' ? 'salary' : 'newest') as SortKey,
  }
}

export function buildFilterSearch(f: LandingFilters, current: string): string {
  const p = new URLSearchParams(current)
  OWNED.forEach((k) => p.delete(k))
  const q = f.query.trim()
  if (q) p.set('q', q)
  const region = f.quick.find((k) => REGION_KEYS.includes(k))
  if (region) p.set('region', region)
  const fields = f.quick.filter((k) => FIELD_KEYS.includes(k))
  if (fields.length) p.set('field', fields.join(','))
  if (f.quick.includes('salary80')) p.set('salary', '80')
  else if (f.salaryOnly) p.set('salary', 'listed')
  if (f.jobType) p.set('type', f.jobType)
  if (f.postedWithinDays) p.set('posted', String(f.postedWithinDays))
  if (f.sort !== 'newest') p.set('sort', f.sort)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function writeFiltersToUrl(f: LandingFilters): void {
  try {
    const next = buildFilterSearch(f, window.location.search)
    if (next === window.location.search) return
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${next}${window.location.hash}`)
  } catch { /* history blocked in some embedded browsers */ }
}

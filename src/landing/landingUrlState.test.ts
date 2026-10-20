import { describe, expect, it } from 'vitest'
import { buildFilterSearch, readFiltersFromUrl } from './landingUrlState'

describe('landing URL state', () => {
  it('reads ad deep links', () => {
    const f = readFiltersFromUrl('?q=designer&region=us&field=design,marketing&salary=80&type=full&posted=7&sort=salary')
    expect(f).toEqual({ query: 'designer', quick: ['us', 'design', 'marketing', 'salary80'], jobType: 'full', postedWithinDays: 7, salaryOnly: false, sort: 'salary' })
  })
  it('ignores unknown values', () => {
    const f = readFiltersFromUrl('?region=mars&field=astronaut&type=forever&posted=2')
    expect(f.quick).toEqual([])
    expect(f.jobType).toBe('')
    expect(f.postedWithinDays).toBe(0)
  })
  it('falls back to the ad keyword', () => {
    expect(readFiltersFromUrl('?utm_term=react+developer').query).toBe('react developer')
  })
  it('round-trips and keeps tracking params', () => {
    const current = '?utm_source=google&gclid=abc&q=old'
    const f = readFiltersFromUrl('?q=writer&region=worldwide&salary=listed')
    const out = buildFilterSearch(f, current)
    const p = new URLSearchParams(out)
    expect(p.get('utm_source')).toBe('google')
    expect(p.get('gclid')).toBe('abc')
    expect(p.get('q')).toBe('writer')
    expect(p.get('region')).toBe('worldwide')
    expect(p.get('salary')).toBe('listed')
    expect(readFiltersFromUrl(out)).toEqual(f)
  })
  it('writes nothing for the default view', () => {
    expect(buildFilterSearch(readFiltersFromUrl(''), '')).toBe('')
  })
})

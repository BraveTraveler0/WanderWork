import { describe, expect, it } from 'vitest'
import { annualSalary, cleanSummary, deriveEligibility, filterJobs, spreadCompanies, toLandingJob, type LandingFilters, type LandingJob } from './searchLandingData'

const base: LandingFilters = { query: '', quick: [], jobType: '', postedWithinDays: 0, salaryOnly: false, sort: 'newest' }

describe('deriveEligibility', () => {
  it('reads the region out of the title', () => {
    expect(deriveEligibility('AI Automation Engineer (Remote - U.S.)', 'Remote', '').labels).toEqual(['US only'])
    expect(deriveEligibility('AI Engineer (Remote – LATAM & Philippines)', 'Remote', '').labels).toEqual(['LATAM', 'Philippines'])
  })
  it('does not treat the pronoun "us" as a US restriction', () => {
    expect(deriveEligibility('Designer', 'Remote', 'Join us, we build things for us all.').labels).toEqual([])
  })
  it('flags worldwide roles', () => {
    const r = deriveEligibility('Support Agent', 'Remote', 'Work from anywhere in the world.')
    expect(r).toEqual({ labels: ['Worldwide'], worldwide: true })
  })
  it('falls back to a specific posted location', () => {
    expect(deriveEligibility('Writer', 'Remote, Berlin', '').labels).toEqual(['Berlin'])
  })
})

describe('annualSalary', () => {
  it('annualizes ranges by their top figure', () => {
    expect(annualSalary('$120,000 – $150,000 / year')).toBe(150000)
    expect(annualSalary('$3,500 – $5,000 / month')).toBe(60000)
    expect(annualSalary('$50/hr')).toBe(104000)
    expect(annualSalary('$90k - $110k')).toBe(110000)
    expect(annualSalary('Competitive')).toBeNull()
  })
})

describe('filterJobs', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')
  const jobs = [
    toLandingJob({ _id: 'a', title: 'Senior Frontend Engineer (US)', company: 'Acme', salary: '$140k', job_type: 'Full-Time', date_posted: '2026-10-19T00:00:00Z' }),
    toLandingJob({ _id: 'b', title: 'Product Designer', company: 'Orbit', description_short: 'Work from anywhere.', job_type: 'Contract', date_posted: '2026-10-01T00:00:00Z' }),
    toLandingJob({ _id: 'c', title: 'Support Specialist', company: 'Northstar', salary: '$20/hr', job_type: 'Part-Time', date_posted: '2026-10-20T06:00:00Z' }),
  ].filter(Boolean) as NonNullable<ReturnType<typeof toLandingJob>>[]

  it('sorts newest first by default', () => {
    expect(filterJobs(jobs, base, now).map((j) => j.id)).toEqual(['c', 'a', 'b'])
  })
  it('matches every search word', () => {
    expect(filterJobs(jobs, { ...base, query: 'frontend acme' }, now).map((j) => j.id)).toEqual(['a'])
  })
  it('includes worldwide roles under United States', () => {
    expect(filterJobs(jobs, { ...base, quick: ['us'] }, now).map((j) => j.id).sort()).toEqual(['a', 'b'])
  })
  it('applies salary, field, type and age filters', () => {
    expect(filterJobs(jobs, { ...base, quick: ['salary80'] }, now).map((j) => j.id)).toEqual(['a'])
    expect(filterJobs(jobs, { ...base, quick: ['design'] }, now).map((j) => j.id)).toEqual(['b'])
    expect(filterJobs(jobs, { ...base, jobType: 'part' }, now).map((j) => j.id)).toEqual(['c'])
    expect(filterJobs(jobs, { ...base, postedWithinDays: 3 }, now).map((j) => j.id)).toEqual(['c', 'a'])
  })
})

describe('spreadCompanies', () => {
  it('keeps one employer from filling the top of the list', () => {
    const make = (id: string, company: string) => toLandingJob({ _id: id, title: 'Role', company }) as LandingJob
    const list = [make('1', 'Palantir'), make('2', 'Palantir'), make('3', 'Palantir'), make('4', 'Acme'), make('5', 'Orbit')]
    expect(spreadCompanies(list, 1).map((j) => j.id)).toEqual(['1', '4', '2', '5', '3'])
  })
})

describe('cleanSummary', () => {
  it('drops ATS metadata, hashtags and the repeated title', () => {
    const raw = 'Requisition #: 20523 Functional Area: Inside Sales Employment Type: Full-Time Work Options: Remote / Work from Home in the US #LI-Remote Work Hours: 8:00 - 4:30pm (CST) Inside Sales Representative (B2B Outbound) About J. J. Keller J. J. Keller is a national leader in safety and compliance solutions.'
    expect(cleanSummary(raw, 'Inside Sales Representative (B2B Outbound)')).toBe('J. J. Keller is a national leader in safety and compliance solutions.')
  })
  it('strips a title the summary starts with', () => {
    expect(cleanSummary('AI Automation Engineer (Remote - U.S.) Join a healthcare company as a builder.', 'AI Automation Engineer (Remote - U.S.)'))
      .toBe('Join a healthcare company as a builder.')
  })
  it('strips leading section headings', () => {
    expect(cleanSummary('About the role: You will lead design.', 'Designer')).toBe('You will lead design.')
    expect(cleanSummary('ABOUT THE TEAM The Mural team is ambitious.', 'Engineering Manager')).toBe('The Mural team is ambitious.')
  })
  it('marks text cut mid-sentence', () => {
    expect(cleanSummary('We build tools for teams and', 'X')).toBe('We build tools for teams and…')
  })
  it('leaves normal prose alone', () => {
    const t = 'Pinterest is hiring a product manager. Location: Remote.'
    expect(cleanSummary(t, 'Product Manager')).toBe(t)
  })
})

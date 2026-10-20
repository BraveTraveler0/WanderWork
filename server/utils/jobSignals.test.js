import { describe, expect, it } from 'vitest'
import signals from './jobSignals.js'

const { jobSignals, extractSalaryFromText, formatRange, buildSummary, displayLocation } = signals

describe('jobSignals regions', () => {
  it('reads US-only from ATS location strings', () => {
    expect(jobSignals({ title: 'Counsel', locationTexts: ['Remote - US'] }).remote_scope).toBe('US only')
    expect(jobSignals({ title: 'FRM', locationTexts: ['Remote - USA'] }).remote_scope).toBe('US only')
    expect(jobSignals({ title: 'AE', locationTexts: ['Remote, United States'] }).remote_scope).toBe('US only')
    expect(jobSignals({ title: 'Rep', locationTexts: ['Foster City, CA'] }).remote_scope).toBe('US only')
    expect(jobSignals({ title: 'Psychologist', locationTexts: ['Hawaii'] }).remote_scope).toBe('US only')
  })
  it('keeps several regions', () => {
    expect(jobSignals({ title: 'Engineer', locationTexts: ['Remote Poland', 'Remote Spain'] }).remote_scope).toBe('Spain, Poland')
    expect(jobSignals({ title: 'Fraud Specialist', locationTexts: ['Remote - Canada'] }).remote_scope).toBe('Canada')
    expect(jobSignals({ title: 'AI Engineer (Remote – LATAM & Philippines)', locationTexts: ['Remote'] }).remote_regions).toEqual(['LATAM', 'Philippines'])
  })
  it('finds requirements in the body but not mere mentions', () => {
    expect(jobSignals({ title: 'Writer', locationTexts: ['Remote'], fullText: 'We have offices in the US and Europe. Great team.' }).remote_scope).toBe(null)
    expect(jobSignals({ title: 'Writer', locationTexts: ['Remote'], fullText: 'Candidates must be based in the United States.' }).remote_scope).toBe('US only')
    expect(jobSignals({ title: 'Writer', locationTexts: ['Remote'], fullText: 'This role is open to candidates in Europe only.' }).remote_scope).toBe('Europe')
  })
  it('does not read the pronoun "us" as the US', () => {
    expect(jobSignals({ title: 'Designer', locationTexts: ['Remote'], fullText: 'Join us! Candidates who want to grow with us are welcome.' }).remote_scope).toBe(null)
  })
  it('flags worldwide', () => {
    expect(jobSignals({ title: 'Support', locationTexts: ['Anywhere in the World'] }).remote_scope).toBe('Worldwide')
    expect(jobSignals({ title: 'Support', locationTexts: ['Remote'], fullText: 'You can work from anywhere.' }).remote_scope).toBe('Worldwide')
  })
})

describe('jobSignals time zones', () => {
  const tz = (fullText) => jobSignals({ title: 'X', locationTexts: ['Remote'], fullText }).timezone_req
  it('finds common phrasings', () => {
    expect(tz('You must be able to work US time zones.')).toBe('US time zones')
    expect(tz('Work Hours: 8:00 - 4:30pm (CST) Inside Sales')).toBe('8:00 - 4:30pm (CST)')
    expect(tz('Location: UTC-3 to UTC+2 preferred.')).toBe('UTC-3 to UTC+2')
    expect(tz('At least 4 hours of overlap with EST.')).toMatch(/^4 hours of overlap with EST/)
    expect(tz('Must work Eastern business hours.')).toBe('Eastern business hours')
    expect(tz('A great job with no schedule notes.')).toBe(null)
  })
})

describe('pay', () => {
  it('parses ranges from text', () => {
    expect(extractSalaryFromText('USA base pay range per year: $115,000 - $165,000 USD')).toBe('$115,000 – $165,000')
    expect(extractSalaryFromText('Compensation: $120K – $150K')).toBe('$120K – $150K')
    expect(extractSalaryFromText('Pay: $25 - $35 per hour')).toBe('$25 – $35 / hour')
    expect(extractSalaryFromText('No numbers here')).toBe(null)
  })
  it('formats structured ranges', () => {
    expect(formatRange(123000, 168000, 'USD', 'per-year-salary')).toBe('$123,000 – $168,000 / year')
    expect(formatRange(50, 70, 'USD', 'per-hour-wage')).toBe('$50 – $70 / hour')
  })
})

describe('buildSummary', () => {
  it('starts at the role section after a company blurb', () => {
    const text = 'Acme builds rockets and has 500 employees across the globe and loves coffee. About the Role You will lead our payments team. You will hire engineers.'
    expect(buildSummary(text, 'Payments Lead')).toBe('You will lead our payments team. You will hire engineers.')
  })
  it('drops ATS metadata and hashtags', () => {
    expect(buildSummary('Requisition #: 20523 Functional Area: Inside Sales #LI-Remote We sell safety software.', 'Rep')).not.toMatch(/Requisition|#LI/)
  })
})

describe('displayLocation', () => {
  it('keeps the region detail', () => {
    expect(displayLocation('Remote - US')).toBe('Remote - US')
    expect(displayLocation('Remote')).toBe('Remote')
    expect(displayLocation('Austin, TX 78701')).toBe('Austin, TX')
  })
})

describe('summary and location edge cases', () => {
  it('ignores role words mid-sentence', () => {
    const text = 'Affirm is reinventing credit to make it more honest and friendly, giving consumers the flexibility to buy now and pay later. We encourage you to learn more about the role and our teams. Analysts at Affirm build models.'
    expect(signals.buildSummary(text, 'Analyst')).toMatch(/^Affirm is reinventing credit/)
  })
  it('drops leading punctuation left by a heading', () => {
    expect(signals.buildSummary("Ro is a health company that makes care easy and affordable for everyone. What you'll do: Own and optimize campaigns.", 'Manager')).toBe('Own and optimize campaigns.')
  })
  it('labels a remote job listed under an office city', () => {
    expect(signals.remoteLocation('New York, NY (HQ)', 'US only')).toBe('Remote - US')
    expect(signals.remoteLocation('Remote - Canada', 'Canada')).toBe('Remote - Canada')
  })
})

describe('source quirks', () => {
  it('cleans a full ATS metadata block', () => {
    const raw = 'Requisition #: 20523 Functional Area: Inside Sales Employment Type: Full-Time Work Options: Remote / Work from Home in the US #LI-Remote Work Hours: 8:00 - 4:30pm (CST) Inside Sales Representative (B2B Outbound) About J. J. Keller J. J. Keller is a national leader in safety and compliance solutions.'
    expect(signals.buildSummary(raw, 'Inside Sales Representative (B2B Outbound)')).toBe('J. J. Keller is a national leader in safety and compliance solutions.')
    const sig = signals.jobSignals({ title: 'Sales Representative', locationTexts: ['Flexible / Remote'], fullText: raw })
    expect(sig.remote_scope).toBe('US only')
    expect(sig.timezone_req).toBe('8:00 - 4:30pm (CST)')
  })
  it('drops a leading requisition id', () => {
    expect(signals.buildSummary('Job Requisition ID # 26WD95687 Position Overview The Enterprise Renewal Representative owns renewals.', 'Rep')).toBe('The Enterprise Renewal Representative owns renewals.')
  })
  it('drops the WeWorkRemotely header', () => {
    expect(signals.buildSummary('Headquarters: Long Beach, CA URL: https://crankyconcierge.com/ The Travel Coordinator manages inbound email.', 'Travel Coordinator')).toBe('The Travel Coordinator manages inbound email.')
  })
  it('shows the region when an "anywhere" source is restricted', () => {
    expect(signals.remoteLocation('Anywhere in the World', 'US only')).toBe('Remote - US')
    expect(signals.remoteLocation('Anywhere in the World', 'Worldwide')).toBe('Anywhere in the World')
  })
})

describe('entities', () => {
  it('decodes double-escaped text', () => {
    expect(signals.buildSummary('GTM Strategy &amp;amp; Operations takes product initiatives and ships them.', 'Lead')).toBe('GTM Strategy & Operations takes product initiatives and ships them.')
    expect(signals.decodeEntities('Ops &amp;amp; Sales &lt;b&gt;')).toBe('Ops & Sales <b>')
  })
})

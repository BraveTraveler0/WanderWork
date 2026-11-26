'use strict'

// Matches shared opportunities to one business profile.
// checkFit() answers "could this business apply at all?" (hard rules from the profile
// and the opportunity's stated eligibility). scoreFit() ranks the ones that pass, and
// returns short reasons the dashboard shows next to each match.

const { MINORITY_GROUPS, INDUSTRIES, STAGES } = require('../config/capitalWatchOptions')
const { TOP_TIER_RE, SECOND_TIER_RE, EXCLUDED_COUNTRY_RE } = require('../config/capitalWatchGeo')

const INVESTMENT_RE = /\b(angel|venture|vc|investors?|investment fund|equity|seed round|pre-seed)\b/i
const COMPETITION_RE = /\b(competition|contest|challenge|pitch|prize|award program)\b/i
const ACCELERATOR_RE = /\b(accelerat\w*|incubat\w*|cohort)\b/i
const CONTRACT_RE = /\b(sbir|sttr|rfp|solicitation|procurement|contract)\b/i
const NEWS_TITLE_RE = /\b(announces?|announced|awarded|approves|approved|receives|received|celebrates|unveils|names \d|selects|selected|helps \w+ (feed|grow|expand))\b|\bawards\b.*\$\d/i

// Which of the profile's funding categories an opportunity falls in.
function categoryOf(grant) {
  const head = `${grant.title || ''} ${grant.agency || ''}`
  if (grant.fundingType === 'loan') return 'loan'
  if (grant.isInvestment || INVESTMENT_RE.test(head)) return 'investment'
  if (grant.fundingType === 'contract' || CONTRACT_RE.test(head)) return 'contract'
  if (ACCELERATOR_RE.test(head)) return 'accelerator'
  if (grant.fundingType === 'prize' || COMPETITION_RE.test(head)) return 'competition'
  if (['fellowship', 'scholarship', 'stipend'].includes(grant.fundingType)) return 'fellowship'
  return 'grant'
}

const COUNTRY_ALIASES = {
  'united states': ['united states', 'usa', 'u.s.', 'u.s.a', 'america', 'american', 'nationwide'],
  'united kingdom': ['united kingdom', 'uk', 'u.k.', 'britain', 'british', 'england', 'scotland', 'wales', 'northern ireland'],
}
function countryAliases(country) {
  const c = String(country || '').trim().toLowerCase()
  if (!c) return []
  if (['us', 'usa', 'united states of america'].includes(c)) return COUNTRY_ALIASES['united states']
  if (['uk', 'great britain', 'england'].includes(c)) return COUNTRY_ALIASES['united kingdom']
  return COUNTRY_ALIASES[c] || [c]
}
const mentionsAny = (text, words) => words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(text))

const US_STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
}
// Large US cities that local programs are usually named after, mapped to their state.
const US_CITIES = {
  atlanta: 'GA', austin: 'TX', houston: 'TX', dallas: 'TX', 'san antonio': 'TX', chicago: 'IL', detroit: 'MI', 'new york city': 'NY',
  nyc: 'NY', brooklyn: 'NY', 'los angeles': 'CA', 'san francisco': 'CA', 'san diego': 'CA', oakland: 'CA', 'san jose': 'CA', seattle: 'WA',
  portland: 'OR', denver: 'CO', phoenix: 'AZ', miami: 'FL', orlando: 'FL', tampa: 'FL', boston: 'MA', philadelphia: 'PA', pittsburgh: 'PA',
  baltimore: 'MD', charlotte: 'NC', raleigh: 'NC', nashville: 'TN', memphis: 'TN', 'new orleans': 'LA', minneapolis: 'MN', 'st. louis': 'MO',
  'kansas city': 'MO', cleveland: 'OH', columbus: 'OH', cincinnati: 'OH', milwaukee: 'WI', indianapolis: 'IN', 'las vegas': 'NV',
  birmingham: 'AL', jacksonville: 'FL', richmond: 'VA', louisville: 'KY', 'salt lake city': 'UT', albuquerque: 'NM', savannah: 'GA',
}
const stateCode = (s) => {
  const v = String(s || '').trim().toLowerCase()
  if (!v) return ''
  if (US_STATES[v]) return US_STATES[v]
  return /^[a-z]{2}$/.test(v) && Object.values(US_STATES).includes(v.toUpperCase()) ? v.toUpperCase() : ''
}
const isUS = (country) => countryAliases(country)[0] === 'united states'

// US states an opportunity is limited to, read from its location (and title, where
// local programs usually say their city). Empty = not limited to a state.
function statesNamed(grant) {
  const loc = lower(grant.location)
  const head = lower(`${grant.title} ${grant.agency}`)
  const found = new Set()
  for (const [name, code] of Object.entries(US_STATES)) {
    // "Georgia" alone is also a country; only count it with US context or a city.
    if (mentionsAny(loc, [name]) && !(name === 'washington' && /washington,? d\.?c/.test(loc))) found.add(code)
  }
  for (const m of String(grant.location || '').matchAll(/,\s*([A-Z]{2})\b/g)) if (Object.values(US_STATES).includes(m[1])) found.add(m[1])
  for (const [city, code] of Object.entries(US_CITIES)) if (mentionsAny(loc, [city]) || mentionsAny(head, [city])) found.add(code)
  if (/nationwide|national|all 50|united states|u\.s\.|usa\b/.test(loc) && found.size > 1) return new Set()
  return found
}

// Location is a hard rule only when the opportunity clearly names other places and not
// the business's own. Unstated or ambiguous = open.
function locationFits(grant, business) {
  const aliases = countryAliases(business.country)
  if (!aliases.length) return true
  if (grant.eligibleCountries?.length) {
    const ok = grant.eligibleCountries.some((c) => mentionsAny(String(c).toLowerCase(), aliases) || /worldwide|global|international|any/i.test(c))
    if (!ok) return false
  } else {
    const text = `${grant.location || ''} ${grant.title || ''}`
    if (/worldwide|global|international/i.test(text)) return true
    const namesACountry = TOP_TIER_RE.test(text) || SECOND_TIER_RE.test(text) || EXCLUDED_COUNTRY_RE.test(text)
    if (namesACountry && !mentionsAny(text.toLowerCase(), aliases)) return false
  }
  // US businesses: a program tied to another state or city isn't open to them.
  if (isUS(business.country)) {
    const states = statesNamed(grant)
    const mine = stateCode(business.state) || US_CITIES[lower(business.city)] || ''
    if (states.size && mine && !states.has(mine)) return false
    if (states.size && !mine) return true
  }
  return true
}

// An opportunity limited to certain founders is open to this business if any founder
// group matches. "minority" covers Black, Latino, Asian American and Native founders.
function demographicsFit(grant, business) {
  const required = (grant.targetDemographics || []).map((d) => (d === 'african_american' ? 'black' : d === 'hispanic' ? 'latino' : d === 'military' ? 'veteran' : d))
  if (!required.length) return { fits: true, matched: [] }
  const mine = new Set(business.founderDemographics || [])
  const matched = required.filter((d) => mine.has(d) || (d === 'minority' && MINORITY_GROUPS.some((g) => mine.has(g))))
  return { fits: matched.length > 0, matched }
}

const lower = (s) => String(s || '').toLowerCase()
const grantText = (g) => lower(`${g.title} ${g.agency} ${g.summary} ${g.why} ${g.requirements}`)

function checkFit(grant, business) {
  const category = categoryOf(grant)
  if ((business.ignoreCategories || []).includes(category)) return { fits: false, reason: 'In a category this business ignores' }
  const text = grantText(grant)
  const hit = (business.ignoreKeywords || []).find((k) => k && text.includes(lower(k).trim()))
  if (hit) return { fits: false, reason: `Mentions "${hit}", which this business ignores` }
  if (grant.applicantTypes?.length && business.entityType && !grant.applicantTypes.includes(business.entityType)) {
    return { fits: false, reason: `Only for ${grant.applicantTypes.join(' or ').replace(/_/g, ' ')} applicants` }
  }
  if (!demographicsFit(grant, business).fits) return { fits: false, reason: `Only for ${grant.targetDemographics.join(', ').replace(/_/g, ' ')} founders` }
  if (!locationFits(grant, business)) return { fits: false, reason: `Limited to ${grant.location || grant.eligibleCountries?.join(', ') || 'another area'}` }
  return { fits: true, category }
}

const STOP = new Set('about after also and are been but business businesses company does each for from have help helps into its more most our over platform provide provides that the their them they this through use using we what when which while who will with your'.split(' '))
const INDUSTRY_WORDS = Object.fromEntries(INDUSTRIES.map((i) => [i.id, lower(i.label).match(/[a-z]{4,}/g) || []]))

// Distinctive words from the profile, used to spot topical matches on opportunities
// that don't list industries. Cached per profile version.
const keywordCache = new Map()
function profileKeywords(business) {
  const cacheKey = `${business._id}:${business.updatedAt ? new Date(business.updatedAt).getTime() : ''}`
  if (keywordCache.has(cacheKey)) return keywordCache.get(cacheKey)
  const words = new Set()
  for (const id of business.industries || []) (INDUSTRY_WORDS[id] || []).forEach((w) => words.add(w))
  for (const w of lower(`${business.description} ${business.useOfFunds}`).match(/[a-z]{5,}/g) || []) if (!STOP.has(w)) words.add(w)
  const list = [...words].slice(0, 40)
  if (keywordCache.size > 500) keywordCache.clear()
  keywordCache.set(cacheKey, list)
  return list
}

const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id

// Industries an opportunity is clearly about, for entries saved before the scraper
// tagged industries. Only strong signals; most general programs match none.
const INDUSTRY_SIGNALS = {
  software: /\b(ethereum|blockchain|web3|crypto\w*|dao|protocol|open[- ]source|developer tools?|saas)\b/i,
  ai: /\b(artificial intelligence|machine learning|\bai\b research|llm)\b/i,
  climate: /\b(climate|clean ?energy|renewable|solar|carbon|decarboni\w+|sustainab\w+ energy)\b/i,
  health: /\b(health ?care|medical|biotech|clinical|life sciences|pharma\w*)\b/i,
  defense: /\b(defen[cs]e|army|navy|air force|dod|darpa|xtech|national security)\b/i,
  food: /\b(food|farm\w*|agricultur\w*|restaurant|bakery|beverage)\b/i,
  arts: /\b(artists?|film|filmmak\w+|music|theat(er|re)|fashion|design fellowship)\b/i,
  education: /\b(education|edtech|teachers?|schools?|students?)\b/i,
  real_estate: /\b(real estate|housing|construction|property)\b/i,
}
function detectIndustries(grant) {
  if (grant.industries?.length) return grant.industries
  const head = `${grant.title || ''} ${grant.agency || ''} ${grant.summary || ''}`
  return Object.keys(INDUSTRY_SIGNALS).filter((id) => INDUSTRY_SIGNALS[id].test(head))
}

function scoreFit(grant, business, category = categoryOf(grant)) {
  let score = 0
  const reasons = []
  const seeking = business.seeking || []

  if (seeking.includes(category)) { score += 3; reasons.push('A type of funding you want') } else if (seeking.length) score -= 1

  const demo = demographicsFit(grant, business)
  if (demo.matched.length) { score += 3; reasons.push(`For ${demo.matched.map((d) => d.replace(/_/g, ' ')).join(' / ')} founders`) }

  const loc = lower(`${grant.location} ${grant.title} ${grant.agency}`)
  if (business.city && loc.includes(lower(business.city))) { score += 3; reasons.push(`In ${business.city}`) }
  else if (business.state && loc.includes(lower(business.state))) { score += 2; reasons.push(`In ${business.state}`) }
  else if (grant.location && mentionsAny(loc, countryAliases(business.country))) score += 1

  const grantIndustries = detectIndustries(grant)
  const sharedIndustries = grantIndustries.filter((i) => (business.industries || []).includes(i))
  if (sharedIndustries.length) { score += 2 + Math.min(sharedIndustries.length - 1, 2); reasons.push('Your industry') }
  else if (grantIndustries.length && business.industries?.length) score -= 3 // clearly about another industry
  else {
    const text = grantText(grant)
    const hits = profileKeywords(business).filter((w) => text.includes(w)).length
    if (hits) { score += Math.min(hits, 3); if (hits >= 2) reasons.push('Matches what you do') }
  }

  if (grant.stages?.length && business.stage) {
    if (grant.stages.includes(business.stage)) { score += 1; reasons.push(`For ${stageLabel(business.stage).toLowerCase()} businesses`) } else score -= 2
  }

  const amount = grant.amountUsd || 0
  if (amount) {
    if (business.amountMin && amount < business.amountMin) score -= 2
    else if (business.amountMax && amount > business.amountMax * 5) score -= 1
    else score += amount >= 100000 ? 3 : amount >= 25000 ? 2 : amount >= 5000 ? 1.5 : 0.5
    if (amount >= 25000) reasons.push(`$${amount.toLocaleString('en-US')}`)
  }

  if (category === 'grant' || category === 'fellowship') score += 1
  if (category === 'competition' && !seeking.includes('competition')) score -= 1

  const reqLen = (grant.requirements || '').length
  if (!reqLen) { score += 1; reasons.push('Little paperwork stated') } else if (reqLen < 200) score += 0.5
  else if (reqLen > 600) score -= 1

  if (grant.rolling) { score += 0.5; reasons.push('Rolling deadline') }
  // Older scrapes kept some news stories about awards already given. They sink to the
  // bottom (new scrapes drop them before saving).
  if (NEWS_TITLE_RE.test(grant.title || '')) { score -= 5; reasons.unshift('Looks like a news story; check it is still open') }
  if (grant.hotLead) score += 0.5

  // Tiny tie-breaker for newly found opportunities; fades within ~10 days.
  if (grant.dateFound) {
    const ageDays = (Date.now() - new Date(grant.dateFound).getTime()) / 86400000
    if (ageDays >= 0) score += Math.max(0, 0.5 - ageDays * 0.05)
  }

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4) }
}

// Fits first, best score first. Each result is the grant plus fit, score, reasons.
function rankForBusiness(grants, business, { includeUnfit = false } = {}) {
  const out = []
  for (const g of grants) {
    const fit = checkFit(g, business)
    if (!fit.fits && !includeUnfit) continue
    const { score, reasons } = scoreFit(g, business)
    out.push({ ...g, category: categoryOf(g), fit: fit.fits, unfitReason: fit.fits ? undefined : fit.reason, score, reasons })
  }
  return out.sort((a, b) => (b.fit - a.fit) || (b.score - a.score))
}

module.exports = { categoryOf, checkFit, scoreFit, rankForBusiness, locationFits, demographicsFit }

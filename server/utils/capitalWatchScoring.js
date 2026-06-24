'use strict'

const { locationTierBonus } = require('../config/capitalWatchGeo')

// Property/housing-based funding isn't a fit right now -- rank near the bottom but
// keep visible. Food trucks/vehicle or equipment financing are physical-asset loans
// we can't act on today either, but worth keeping around for when that changes.
const HOUSING_RE = /\b(housing|property|real estate|homeowner|mortgage|rental assistance|landlord)\b/i
const PHYSICAL_ASSET_RE = /\b(food truck|vehicle financing|vehicle loan|equipment financing|equipment loan|machinery loan|fleet financing|heavy equipment)\b/i

// Pure startup/tech fit scores higher; contest/competition formats (a panel judging a
// submission, e.g. a "climate change short film" contest) score lower -- those take
// real production effort for a low-odds payout, vs. a straightforward grant application.
const STARTUP_TECH_RE = /\b(startup|start-up|software|saas|tech company|technology company|tech startup)\b/i
const CONTEST_RE = /\b(contest|competition|short film|film competition|documentary)\b/i

// Negative weights so these sink to the bottom of the score-sorted list without being
// filtered out entirely -- tune these numbers to change how harshly each category ranks.
const CATEGORY_PRIORITY = {
  housing: -10,
  physical_asset: -8,
}

function categorize(grant) {
  const text = `${grant.title || ''} ${grant.agency || ''} ${grant.summary || ''} ${grant.requirements || ''}`
  if (HOUSING_RE.test(text)) return 'housing'
  if (PHYSICAL_ASSET_RE.test(text)) return 'physical_asset'
  return null
}

// Ranks how well a grant matches this team. Compatibility drives the ranking, not how
// recently it was found: military/veteran or Black/African American-owned eligibility,
// Atlanta/Georgia location, and pure startup/tech fit score highest; US/UK/Thailand
// opportunities outrank Brazil/Latin America ones (both kept, just lower priority); more
// money scores higher; grants and angel-style funding score above loans/accelerators/
// contests; and opportunities with little or no stated paperwork burden score above ones
// with heavy requirements -- biggest payout for least effort, to a team we qualify for,
// ranks first. Contest/competition formats (e.g. a short-film competition) take real
// production effort for low odds, so they score lower. Housing/property and
// physical-asset loans (food trucks, equipment financing) are ranked near the bottom --
// not a fit today, but kept visible for later. Recency only acts as a tiny tie-breaker
// between otherwise similar-fit opportunities.
function scoreGrant(grant) {
  let score = 0
  const demo = grant.targetDemographics || []
  const title = (grant.title || '').toLowerCase()
  const agency = (grant.agency || '').toLowerCase()
  const location = (grant.location || '').toLowerCase()

  if (demo.includes('black') || demo.includes('african_american')) score += 3
  if (demo.includes('veteran') || demo.includes('military')) score += 3
  if (/atlanta|georgia/.test(location) || /atlanta|georgia/.test(title) || /atlanta|georgia/.test(agency)) score += 2
  score += locationTierBonus(grant)

  if (grant.amountUsd >= 100000) score += 4
  else if (grant.amountUsd >= 25000) score += 3
  else if (grant.amountUsd >= 5000) score += 2
  else if (grant.amountUsd >= 1000) score += 1

  if (grant.fundingType === 'grant') score += 2
  if (/\bangel\b/.test(title) || /\bangel\b/.test(agency)) score += 2

  const summary = (grant.summary || '').toLowerCase()
  if (STARTUP_TECH_RE.test(title) || STARTUP_TECH_RE.test(agency) || STARTUP_TECH_RE.test(summary)) score += 2

  if (grant.fundingType === 'loan') score -= 2
  if (grant.fundingType === 'prize' || CONTEST_RE.test(title) || CONTEST_RE.test(summary)) score -= 2
  if (/accelerat/.test(title) || /accelerat/.test(agency)) score -= 1

  const reqLen = (grant.requirements || '').length
  if (!grant.requirements) score += 1
  else if (reqLen < 200) score += 0.5
  else if (reqLen > 600) score -= 1

  if (grant.rolling) score += 0.5

  const category = categorize(grant)
  if (category) score += CATEGORY_PRIORITY[category]

  // Tiny tie-breaker, not a ranking driver -- fades to 0 within ~10 days, so it only
  // separates otherwise-equal-fit opportunities instead of competing with compatibility.
  score += recencyBonus(grant)

  return score
}

function recencyBonus(grant) {
  if (!grant.dateFound) return 0
  const ageDays = (Date.now() - new Date(grant.dateFound).getTime()) / 86400000
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0
  return Math.max(0, 0.5 - ageDays * 0.05)
}

function rankGrants(grants, limit = 10) {
  return [...grants]
    .map((g) => ({ grant: g, score: scoreGrant(g) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.grant)
}

module.exports = { scoreGrant, rankGrants, categorize }

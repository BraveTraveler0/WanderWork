'use strict'

// Ranks how well a grant matches this team: military/veteran or Black/African
// American-owned eligibility and Atlanta/Georgia location score highest, more money
// scores higher (the big differentiator), grants and angel-style funding score above
// loans/accelerators/contests, and opportunities with little or no stated paperwork
// burden score above ones with heavy requirements -- biggest payout for least work,
// to a team we qualify for, ranks first.
function scoreGrant(grant) {
  let score = 0
  const demo = grant.targetDemographics || []
  const title = (grant.title || '').toLowerCase()
  const agency = (grant.agency || '').toLowerCase()
  const location = (grant.location || '').toLowerCase()

  if (demo.includes('black') || demo.includes('african_american')) score += 3
  if (demo.includes('veteran') || demo.includes('military')) score += 3
  if (/atlanta|georgia/.test(location) || /atlanta|georgia/.test(title) || /atlanta|georgia/.test(agency)) score += 2

  if (grant.amountUsd >= 100000) score += 4
  else if (grant.amountUsd >= 25000) score += 3
  else if (grant.amountUsd >= 5000) score += 2
  else if (grant.amountUsd >= 1000) score += 1

  if (grant.fundingType === 'grant') score += 2
  if (/\bangel\b/.test(title) || /\bangel\b/.test(agency)) score += 2

  if (grant.fundingType === 'loan') score -= 2
  if (grant.fundingType === 'prize' || /contest/.test(title)) score -= 1
  if (/accelerat/.test(title) || /accelerat/.test(agency)) score -= 1

  const reqLen = (grant.requirements || '').length
  if (!grant.requirements) score += 1
  else if (reqLen < 200) score += 0.5
  else if (reqLen > 600) score -= 1

  if (grant.rolling) score += 0.5

  return score
}

function rankGrants(grants, limit = 10) {
  return [...grants]
    .map((g) => ({ grant: g, score: scoreGrant(g) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.grant)
}

module.exports = { scoreGrant, rankGrants }

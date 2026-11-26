'use strict'

// Shared reads for Capital Watch: the open-opportunity pool (cached), access-checked
// business lookups, per-business decisions, and ranked matches.

const mongoose = require('mongoose')
const Grant = require('../models/CapitalWatch/capitalWatch.Grant')
const Business = require('../models/CapitalWatch/capitalWatch.Business')
const Decision = require('../models/CapitalWatch/capitalWatch.Decision')
const { rankForBusiness } = require('./capitalWatchMatching')
const { INDUSTRIES, STAGES, ENTITY_TYPES, DEMOGRAPHICS, FUNDING_CATEGORIES } = require('../config/capitalWatchOptions')

// Everything the list, matching and Inanna need; the large legacy draft fields stay out.
const GRANT_FIELDS = 'title agency fundingType amountUsd dueDate rolling location link summary why requirements targetDemographics contactEmail hotLead applicantTypes eligibleCountries industries stages isInvestment status dateFound'

// The pool only changes when the weekly scrape adds to it or the daily job expires
// some, so every dashboard request reads one in-memory copy instead of the database.
const CACHE_MS = 5 * 60 * 1000
let cache = { at: 0, grants: null, pending: null }

async function getOpenGrants() {
  if (cache.grants && Date.now() - cache.at < CACHE_MS) return cache.grants
  if (!cache.pending) {
    cache.pending = Grant.find({ status: { $ne: 'expired' } }).select(GRANT_FIELDS).lean()
      .then((grants) => { cache = { at: Date.now(), grants, pending: null }; return grants })
      .catch((err) => { cache.pending = null; throw err })
  }
  return cache.pending
}

const invalidateGrants = () => { cache = { at: 0, grants: null, pending: null } }

// A business the member belongs to, or null. Never trust an id from the browser alone.
async function businessForMember(member, businessId) {
  if (!mongoose.isValidObjectId(businessId)) return null
  return Business.findOne({ _id: businessId, memberIds: member._id }).lean()
}

async function decisionsFor(businessId) {
  const list = await Decision.find({ business: businessId }).select('grant status updatedAt requirementsChecklist').lean()
  return new Map(list.map((d) => [String(d.grant), d]))
}

// Ranked opportunities this business hasn't decided on yet.
async function matchesFor(business, { includeUnfit = false } = {}) {
  const [grants, decisions] = await Promise.all([getOpenGrants(), decisionsFor(business._id)])
  return rankForBusiness(grants.filter((g) => !decisions.has(String(g._id))), business, { includeUnfit })
}

const label = (list, id) => list.find((o) => o.id === id)?.label || id
const labels = (list, ids) => (ids || []).map((id) => label(list, id)).join(', ')

// The profile as text, for AI drafts and Inanna. Only what the founder wrote or picked.
function businessProfileText(b) {
  const lines = [
    `Business name: ${b.name}`,
    b.website && `Website: ${b.website}`,
    b.description && `What it does: ${b.description}`,
    b.industries?.length && `Industries: ${labels(INDUSTRIES, b.industries)}`,
    b.stage && `Stage: ${label(STAGES, b.stage)}`,
    b.entityType && `Legal type: ${label(ENTITY_TYPES, b.entityType)}`,
    b.foundedYear && `Founded: ${b.foundedYear}`,
    b.teamSize && `Team size: ${b.teamSize}`,
    [b.city, b.state, b.country].filter(Boolean).length && `Location: ${[b.city, b.state, b.country].filter(Boolean).join(', ')}`,
    b.founderDemographics?.length && `Founder backgrounds (eligibility): ${labels(DEMOGRAPHICS, b.founderDemographics)}`,
    b.founders && `Founders: ${b.founders}`,
    b.highlights && `Traction and highlights: ${b.highlights}`,
    b.seeking?.length && `Looking for: ${labels(FUNDING_CATEGORIES, b.seeking)}`,
    (b.amountMin || b.amountMax) && `Amount wanted: ${b.amountMin ? `$${b.amountMin.toLocaleString('en-US')}` : 'any'} to ${b.amountMax ? `$${b.amountMax.toLocaleString('en-US')}` : 'any'}`,
    b.useOfFunds && `Use of funds: ${b.useOfFunds}`,
  ]
  return lines.filter(Boolean).join('\n')
}

module.exports = { GRANT_FIELDS, getOpenGrants, invalidateGrants, businessForMember, decisionsFor, matchesFor, businessProfileText }

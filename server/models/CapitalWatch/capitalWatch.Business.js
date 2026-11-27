const mongoose = require('mongoose')

// A business profile. Opportunities are matched and ranked against it, and every
// decision (applied, saved, dismissed) belongs to a business, so teammates who
// share a business see the same list.
const businessSchema = new mongoose.Schema({
  memberIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'CapitalWatch.Member', index: true },
  // Teammates invited by email who haven't signed in yet; attached when they do.
  pendingInvites: { type: [String], default: [], index: true },

  name:        { type: String, required: true, trim: true },
  website:     { type: String, trim: true, default: '' },
  // What the business does, in the founder's words. Feeds matching and the AI drafts.
  description: { type: String, trim: true, default: '' },
  // Founder names and backgrounds, for applications that ask about the team.
  founders:    { type: String, trim: true, default: '' },
  // Traction, customers, awards: facts the AI may use in drafts.
  highlights:  { type: String, trim: true, default: '' },

  industries:   { type: [String], default: [] },
  stage:        { type: String, default: '' },
  entityType:   { type: String, default: 'for_profit' },
  foundedYear:  { type: Number },
  teamSize:     { type: Number },

  country: { type: String, trim: true, default: 'United States' },
  state:   { type: String, trim: true, default: '' },
  city:    { type: String, trim: true, default: '' },

  founderDemographics: { type: [String], default: [] },

  // What they want. An empty seeking list means "show everything not ignored".
  seeking:        { type: [String], default: [] },
  ignoreCategories: { type: [String], default: [] },
  // Words that hide an opportunity, e.g. "housing", "food truck", "film".
  ignoreKeywords: { type: [String], default: [] },
  amountMin:      { type: Number },
  amountMax:      { type: Number },
  useOfFunds:     { type: String, trim: true, default: '' },
  // Shared team view: everyone on the business sees the same saved and dismissed lists
  // and Outbox discards. Off by default, so each person has their own view.
  sharedView:     { type: Boolean, default: false },
}, {
  collection: 'capitalwatch.businesses',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.Business'] ||
  mongoose.model('CapitalWatch.Business', businessSchema)

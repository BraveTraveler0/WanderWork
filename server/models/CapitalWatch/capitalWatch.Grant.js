const mongoose = require('mongoose')

// A funding opportunity (grant, loan, prize, etc.) discovered by the weekly
// Capital Watch scrape. status moves pending -> approved/rejected via the dashboard.
const capitalWatchGrantSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  agency:      { type: String },
  fundingType: {
    type: String,
    enum: ['grant', 'loan', 'prize', 'contract', 'fellowship', 'stipend', 'scholarship', 'other'],
    default: 'other',
  },
  amountUsd:  { type: Number },
  dueDate:    { type: String },
  rolling:    { type: Boolean, default: false },
  location:   { type: String },
  link:       { type: String, required: true, unique: true },
  summary:    { type: String },
  why:        { type: String },
  // Eligibility / submission requirements stated explicitly in the source text.
  requirements: { type: String },
  // Founder/owner eligibility groups explicitly stated in the source (e.g. "veteran", "women").
  // Empty array means no stated demographic restriction.
  targetDemographics: { type: [String], default: [] },
  contactEmail: { type: String },
  hotLead:      { type: Boolean, default: false },

  // 'archived' = looks good for later, not a fit right now -- pulled out of the main
  // pending list into its own view instead of being approved or rejected.
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived'],
    default: 'pending',
    index: true,
  },
  company: { type: String }, // id from capitalWatchCompanies.js, set on approval

  outreachEmail:        { type: String },
  applicationNarrative: { type: String },
  // One entry per stated requirement, so the approval email shows exactly what the AI
  // already handled vs. what still needs the founder's input (documents, signatures, etc.).
  requirementsChecklist: [{
    requirement: String,
    status: { type: String, enum: ['drafted', 'needs_input', 'not_applicable'] },
    detail: String,
  }],

  dateFound: { type: Date, default: Date.now },

  // Which deadline-warning tiers ('14d', '7d', '3d') have already been emailed for
  // this grant, so the daily deadline check doesn't re-send the same warning every day.
  deadlineAlertsSent: { type: [String], default: [] },
}, {
  collection: 'capitalwatch.grants',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.Grant'] ||
  mongoose.model('CapitalWatch.Grant', capitalWatchGrantSchema)

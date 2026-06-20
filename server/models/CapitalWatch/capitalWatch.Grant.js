const mongoose = require('mongoose')

// A funding opportunity (grant, loan, prize, etc.) discovered by the weekly
// Capital Watch scrape. status moves pending -> approved/rejected via the dashboard.
const capitalWatchGrantSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  agency:      { type: String },
  fundingType: {
    type: String,
    enum: ['grant', 'loan', 'prize', 'contract', 'fellowship', 'stipend', 'other'],
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

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  company: { type: String }, // id from capitalWatchCompanies.js, set on approval

  outreachEmail:        { type: String },
  applicationNarrative: { type: String },

  dateFound: { type: Date, default: Date.now },
}, {
  collection: 'capitalwatch.grants',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.Grant'] ||
  mongoose.model('CapitalWatch.Grant', capitalWatchGrantSchema)

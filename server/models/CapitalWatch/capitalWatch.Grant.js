const mongoose = require('mongoose')

// A funding opportunity (grant, loan, prize, investment program, etc.) found by the
// weekly Capital Watch scrape. Opportunities are shared by everyone; whether one fits
// a business, and what that business decided about it, lives in Decision and the
// matching code, not here.
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

  // Who the opportunity is for, as stated on the page. Empty = not stated (open).
  applicantTypes:    { type: [String], default: [] }, // for_profit, nonprofit, sole_proprietor, individual
  eligibleCountries: { type: [String], default: [] },
  industries:        { type: [String], default: [] }, // ids from capitalWatchOptions INDUSTRIES
  stages:            { type: [String], default: [] }, // ids from capitalWatchOptions STAGES
  // Investment program (angel/VC) rather than a grant or loan.
  isInvestment:      { type: Boolean, default: false },

  // 'pending' = open; 'expired' = the deadline passed (set by the daily job).
  // approved/rejected/archived are from before decisions were per business; the
  // migration script moves them into Decision and resets them to 'pending'.
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'archived', 'expired'],
    default: 'pending',
    index: true,
  },

  // Legacy single-team fields, kept only so the migration can read them.
  company: { type: String },
  outreachEmail:        { type: String },
  applicationNarrative: { type: String },
  requirementsChecklist: [{
    requirement: String,
    status: { type: String, enum: ['drafted', 'needs_input', 'not_applicable'] },
    detail: String,
  }],
  deadlineAlertsSent: { type: [String], default: [] },

  dateFound: { type: Date, default: Date.now },
}, {
  collection: 'capitalwatch.grants',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.Grant'] ||
  mongoose.model('CapitalWatch.Grant', capitalWatchGrantSchema)

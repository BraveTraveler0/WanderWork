const mongoose = require('mongoose')

// An email to someone outside the team (a grant contact, program officer, or
// investor). Inanna and the approval flow only ever create drafts; a person reviews
// and edits the draft in the dashboard's Outbox and clicks Send. Nothing here is
// sent automatically.
const outboundEmailSchema = new mongoose.Schema({
  grant:     { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Grant', index: true },
  grantTitle: { type: String },
  company:   { type: String }, // id from capitalWatchCompanies.js
  to:        { type: String, default: '' },
  subject:   { type: String, default: '' },
  body:      { type: String, default: '' },
  source:    { type: String, enum: ['approval', 'inanna', 'manual'], default: 'manual' },
  status:    { type: String, enum: ['draft', 'sent', 'discarded'], default: 'draft', index: true },
  sentAt:    { type: Date },
  sendError: { type: String },
}, {
  collection: 'capitalwatch.outbox',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.OutboundEmail'] ||
  mongoose.model('CapitalWatch.OutboundEmail', outboundEmailSchema)

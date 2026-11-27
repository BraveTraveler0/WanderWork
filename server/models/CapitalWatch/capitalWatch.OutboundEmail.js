const mongoose = require('mongoose')

// An email to someone outside the business (a grant contact, program officer, or
// investor). Athena and approvals only ever create drafts; a person reviews and edits
// the draft in the Outbox. Admins can send from our domain; everyone else sends it
// from their own email app. Nothing here is sent automatically.
const outboundEmailSchema = new mongoose.Schema({
  business:  { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Business', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Member' },
  grant:     { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Grant', index: true },
  grantTitle: { type: String },
  company:   { type: String }, // legacy: id from capitalWatchCompanies.js
  to:        { type: String, default: '' },
  subject:   { type: String, default: '' },
  body:      { type: String, default: '' },
  source:    { type: String, enum: ['approval', 'athena', 'inanna', 'manual'], default: 'manual' },
  status:    { type: String, enum: ['draft', 'sent', 'discarded'], default: 'draft', index: true },
  // 'server' = sent by us through SendGrid; 'own_email' = marked sent after the
  // member sent it from their own email app.
  sentVia:   { type: String, enum: ['server', 'own_email'] },
  sentAt:    { type: Date },
  sendError: { type: String },
}, {
  collection: 'capitalwatch.outbox',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.OutboundEmail'] ||
  mongoose.model('CapitalWatch.OutboundEmail', outboundEmailSchema)

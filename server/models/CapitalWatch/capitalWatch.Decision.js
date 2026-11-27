const mongoose = require('mongoose')

// What a business (or one person on it) decided about one opportunity. No decision =
// still a match to review. Applying is shared by everyone on the business (member: null).
// Saving and dismissing are personal (member set), so one person's view never changes
// anyone else's.
// 'drafting' is held while the AI writes the application, so it can't run twice.
const decisionSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Business', required: true },
  grant:    { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Grant', required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Member' },
  member:    { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Member', default: null },
  status: { type: String, enum: ['drafting', 'approved', 'archived', 'rejected'], required: true },

  outreachEmail:        { type: String },
  applicationNarrative: { type: String },
  requirementsChecklist: [{
    _id: false,
    requirement: String,
    status: { type: String, enum: ['drafted', 'needs_input', 'not_applicable'] },
    detail: String,
  }],

  // The application form's fields with ready-to-paste answers. source 'page' = read
  // from the opportunity's own form; 'likely' = what this kind of application asks for.
  applicationFields: [{
    _id: false,
    label: String,
    answer: String,
    status: { type: String, enum: ['ready', 'needs_input'] },
    note: String,
    options: [String],
    required: Boolean,
  }],
  fieldsSource: { type: String, enum: ['page', 'likely'] },
  applyUrl: { type: String },

  // Deadline warnings already emailed for this business ('14d', '7d', '3d').
  deadlineAlertsSent: { type: [String], default: [] },
}, {
  collection: 'capitalwatch.decisions',
  timestamps: true,
})

decisionSchema.index({ business: 1, grant: 1, member: 1 }, { unique: true })
decisionSchema.index({ business: 1, status: 1 })

module.exports = mongoose.models['CapitalWatch.Decision'] ||
  mongoose.model('CapitalWatch.Decision', decisionSchema)

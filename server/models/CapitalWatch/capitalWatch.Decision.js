const mongoose = require('mongoose')

// What a business decided about one opportunity. No decision = still a match to review.
// 'drafting' is held while the AI writes the application, so it can't run twice.
const decisionSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Business', required: true },
  grant:    { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Grant', required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CapitalWatch.Member' },
  status: { type: String, enum: ['drafting', 'approved', 'archived', 'rejected'], required: true },

  outreachEmail:        { type: String },
  applicationNarrative: { type: String },
  requirementsChecklist: [{
    _id: false,
    requirement: String,
    status: { type: String, enum: ['drafted', 'needs_input', 'not_applicable'] },
    detail: String,
  }],

  // Deadline warnings already emailed for this business ('14d', '7d', '3d').
  deadlineAlertsSent: { type: [String], default: [] },
}, {
  collection: 'capitalwatch.decisions',
  timestamps: true,
})

decisionSchema.index({ business: 1, grant: 1 }, { unique: true })
decisionSchema.index({ business: 1, status: 1 })

module.exports = mongoose.models['CapitalWatch.Decision'] ||
  mongoose.model('CapitalWatch.Decision', decisionSchema)

const mongoose = require('mongoose')

// Tracks every time a candidate contacts (or is paired with) a recruiter.
// Prevents the same candidate from being shown / emailing the same recruiter twice.
const recruiterContactSchema = new mongoose.Schema({
  candidateId:  { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  recruiterId:  { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  recruiterEmail: { type: String },

  status: {
    type: String,
    enum: ['paired', 'email_sent', 'draft_sent', 'replied', 'skipped'],
    default: 'paired',
  },

  // The actual draft body delivered to the candidate inbox.
  emailBody: { type: String },
  deliveryEmail: { type: String },
  sentAt:    { type: Date },
  tokensUsed: { type: Number, default: 0 },
}, {
  collection: 'jobseeker.recruitercontacts',
  timestamps: true,
})

// Enforce one record per candidate+recruiter pair
recruiterContactSchema.index({ candidateId: 1, recruiterId: 1 }, { unique: true })

module.exports = mongoose.models['JobSeeker.RecruiterContact'] ||
  mongoose.model('JobSeeker.RecruiterContact', recruiterContactSchema)

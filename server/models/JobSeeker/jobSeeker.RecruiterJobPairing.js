const mongoose = require('mongoose')

const recruiterJobPairingSchema = new mongoose.Schema({
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobSeeker.Recruiter',
    required: true,
    index: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobSeeker.Jobs',
    required: true,
    index: true,
  },
  company: { type: String, required: true, index: true },
  normalizedCompany: { type: String, required: true, index: true },
  confidence: { type: Number, default: 100 },
  reason: { type: String },
  pairedAt: { type: Date, default: Date.now, index: true },
  source: { type: String, default: 'mongo' },
  algorithmVersion: { type: String, default: 'company-normalized-v1' },
}, {
  collection: 'jobseeker.recruiterjobpairings',
  timestamps: true,
})

recruiterJobPairingSchema.index({ recruiterId: 1, jobId: 1 }, { unique: true })
recruiterJobPairingSchema.index({ normalizedCompany: 1, confidence: -1 })

module.exports = mongoose.models['JobSeeker.RecruiterJobPairing'] ||
  mongoose.model('JobSeeker.RecruiterJobPairing', recruiterJobPairingSchema)

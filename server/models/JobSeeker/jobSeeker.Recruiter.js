const mongoose = require('mongoose')

const recruiterSchema = new mongoose.Schema({
  airtableId: { type: String, unique: true, sparse: true },
  leadKey:     { type: String, unique: true, sparse: true },

  firstName:   { type: String },
  lastName:    { type: String },
  name:        { type: String, required: true },
  email:       { type: String },
  linkedinUrl: { type: String },
  jobTitle:    { type: String },
  company:     { type: String },
  location:    { type: String },
  source:      { type: String },

  // Derived specialty tag used for candidate matching
  specialty: {
    type: String,
    enum: ['tech', 'creative', 'business', 'healthcare', 'legal', 'general'],
    default: 'general',
    index: true,
  },

  // AI-generated email template from Airtable
  emailTemplate: { type: String },

  status:     { type: String, default: 'active' },
  score:      { type: Number, default: 0 },
  lastSeenAt: { type: Date },
}, {
  collection: 'jobseeker.recruiters',
  timestamps: true,
})

recruiterSchema.index({ specialty: 1, email: 1 })

module.exports = mongoose.models['JobSeeker.Recruiter'] ||
  mongoose.model('JobSeeker.Recruiter', recruiterSchema)

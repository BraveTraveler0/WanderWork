const mongoose = require('mongoose')

const recruiterSchema = new mongoose.Schema({
  airtableId: { type: String, unique: true, sparse: true },
  leadKey:     { type: String, unique: true, sparse: true },

  firstName:   { type: String },
  lastName:    { type: String },
  name:        { type: String, required: true },
  email:       { type: String },
  personalEmail: { type: String },
  mobileNumber: { type: String },
  linkedinUrl: { type: String },
  publicIdentifier: { type: String },
  jobTitle:    { type: String },
  company:     { type: String },
  companyWebsite: { type: String },
  companyDomain: { type: String },
  companyLinkedin: { type: String },
  location:    { type: String },
  city:        { type: String },
  state:       { type: String },
  country:     { type: String },
  source:      { type: String },
  sourceRunId: { type: String },
  headline:    { type: String },
  industry:    { type: String },
  tags:        [{ type: String }],
  contactMethod: { type: String },

  // Derived specialty tag used for candidate matching
  specialty: {
    type: String,
    enum: ['tech', 'creative', 'product', 'data', 'sales', 'operations', 'finance', 'business', 'healthcare', 'legal', 'general'],
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
recruiterSchema.index({ linkedinUrl: 1 })

module.exports = mongoose.models['JobSeeker.Recruiter'] ||
  mongoose.model('JobSeeker.Recruiter', recruiterSchema)

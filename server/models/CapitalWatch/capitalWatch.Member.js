const mongoose = require('mongoose')

// Someone with a Capital Watch account. Accounts are free in exchange for joining
// the marketing list, so consent is recorded with its time and source.
const memberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name:  { type: String, trim: true, default: '' },
  role:  { type: String, enum: ['member', 'admin'], default: 'member' },

  // Optional: accounts can sign in with a password, an emailed link, or both.
  // Never returned by queries unless asked for with .select('+passwordHash').
  passwordHash:  { type: String, select: false },
  emailVerified: { type: Boolean, default: false },

  marketingConsent:   { type: Boolean, default: false },
  marketingConsentAt: { type: Date },
  // Weekly matches digest and deadline alerts. Turned off by the unsubscribe link.
  digestOptOut: { type: Boolean, default: false },

  lastLoginAt: { type: Date },
  // Daily allowances for the AI features, reset when dayKey changes.
  usage: {
    dayKey:    { type: String, default: '' },
    questions: { type: Number, default: 0 },
    drafts:    { type: Number, default: 0 },
  },
}, {
  collection: 'capitalwatch.members',
  timestamps: true,
})

module.exports = mongoose.models['CapitalWatch.Member'] ||
  mongoose.model('CapitalWatch.Member', memberSchema)

const mongoose = require('mongoose')

// A one-time emailed link: 'signin' signs you in, 'reset' lets you set a new password.
// Only a hash of the token is stored, so a database leak can't be used to sign in.
// Unused links are deleted after 20 minutes.
const loginTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  email:     { type: String, required: true, lowercase: true },
  purpose:   { type: String, enum: ['signin', 'reset'], default: 'signin' },
  createdAt: { type: Date, default: Date.now, expires: 60 * 20 },
}, { collection: 'capitalwatch.logintokens', versionKey: false })

module.exports = mongoose.models['CapitalWatch.LoginToken'] ||
  mongoose.model('CapitalWatch.LoginToken', loginTokenSchema)

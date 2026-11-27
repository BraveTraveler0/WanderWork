const mongoose = require('mongoose')

// What Athena read on an opportunity's web page (text, form fields, contact emails),
// kept for a week so applying, re-reading the form, and finding the contact address
// don't fetch the same page again, even across server instances.
const pageCacheSchema = new mongoose.Schema({
  url:         { type: String, required: true, unique: true },
  finalUrl:    { type: String },
  text:        { type: String, default: '' },
  fields:      { type: Array, default: [] },
  applyUrl:    { type: String },
  emails:      { type: [String], default: [] },
  contactPage: { type: String },
  contactChecked: { type: Boolean, default: false },
  failed:      { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now, expires: 7 * 86400 },
}, { collection: 'capitalwatch.pagecache' })

module.exports = mongoose.models['CapitalWatch.PageCache'] ||
  mongoose.model('CapitalWatch.PageCache', pageCacheSchema)

const mongoose = require('mongoose')

// Every scraped page the pipeline has already judged, so the weekly rotation doesn't
// pay the AI to re-read the same "about us" or listing pages each time it comes back
// to a source. Entries expire after 90 days, so a page that later turns into a real
// opportunity is looked at again.
const seenPageSchema = new mongoose.Schema({
  _id:       { type: String }, // normalized URL
  outcome:   { type: String }, // inserted | not_opportunity | no_keywords | ineligible | out_of_region | past_due | duplicate
  checkedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
}, { collection: 'capitalwatch.seenpages', versionKey: false })

module.exports = mongoose.models['CapitalWatch.SeenPage'] ||
  mongoose.model('CapitalWatch.SeenPage', seenPageSchema)

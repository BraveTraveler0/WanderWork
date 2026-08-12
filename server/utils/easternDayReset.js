'use strict'

// For resources that should refill at midnight US Eastern (e.g. daily recruiter
// contact tokens) rather than N*24h after the resource was last touched. Using a
// rolling 24h window means a user who spends their last token at 9 PM doesn't
// refill until ~9 PM the next day instead of at midnight, which is what "remaining
// today" promises them.
const EASTERN_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function easternDateString(date) {
  return EASTERN_DATE_FORMATTER.format(date)
}

// Number of US Eastern calendar-day boundaries crossed between fromDate and toDate.
// DST-safe because it only diffs calendar date strings, never wall-clock durations.
function easternDaysElapsed(fromDate, toDate = new Date()) {
  const fromMs = Date.parse(`${easternDateString(fromDate)}T00:00:00Z`)
  const toMs = Date.parse(`${easternDateString(toDate)}T00:00:00Z`)
  return Math.round((toMs - fromMs) / 86400000)
}

module.exports = { easternDateString, easternDaysElapsed }

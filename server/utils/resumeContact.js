function cleanValue(value) {
  return String(value || '').trim()
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collapseRepeatedLocation(value) {
  const parts = cleanValue(value).split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 4 || parts.length % 2 !== 0) return cleanValue(value)

  const midpoint = parts.length / 2
  const first = parts.slice(0, midpoint).join(', ')
  const second = parts.slice(midpoint).join(', ')
  return first.toLowerCase() === second.toLowerCase() ? first : cleanValue(value)
}

function formatCandidateLocation(location = {}) {
  const label = collapseRepeatedLocation(location.locationName)
  if (label) return label

  const city = cleanValue(location.city)
  const state = cleanValue(location.state)
  if (city && state && new RegExp(`(?:^|,\\s*)${escapeRegex(state)}$`, 'i').test(city)) return city
  return [city, state].filter(Boolean).join(', ')
}

function sanitizeResumeHeader(text, options = {}) {
  if (!text) return text
  const location = cleanValue(options.location)
  const email = cleanValue(options.email)
  const phone = cleanValue(options.phone)
  const contactLines = Array.isArray(options.contactLines)
    ? options.contactLines.map(cleanValue).filter(Boolean)
    : []
  const isSectionHeader = typeof options.isSectionHeader === 'function'
    ? options.isSectionHeader
    : () => false
  const emailTest = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  const emailReplace = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig
  const repeatedLocation = location
    ? new RegExp(`^\\s*${escapeRegex(location)}(?:\\s*[,|;/]\\s*${escapeRegex(location)})+\\s*$`, 'i')
    : null
  let inHeader = true

  const lines = String(text).split('\n')
  const firstSectionIndex = lines.findIndex((line) => isSectionHeader(line.trim()))
  if (contactLines.length && firstSectionIndex >= 0) {
    return [...contactLines, '', ...lines.slice(firstSectionIndex)].join('\n')
  }

  return lines.map((line) => {
    const trimmed = line.trim()
    if (inHeader && isSectionHeader(trimmed)) inHeader = false
    if (!inHeader) return line
    if (repeatedLocation?.test(line)) return location
    let sanitized = email && emailTest.test(line) ? line.replace(emailReplace, email) : line
    if (phone) sanitized = replacePhoneNumbers(sanitized, phone)
    return sanitized
  }).join('\n')
}

function replacePhoneNumbers(text, phone) {
  const replacement = cleanValue(phone)
  if (!text || !replacement) return text
  return String(text).replace(/(?<!\w)\+?\d(?:[ \t().-]*\d){9,14}(?!\w)/g, (match) => {
    return match.replace(/\D/g, '').length >= 10 ? replacement : match
  })
}

function sanitizeDocumentContact(text, options = {}) {
  if (!text) return text
  const email = cleanValue(options.email)
  const phone = cleanValue(options.phone)
  let sanitized = String(text)
  if (email) {
    sanitized = sanitized.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, email)
  }
  return replacePhoneNumbers(sanitized, phone)
}

module.exports = {
  collapseRepeatedLocation,
  formatCandidateLocation,
  sanitizeDocumentContact,
  sanitizeResumeHeader,
}

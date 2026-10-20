// Companies WanderWork will never staff for. Their jobs are skipped by every
// importer, deleted by the purge, and left out of every feed. Add a company by
// adding its name in lowercase; matching ignores case, punctuation and common
// suffixes ("Palantir Technologies Inc." matches "palantir").
const BLOCKED_COMPANIES = [
  'palantir',
];

function normalize(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology|group|holdings)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const BLOCKED = new Set(BLOCKED_COMPANIES.map(normalize));

// Also catches jobs whose company field is missing but whose URL is the
// company's own ATS board (jobs.lever.co/palantir/...).
function isBlockedCompany(company, url = '') {
  if (BLOCKED.has(normalize(company))) return true;
  const u = String(url || '').toLowerCase();
  return BLOCKED_COMPANIES.some((c) => new RegExp(`(?:lever\\.co|greenhouse\\.io|ashbyhq\\.com)/${c}(?:[/?#]|$)`).test(u));
}

// Mongo filter that excludes blocked companies (case-insensitive, any suffix).
function blockedCompanyQuery() {
  return { company: { $not: new RegExp(`^\\s*(${BLOCKED_COMPANIES.join('|')})\\b`, 'i') } };
}

module.exports = { BLOCKED_COMPANIES, isBlockedCompany, blockedCompanyQuery };

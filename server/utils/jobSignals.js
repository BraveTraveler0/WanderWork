'use strict';
// Who can apply, time-zone requirements, pay and a readable summary, pulled
// from a posting at import time. Importers pass every location field the
// source gives plus the FULL description: region and time-zone requirements
// usually sit far below the opening company blurb, so reading only the stored
// 500-character summary misses them.

const US_STATES = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming';
const US_STATE_CODES = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';

// Order matters: it is the display order. US patterns are case-sensitive so
// the pronoun "us" never counts.
const REGIONS = [
  { key: 'US', label: 'US', re: new RegExp(`\\bU\\.S\\.(?:A\\.?)?|\\bUSA\\b|United States|\\bUS\\b|\\b(?:${US_STATES})\\b|,\\s*(?:${US_STATE_CODES})\\b`) },
  { key: 'Canada', label: 'Canada', re: /\bCanad(?:a|ian)\b/i },
  { key: 'North America', label: 'North America', re: /\bNorth America(?:n)?\b|\bNA\b(?= only| time)/i },
  { key: 'LATAM', label: 'LATAM', re: /\bLATAM\b|\bLatin America(?:n)?\b|\bSouth America\b/i },
  { key: 'Americas', label: 'Americas', re: /\bAmericas\b/i },
  { key: 'UK', label: 'UK', re: /\bUK\b|\bUnited Kingdom\b|\bGreat Britain\b|\bEngland\b|\bScotland\b|\bLondon\b/ },
  { key: 'Europe', label: 'Europe', re: /\bEurope(?:an)?\b|\bEU\b|\bEEA\b/ },
  { key: 'EMEA', label: 'EMEA', re: /\bEMEA\b/ },
  { key: 'APAC', label: 'APAC', re: /\bAPAC\b|\bAsia[- ]Pacific\b/i },
  ...['Germany', 'France', 'Spain', 'Portugal', 'Poland', 'Netherlands', 'Ireland', 'Italy', 'Sweden', 'Romania', 'Ukraine', 'Israel', 'India', 'Philippines', 'Singapore', 'Japan', 'Australia', 'New Zealand', 'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Chile', 'South Africa', 'Nigeria', 'Kenya']
    .map((c) => ({ key: c, label: c, re: new RegExp(`\\b${c}\\b`) })),
];
const COUNTRY_KEYS = new Set(REGIONS.slice(9).map((r) => r.key));
const WORLDWIDE = /\bworldwide\b|\banywhere in the world\b|\bwork from anywhere\b|\b(?:fully )?remote[,:-]?\s*(?:global|anywhere)\b|\bglobal(?:ly)?[ -]remote\b|^\s*(?:anywhere|global)\s*$/i;

// Phrases in body text that actually restrict where you can work, as opposed
// to "offices in the US and Europe".
const REQUIREMENT = /(?:based|located|resid(?:e|ing|ent)|living|live|reside|work authori[sz]ation|authori[sz]ed to work|eligible to work|legally (?:able|permitted)|hiring|open to (?:candidates|applicants|people)|candidates|must be|need to be|only|work(?:ing)? from home|remote)\s(?:in|within|from|for)?\s?(?:the\s)?[^.;:]{0,40}?/gi;

function cleanLocationText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function regionsIn(text) {
  return REGIONS.filter((r) => r.re.test(text)).map((r) => r.key);
}

// Region keys from ATS location fields first; body text only where it states
// a requirement ("must be based in the US", "open to candidates in Europe").
function detectRegions(locationTexts, title, fullText) {
  const loc = [title, ...locationTexts].map(cleanLocationText).filter(Boolean).join(' | ');
  const found = new Set(regionsIn(loc));
  const body = String(fullText || '').slice(0, 8000);
  let m;
  REQUIREMENT.lastIndex = 0;
  while ((m = REQUIREMENT.exec(body))) {
    const window = body.slice(m.index, m.index + m[0].length + 45);
    for (const key of regionsIn(window)) found.add(key);
  }
  // A country already implies its region; keep the specific one.
  if (found.has('US') && found.has('North America') && !found.has('Canada')) found.delete('North America');
  return [...found];
}

function isWorldwide(locationTexts, fullText) {
  if (locationTexts.some((t) => WORLDWIDE.test(cleanLocationText(t)))) return true;
  return /\b(?:work from anywhere|anywhere in the world|hire (?:globally|anywhere)|open to candidates worldwide)\b/i.test(String(fullText || '').slice(0, 8000));
}

// Short label for the job row: "US only", "US, Canada", "Europe", "Worldwide".
function scopeLabel(regions, worldwide) {
  if (!regions.length) return worldwide ? 'Worldwide' : null;
  if (regions.length === 1) return regions[0] === 'US' ? 'US only' : regions[0];
  const shown = regions.slice(0, 3);
  return shown.join(', ') + (regions.length > 3 ? ` +${regions.length - 3}` : '');
}

const TZ_PATTERNS = [
  // "UTC-5 to UTC+1", "GMT+2 ± 3 hours", "between UTC−3 and UTC+3"
  /\b(?:UTC|GMT)\s?[+\-−–]\s?\d{1,2}(?::\d{2})?(?:\s?(?:to|and|-|–)\s?(?:UTC|GMT)?\s?[+\-−–]\s?\d{1,2}(?::\d{2})?)?(?:\s?(?:±|\+\/-)\s?\d{1,2}\s?hours?)?/i,
  // "US time zones", "European time zone", "CET timezone", "Americas time zones"
  /\b(?:US|U\.S\.|North American?|American|European|EU|EMEA|APAC|Americas|LATAM|Eastern|Central|Mountain|Pacific|CET|CEST|EST|EDT|PST|PDT|CST|MST|ET|PT|CT|GMT|BST|IST|AEST)\s(?:time\s?zones?|timezones?|business hours|working hours|hours)\b/i,
  // "overlap with EST", "4 hours of overlap with PST"
  /\b(?:\d+\+?\s(?:hours?|hrs?)\s(?:of\s)?)?overlap\s(?:with\s)?(?:the\s)?(?:US|EST|ET|PST|PT|CST|CET|UTC|GMT|Eastern|Pacific|Central|European|East Coast|West Coast)\b[^.;,]{0,20}/i,
  // "9am-5pm EST", "8:00 - 4:30pm (CST)"
  /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)?\s?(?:-|–|to)\s?\d{1,2}(?::\d{2})?\s?(?:am|pm)\s?\(?(?:EST|EDT|ET|CST|CDT|CT|MST|MT|PST|PDT|PT|CET|GMT|UTC)\)?/i,
];

function detectTimezone(locationTexts, fullText) {
  const hay = `${locationTexts.join(' | ')} | ${String(fullText || '').slice(0, 12000)}`;
  for (const re of TZ_PATTERNS) {
    const m = hay.match(re);
    if (m) {
      const phrase = m[0].replace(/\s+/g, ' ').replace(/[−–]/g, '-').trim();
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }
  return null;
}

// "$115,000 - $165,000", "$120K – $150K", "€60.000 - €80.000", "$25 - $35 per hour"
const PAY_RE = /([$€£])\s?(\d{1,3}(?:[,.]\d{3})+|\d{2,3}(?:\.\d)?\s?[kK])\s?(?:USD|CAD|EUR|GBP)?\s?(?:-|–|—|to)\s?\1?\s?(\d{1,3}(?:[,.]\d{3})+|\d{2,3}(?:\.\d)?\s?[kK])(?:\s?(?:USD|CAD|EUR|GBP))?(\s?(?:\/|per)\s?(?:year|yr|annum|hour|hr|month))?|([$€£])\s?(\d{2,3}(?:\.\d{1,2})?)\s?(?:-|–|to)\s?\5?\s?(\d{2,3}(?:\.\d{1,2})?)\s?(?:\/|per)\s?(?:hour|hr)/;

function extractSalaryFromText(fullText) {
  const m = String(fullText || '').match(PAY_RE);
  if (!m) return null;
  if (m[1]) {
    const unit = m[4] ? ` / ${/hour|hr/i.test(m[4]) ? 'hour' : /month/i.test(m[4]) ? 'month' : 'year'}` : '';
    return `${m[1]}${m[2].replace(/\s/g, '')} – ${m[1]}${m[3].replace(/\s/g, '')}${unit}`;
  }
  return `${m[5]}${m[6]} – ${m[5]}${m[7]} / hour`;
}

function formatRange(min, max, currency = 'USD', interval = '') {
  const sym = { USD: '$', CAD: 'CA$', EUR: '€', GBP: '£', AUD: 'A$' }[currency] || `${currency} `;
  const fmt = (n) => `${sym}${Math.round(n).toLocaleString('en-US')}`;
  const unit = /hour/i.test(interval) ? ' / hour' : /month/i.test(interval) ? ' / month' : /year|salary|annual/i.test(interval) ? ' / year' : '';
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}${unit}`;
  if (min || max) return `${fmt(min || max)}${unit}`;
  return null;
}

// Start the summary at the role itself when the posting opens with a company
// blurb, and drop ATS metadata ("Requisition #: ...", "#LI-Remote").
const ROLE_HEADING = /\b(?:About the (?:Role|Job|Position|Opportunity)|The Role|Your Role|Role Overview|Position Overview|The Opportunity|What You['’]ll Do|What you will do|In this role|Job Summary|Position Summary|Role Summary|Job Description)\b\s*:?\s*/gi;

// A heading, not the same words mid-sentence ("...learn more about the role"):
// it starts with a capital and the text after it starts a new sentence.
function findRoleHeading(s) {
  ROLE_HEADING.lastIndex = 0;
  let m;
  while ((m = ROLE_HEADING.exec(s))) {
    const next = s.charAt(m.index + m[0].length);
    if (/[A-Z]/.test(m[0][0]) && /[A-Z0-9"“•-]/.test(next)) return { index: m.index, length: m[0].length };
  }
  return null;
}
const META_LABEL = /\b(?:(?:Job )?Requisition(?: #| ID| Number)?|Req(?:uisition)? ?ID|Job (?:ID|Code|Number|Family|Category)|Functional Area|Department|Employment Type|Position Type|Work Options|Work Location|Work Arrangement|Work Hours|Work Schedule|Schedule|Shift|Travel|Location)\s*#?\s*:?/gi;
// WeWorkRemotely bodies open with "Headquarters: Casper, WY URL: https://..."
const WWR_HEADER = /^Headquarters:\s.{0,80}?\sURL:\s\S+\s*/i;

function stripMetadata(text, title) {
  let s = text.replace(WWR_HEADER, '');
  const labels = Array.from(s.slice(0, 600).matchAll(META_LABEL));
  if (labels.length >= 2) {
    const last = labels[labels.length - 1];
    const rest = s.slice((last.index || 0) + last[0].length);
    const starts = [
      title ? rest.toLowerCase().indexOf(title.toLowerCase()) : -1,
      rest.search(/\bAbout (?:the|us|our|[A-Z])/),
      rest.search(/\b(?:We are|We're|Our |As an? |In this role|You will|Join )/),
      (() => { const h = findRoleHeading(rest); return h ? h.index : -1 })(),
    ].filter((i) => i > 0);
    // No clear prose start: drop the labels at least, keeping the text after them.
    s = starts.length ? rest.slice(Math.min(...starts)) : rest;
  } else if (labels.length === 1 && (labels[0].index || 0) < 3 && /Requisition|Req|Job (?:ID|Code|Number)/i.test(labels[0][0])) {
    // A lone "Job Requisition ID # 26WD95687" at the very start.
    s = s.slice(labels[0][0].length).replace(/^\s*#?\s*[\w-]+\s*/, '');
  }
  return s.trim();
}

function buildSummary(fullText, title = '', maxLen = 500) {
  let s = String(fullText || '').replace(/#(?:LI|BI|IND|ZR)-[\w-]+/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = stripMetadata(s, title);
  const heading = findRoleHeading(s);
  // Skip a company blurb when the role section starts reasonably early.
  if (heading && heading.index < 2500) s = s.slice(heading.index + heading.length);
  if (title && s.toLowerCase().startsWith(title.toLowerCase())) s = s.slice(title.length);
  s = s.replace(/^[\s:;,.\-–|•]+/, '');
  // "About Acme Acme is a ..." -> "Acme is a ..."
  s = s.replace(/^About (.{2,60}?) (?=\1\b)/, '');
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const last = cut.search(/[.!?][^.!?]*$/);
  return last > 120 ? cut.slice(0, last + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

// Everything an importer stores about where and when the job can be worked.
function jobSignals({ title = '', locationTexts = [], fullText = '' }) {
  const locs = locationTexts.map(cleanLocationText).filter(Boolean);
  const regions = detectRegions(locs, title, fullText);
  const worldwide = !regions.length && isWorldwide(locs, fullText);
  return {
    remote_regions: regions,
    remote_scope: scopeLabel(regions, worldwide),
    timezone_req: detectTimezone(locs, fullText),
  };
}

// Display location: keep the region detail the source gave ("Remote - US"),
// instead of collapsing every remote job to just "Remote". A remote job whose
// source location is only an office ("New York, NY (HQ)") reads "Remote - US".
function remoteLocation(loc, scope) {
  const l = displayLocation(loc);
  const worldwideText = /anywhere|worldwide|global/i.test(l);
  if (worldwideText && scope && scope !== 'Worldwide') return `Remote - ${scope.replace(/ only$/, '')}`;
  if (/remote|anywhere|worldwide/i.test(l)) return l;
  if (!scope) return 'Remote';
  return scope === 'Worldwide' ? 'Remote - Worldwide' : `Remote - ${scope.replace(/ only$/, '')}`;
}

function displayLocation(loc) {
  const l = cleanLocationText(loc).replace(/\s+\d{5}(-\d{4})?$/, '');
  if (!l || /^(remote|anywhere|worldwide|global|-)$/i.test(l)) return 'Remote';
  return l.length > 80 ? `${l.slice(0, 77)}…` : l;
}

module.exports = {
  jobSignals,
  detectRegions,
  detectTimezone,
  extractSalaryFromText,
  formatRange,
  buildSummary,
  displayLocation,
  remoteLocation,
  scopeLabel,
  COUNTRY_KEYS,
};

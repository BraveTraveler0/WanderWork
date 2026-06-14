'use strict'

// ---------------------------------------------------------------------------
// Skill Graph
// ---------------------------------------------------------------------------
// Two responsibilities:
// 1. Alias normalization — "AP" → "accounts payable", "React.js" → "react"
// 2. Skill-to-cluster mapping — which clusters a skill is evidence for
// ---------------------------------------------------------------------------

// Each entry: canonical (lowercase) → array of aliases (lowercase)
const SKILL_ALIASES = {
  // Frontend
  'javascript': ['js', 'es6', 'es2015', 'ecmascript', 'vanilla js', 'vanilla javascript'],
  'typescript': ['ts'],
  'react': ['react.js', 'reactjs', 'react native'],
  'next.js': ['nextjs', 'next js'],
  'vue': ['vue.js', 'vuejs'],
  'angular': ['angularjs', 'angular.js'],
  'css': ['css3', 'scss', 'sass', 'less', 'tailwind', 'tailwindcss'],
  'html': ['html5'],
  'webflow': ['webflow.com'],
  'framer': ['framer motion', 'framer x'],
  'node.js': ['node', 'nodejs', 'node js'],

  // Backend
  'python': ['py'],
  'postgresql': ['postgres', 'psql'],
  'mongodb': ['mongo'],
  'graphql': ['graph ql'],
  'rest api': ['restful api', 'rest apis', 'rest'],
  'docker': ['containerization'],
  'kubernetes': ['k8s'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud', 'google cloud platform'],

  // Design tools
  'figma': ['figma.com', 'figjam'],
  'sketch': [],
  'adobe xd': ['xd', 'adobe experience design'],
  'adobe illustrator': ['illustrator', 'ai'],
  'adobe photoshop': ['photoshop', 'ps'],
  'adobe after effects': ['after effects', 'ae'],
  'invision': ['invisionapp'],
  'zeplin': [],
  'storybook': [],
  'miro': [],
  'maze': [],
  'hotjar': [],

  // Design concepts
  'ux research': ['user research', 'usability research'],
  'user testing': ['usability testing', 'user interviews'],
  'wireframing': ['wireframes', 'wireframe'],
  'prototyping': ['prototypes', 'prototype'],
  'design systems': ['component library', 'design system', 'ui kit', 'ui library'],
  'accessibility': ['a11y', 'wcag', 'ada compliance'],
  'information architecture': ['ia', 'site architecture'],
  'interaction design': ['ixd'],

  // Writing / Comms
  'press releases': ['media release', 'pr release', 'press release'],
  'media relations': ['earned media', 'journalist relations', 'press relations'],
  'public relations': ['pr', 'communications', 'comms'],
  'seo': ['search engine optimization'],
  'sem': ['search engine marketing', 'paid search', 'google ads', 'ppc'],
  'copywriting': ['copy', 'marketing copy', 'ad copy'],
  'content strategy': ['content strategist', 'editorial strategy'],
  'email marketing': ['email campaigns', 'drip campaigns', 'newsletters'],

  // Accounting / Finance
  'accounts payable': ['ap', 'invoice processing', 'vendor payments', 'ap specialist'],
  'accounts receivable': ['ar', 'ar specialist', 'collections', 'billing'],
  'bookkeeping': ['general ledger', 'ledger', 'journal entries'],
  'quickbooks': ['quickbooks online', 'qbo', 'intuit'],
  'excel': ['microsoft excel', 'spreadsheets'],
  'financial modeling': ['financial models', 'dcf', 'valuation'],
  'sql': ['mysql', 'sqlite', 'mssql', 'sql server', 't-sql'],
  'r': ['r programming', 'rstudio'],
  'data analysis': ['data analytics', 'data analysis', 'analytics'],
}

// Reverse alias map: alias → canonical (built at startup)
const ALIAS_TO_CANONICAL = {}
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  ALIAS_TO_CANONICAL[canonical] = canonical
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias] = canonical
  }
}

/**
 * Normalize a skill string to its canonical lowercase form.
 * "React.js" → "react", "AP" → "accounts payable", etc.
 */
function normalizeSkill(skill) {
  const lower = String(skill || '').toLowerCase().trim()
  return ALIAS_TO_CANONICAL[lower] ?? lower
}

/**
 * Normalize + deduplicate an array of skill strings.
 */
function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return []
  return [...new Set(skills.map(normalizeSkill).filter(Boolean))]
}

/**
 * Expand a skill list with all known aliases so keyword matching
 * against job text finds more hits.
 */
function expandSkillsWithAliases(skills) {
  const expanded = new Set(skills)
  for (const skill of skills) {
    const canonical = ALIAS_TO_CANONICAL[skill] ?? skill
    // add canonical
    expanded.add(canonical)
    // add all aliases of the canonical
    const aliases = SKILL_ALIASES[canonical] || []
    for (const a of aliases) expanded.add(a)
  }
  return [...expanded].filter(Boolean)
}

module.exports = { normalizeSkill, normalizeSkills, expandSkillsWithAliases }

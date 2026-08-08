'use strict'

// ---------------------------------------------------------------------------
// Bridge Rules
// ---------------------------------------------------------------------------
// Defines which skills provide evidence that a candidate in cluster A can
// credibly do work in cluster B.  Used when role distance is 2–3 to either
// unlock an otherwise-hidden job or boost the bridge score component.
//
// Each bridge entry has:
//   from  : candidate cluster id
//   to    : job cluster id
//   skills: { skillName: weight (0–1) }
//   thresholds:
//     show    : minimum total score to surface the job at all (distance 2–3)
//     adjacent: score at which matchType upgrades from 'stretch' → 'adjacent'
//     strong  : score at which match is considered well-supported
// ---------------------------------------------------------------------------

const BRIDGES = [
  // ── Design → Frontend ────────────────────────────────────────────────────
  // A designer who codes can cross into frontend / design-engineering roles.
  {
    from: 'ux_design',
    to: 'frontend',
    skills: {
      'react': 0.25,
      'next.js': 0.20,
      'javascript': 0.18,
      'typescript': 0.20,
      'html': 0.10,
      'css': 0.12,
      'webflow': 0.12,
      'framer': 0.12,
      'design systems': 0.18,
      'storybook': 0.18,
      'accessibility': 0.12,
      'node.js': 0.10,
    },
    thresholds: { show: 0.25, adjacent: 0.45, strong: 0.65 },
  },
  {
    from: 'ui_visual',
    to: 'frontend',
    skills: {
      'html': 0.15,
      'css': 0.18,
      'javascript': 0.20,
      'react': 0.22,
      'webflow': 0.18,
      'framer': 0.15,
      'design systems': 0.15,
      'storybook': 0.15,
      'accessibility': 0.12,
    },
    thresholds: { show: 0.25, adjacent: 0.45, strong: 0.60 },
  },
  {
    from: 'design_systems',
    to: 'frontend',
    skills: {
      'react': 0.25,
      'typescript': 0.22,
      'storybook': 0.25,
      'css': 0.15,
      'html': 0.12,
      'design systems': 0.25,
      'javascript': 0.18,
      'accessibility': 0.15,
    },
    thresholds: { show: 0.20, adjacent: 0.35, strong: 0.55 },
  },

  // ── Frontend → Design ────────────────────────────────────────────────────
  // A frontend engineer with design skills can cross into product/UI design.
  {
    from: 'frontend',
    to: 'ux_design',
    skills: {
      'figma': 0.28,
      'ux research': 0.22,
      'wireframing': 0.20,
      'prototyping': 0.22,
      'design systems': 0.22,
      'accessibility': 0.15,
      'user testing': 0.18,
      'interaction design': 0.20,
    },
    thresholds: { show: 0.30, adjacent: 0.50, strong: 0.70 },
  },
  {
    from: 'frontend',
    to: 'ui_visual',
    skills: {
      'figma': 0.25,
      'css': 0.15,
      'design systems': 0.20,
      'accessibility': 0.12,
      'prototyping': 0.18,
      'wireframing': 0.15,
    },
    thresholds: { show: 0.25, adjacent: 0.45, strong: 0.60 },
  },
  {
    from: 'frontend',
    to: 'design_systems',
    skills: {
      'react': 0.22,
      'storybook': 0.25,
      'design systems': 0.25,
      'figma': 0.20,
      'typescript': 0.18,
      'accessibility': 0.15,
      'css': 0.15,
    },
    thresholds: { show: 0.20, adjacent: 0.40, strong: 0.60 },
  },

  // ── Backend → Fullstack ──────────────────────────────────────────────────
  // Backend engineers with any frontend exposure can see fullstack roles.
  {
    from: 'backend',
    to: 'fullstack',
    skills: {
      'react': 0.25,
      'next.js': 0.22,
      'javascript': 0.20,
      'typescript': 0.20,
      'vue': 0.18,
      'angular': 0.18,
      'css': 0.12,
      'html': 0.10,
    },
    thresholds: { show: 0.18, adjacent: 0.35, strong: 0.55 },
  },

  // ── Fullstack → Backend ──────────────────────────────────────────────────
  {
    from: 'fullstack',
    to: 'backend',
    skills: {
      'node.js': 0.20,
      'python': 0.20,
      'rest api': 0.18,
      'graphql': 0.18,
      'postgresql': 0.18,
      'mongodb': 0.15,
      'docker': 0.15,
      'aws': 0.15,
      'sql': 0.15,
    },
    thresholds: { show: 0.15, adjacent: 0.30, strong: 0.50 },
  },

  // ── Backend → Frontend ───────────────────────────────────────────────────
  // Harder crossing — requires real frontend evidence
  {
    from: 'backend',
    to: 'frontend',
    skills: {
      'react': 0.28,
      'next.js': 0.25,
      'typescript': 0.22,
      'javascript': 0.20,
      'vue': 0.20,
      'css': 0.15,
      'html': 0.12,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },

  // ── Design → Marketing ───────────────────────────────────────────────────
  {
    from: 'ux_design',
    to: 'marketing',
    skills: {
      'copywriting': 0.20,
      'seo': 0.18,
      'content strategy': 0.22,
      'email marketing': 0.15,
      'brand': 0.15,
      'storytelling': 0.15,
    },
    thresholds: { show: 0.20, adjacent: 0.40, strong: 0.60 },
  },
  {
    from: 'brand_creative',
    to: 'marketing',
    skills: {
      'copywriting': 0.18,
      'seo': 0.15,
      'content strategy': 0.20,
      'email marketing': 0.15,
      'social media': 0.18,
      'brand': 0.22,
    },
    thresholds: { show: 0.20, adjacent: 0.35, strong: 0.55 },
  },

  // ── Writing → Marketing ──────────────────────────────────────────────────
  {
    from: 'content_writing',
    to: 'marketing',
    skills: {
      'seo': 0.22,
      'email marketing': 0.20,
      'content strategy': 0.22,
      'copywriting': 0.20,
      'social media': 0.18,
      'analytics': 0.15,
    },
    thresholds: { show: 0.20, adjacent: 0.35, strong: 0.55 },
  },

  // ── Accounting → Finance ─────────────────────────────────────────────────
  {
    from: 'accounting',
    to: 'finance',
    skills: {
      'financial modeling': 0.25,
      'excel': 0.15,
      'sql': 0.18,
      'data analysis': 0.20,
      'r': 0.22,
      'python': 0.20,
      'forecasting': 0.22,
    },
    thresholds: { show: 0.15, adjacent: 0.30, strong: 0.50 },
  },

  // ── Finance / Accounting → Data/ML ──────────────────────────────────────
  {
    from: 'finance',
    to: 'data_ml',
    skills: {
      'python': 0.25,
      'r': 0.25,
      'sql': 0.22,
      'statistics': 0.22,
      'machine learning': 0.25,
      'data analysis': 0.20,
      'financial modeling': 0.18,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },

  // ── Sales → Marketing ────────────────────────────────────────────────────
  {
    from: 'sales',
    to: 'marketing',
    skills: {
      'content strategy': 0.18,
      'seo': 0.15,
      'email marketing': 0.18,
      'copywriting': 0.15,
      'social media': 0.15,
    },
    thresholds: { show: 0.25, adjacent: 0.45, strong: 0.60 },
  },
  {
    from: 'project_ops',
    to: 'frontend',
    skills: {
      'javascript': 0.22, 'typescript': 0.22, 'react': 0.25,
      'next.js': 0.20, 'vue': 0.20, 'angular': 0.20,
      'html': 0.12, 'css': 0.12,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },
  {
    from: 'project_ops',
    to: 'fullstack',
    skills: {
      'javascript': 0.18, 'typescript': 0.18, 'react': 0.20,
      'node.js': 0.22, 'python': 0.20, 'sql': 0.15,
      'postgresql': 0.15, 'mongodb': 0.15,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },
  {
    from: 'project_ops',
    to: 'backend',
    skills: {
      'python': 0.25, 'java': 0.25, 'node.js': 0.22,
      'c#': 0.22, 'c++': 0.22, 'go': 0.22, 'ruby': 0.20,
      'rest api': 0.18, 'sql': 0.15,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },
  {
    from: 'project_ops',
    to: 'platform',
    skills: {
      'aws': 0.22, 'azure': 0.22, 'gcp': 0.22,
      'docker': 0.20, 'kubernetes': 0.25, 'terraform': 0.25,
      'devops': 0.25, 'ci/cd': 0.18,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },
  {
    from: 'project_ops',
    to: 'data_ml',
    skills: {
      'python': 0.22, 'sql': 0.20, 'r': 0.20,
      'machine learning': 0.25, 'data analysis': 0.18,
      'data engineering': 0.22, 'tensorflow': 0.22, 'pytorch': 0.22,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },
  {
    from: 'project_ops',
    to: 'mobile',
    skills: {
      'swift': 0.30, 'swiftui': 0.25, 'kotlin': 0.30,
      'react native': 0.25, 'flutter': 0.25,
      'ios': 0.18, 'android': 0.18,
    },
    thresholds: { show: 0.35, adjacent: 0.55, strong: 0.70 },
  },
]

// Index by from:to for O(1) lookup
const BRIDGE_INDEX = {}
for (const bridge of BRIDGES) {
  const key = `${bridge.from}:${bridge.to}`
  BRIDGE_INDEX[key] = bridge
}

/**
 * Calculate bridge evidence score for a candidate crossing from one cluster to another.
 *
 * @param {string[]} candidateSkills - normalized skill list
 * @param {string} fromCluster - candidate's detected cluster id
 * @param {string} toCluster - job's detected cluster id
 * @returns {{ score: number, evidenceSkills: string[], threshold: object } | null}
 *   score: 0–1 (sum of matched skill weights, capped at 1)
 *   null if no bridge rule exists for this pair
 */
function getBridgeEvidence(candidateSkills, fromCluster, toCluster) {
  const key = `${fromCluster}:${toCluster}`
  const bridge = BRIDGE_INDEX[key]
  if (!bridge) return null

  const skillSet = new Set(candidateSkills.map(s => s.toLowerCase()))
  const evidenceSkills = []
  let score = 0

  for (const [skill, weight] of Object.entries(bridge.skills)) {
    if (skillSet.has(skill)) {
      score += weight
      evidenceSkills.push(skill)
    }
  }

  return {
    score: Math.min(1, score),
    evidenceSkills,
    thresholds: bridge.thresholds,
  }
}

/**
 * Given a bridge evidence result and the role distance, determine whether
 * the job should be shown and what effective match type label applies.
 *
 * Returns { show: bool, matchType: string, bridgeScore: number }
 */
function evaluateBridge(evidence, distance) {
  if (!evidence) {
    // No bridge rule — apply default thresholds by distance
    if (distance <= 1) return { show: true, matchType: distance === 0 ? 'direct' : 'adjacent', bridgeScore: 1 }
    if (distance === 2) return { show: false, matchType: 'stretch', bridgeScore: 0 }
    return { show: false, matchType: 'stretch', bridgeScore: 0 }
  }

  const { score, thresholds } = evidence

  if (distance <= 1) {
    // Same or very close cluster — always show, bridge is a bonus
    const matchType = distance === 0 ? 'direct' : 'adjacent'
    return { show: true, matchType, bridgeScore: score }
  }

  if (score < thresholds.show) {
    return { show: false, matchType: 'stretch', bridgeScore: score }
  }

  let matchType = 'stretch'
  if (score >= thresholds.adjacent) matchType = 'adjacent'

  return { show: true, matchType, bridgeScore: score }
}

module.exports = { getBridgeEvidence, evaluateBridge }

'use strict'

// ---------------------------------------------------------------------------
// Role Ontology
// ---------------------------------------------------------------------------
// Defines role clusters, how to detect them from a job/candidate title,
// and graded distances between clusters (0 = same, 5 = hard block).
//
// Detection order matters — more-specific patterns come before catch-alls so
// "frontend engineer" maps to 'frontend', not 'backend' (which holds the
// generic "engineer" pattern).
// ---------------------------------------------------------------------------

const CLUSTERS = [
  // ── Design family ────────────────────────────────────────────────────────
  {
    id: 'ux_design',
    label: 'UX / Product Design',
    patterns: [
      /\bux\s+designer\b/i,
      /\bproduct\s+designer\b/i,
      /\buser\s+experience\s+designer\b/i,
      /\binteraction\s+designer\b/i,
      /\bexperience\s+designer\b/i,
      /\bservice\s+designer\b/i,
    ],
  },
  {
    id: 'ui_visual',
    label: 'UI / Visual / Graphic Design',
    patterns: [
      /\bui\s+designer\b/i,
      /\bvisual\s+designer\b/i,
      /\bgraphic\s+designer\b/i,
      /\bweb\s+designer\b/i,
      /\bdigital\s+designer\b/i,
      /\binterface\s+designer\b/i,
      /\bbrand\s+designer\b/i,
      /\bprint\s+designer\b/i,
    ],
  },
  {
    id: 'design_systems',
    label: 'Design Systems / Design Engineering',
    patterns: [
      /\bdesign\s+systems?\b/i,
      /\bdesign\s+engineer\b/i,
      /\bux\s+engineer\b/i,
    ],
  },
  {
    id: 'design_content',
    label: 'Content Design / UX Writing',
    patterns: [
      /\bcontent\s+designer\b/i,
      /\bux\s+writer\b/i,
    ],
  },
  {
    id: 'brand_creative',
    label: 'Creative / Art Direction / Motion',
    patterns: [
      /\bcreative\s+director\b/i,
      /\bart\s+director\b/i,
      /\billustrator\b/i,
      /\bvisual\s+artist\b/i,
      /\b3d\s+artist\b/i,
      /\bconcept\s+artist\b/i,
      /\bstoryboard\b/i,
      /\bmotion\s+designer\b/i,
      /\bmotion\s+graphic/i,
      /\banimator\b/i,
      /\bvideo\s+editor\b/i,
      /\bfilmmaker\b/i,
      /\bphotographer\b/i,
    ],
  },
  // "designer" catch-all — sits after all specific design clusters
  {
    id: 'ux_design',
    label: 'UX / Product Design (general)',
    patterns: [/\bdesigner\b/i],
  },

  // ── Engineering family ────────────────────────────────────────────────────
  // Platform / DevOps before backend so "platform engineer" → platform, not backend
  {
    id: 'platform',
    label: 'Platform / DevOps / Infrastructure',
    patterns: [
      /\bdevops\b/i,
      /\bsite\s+reliability\b/i,
      /\bsre\b/i,
      /\bplatform\s+engineer\b/i,
      /\binfrastructure\s+engineer\b/i,
      /\bcloud\s+engineer\b/i,
      /\bcloud\s+architect\b/i,
    ],
  },
  // Data / ML before backend
  {
    id: 'data_ml',
    label: 'Data / ML / AI Engineering',
    patterns: [
      /\bdata\s+engineer\b/i,
      /\bml\s+engineer\b/i,
      /\bmachine\s+learning\s+engineer\b/i,
      /\bai\s+engineer\b/i,
      /\bdata\s+scientist\b/i,
      /\bresearch\s+scientist\b/i,
    ],
  },
  // Mobile before backend
  {
    id: 'mobile',
    label: 'Mobile Engineering',
    patterns: [
      /\bios\s+engineer\b/i,
      /\bandroid\s+engineer\b/i,
      /\bmobile\s+engineer\b/i,
      /\bios\s+developer\b/i,
      /\bandroid\s+developer\b/i,
      /\bmobile\s+developer\b/i,
    ],
  },
  // Frontend before fullstack before backend
  {
    id: 'frontend',
    label: 'Frontend Engineering',
    patterns: [
      /\bfrontend\s+engineer\b/i,
      /\bfront.end\s+engineer\b/i,
      /\bfrontend\s+developer\b/i,
      /\bfront.end\s+developer\b/i,
      /\bui\s+engineer\b/i,
      /\bweb\s+developer\b/i,
      /\bweb\s+engineer\b/i,
      /\breact\s+developer\b/i,
      /\bjavascript\s+developer\b/i,
      /\btypescript\s+developer\b/i,
      /\bvue\s+developer\b/i,
      /\bangular\s+developer\b/i,
      /\bnext\.js\s+developer\b/i,
      /\bcreative\s+technologist\b/i,
      /\binteractive\s+developer\b/i,
    ],
  },
  {
    id: 'fullstack',
    label: 'Fullstack Engineering',
    patterns: [/\bfull.?stack\b/i],
  },
  {
    id: 'backend',
    label: 'Backend / Software Engineering',
    patterns: [
      /\bsoftware\s+engineer\b/i,
      /\bsoftware\s+developer\b/i,
      /\bforward\s+deployed\s+engineer\b/i,
      /\bengineering\s+manager\b/i,
      /\bbackend\s+engineer\b/i,
      /\bback.end\s+engineer\b/i,
      /\bapi\s+engineer\b/i,
      /\bsystems\s+engineer\b/i,
      /\bsecurity\s+engineer\b/i,
      /\bnetwork\s+engineer\b/i,
      /\bbackend\s+developer\b/i,
      /\bjava\s+developer\b/i,
      /\bpython\s+developer\b/i,
      /\bruby\s+developer\b/i,
      /\bgo\s+developer\b/i,
      /\brust\s+developer\b/i,
      /\bc\+\+\s+developer\b/i,
      /\bstaff\s+engineer\b/i,
      /\bprincipal\s+engineer\b/i,
      /\bsolutions\s+architect\b/i,
      /\bengineer\b/i,   // catch-all — must be last in engineering
      /\bdeveloper\b/i,  // catch-all
    ],
  },

  // ── Content / Marketing ───────────────────────────────────────────────────
  {
    id: 'content_writing',
    label: 'Writing / PR / Communications / Journalism',
    patterns: [
      /\bcontent\s+writer\b/i,
      /\bcopywriter\b/i,
      /\bstaff\s+writer\b/i,
      /\btechnical\s+writer\b/i,
      /\bgrant\s+writer\b/i,
      /\bscriptwriter\b/i,
      /\bjournalist\b/i,
      /\breporter\b/i,
      /\beditor\b/i,
      /\bpr\s+specialist\b/i,
      /\bpublic\s+relations\b/i,
      /\bcommunications\s+manager\b/i,
      /\bcommunications\s+director\b/i,
      /\bpublicist\b/i,
      /\bmedia\s+relations\b/i,
      /\bcorporate\s+communications\b/i,
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    patterns: [
      /\bmarketing\s+manager\b/i,
      /\bmarketing\s+director\b/i,
      /\bbrand\s+manager\b/i,
      /\bbrand\s+strategist\b/i,
      /\bgrowth\s+marketer\b/i,
      /\bdigital\s+marketer\b/i,
      /\bperformance\s+marketer\b/i,
      /\bdemand\s+generation\b/i,
      /\bseo\s+specialist\b/i,
      /\bemail\s+marketer\b/i,
      /\bsocial\s+media\s+manager\b/i,
      /\bmarketing\s+analyst\b/i,
      /\bmarketing\s+coordinator\b/i,
      /\bmarketing\s+lead\b/i,
      /\bproduct\s+marketer\b/i,
      /\bcontent\s+marketer\b/i,
      /\bcontent\s+marketing\b/i,
    ],
  },

  // ── Product Management ───────────────────────────────────────────────────
  // Project and operations management is distinct from product management.
  // Keep this first so "program manager" is classified here.
  {
    id: 'project_ops',
    label: 'Project / Program / Operations Management',
    patterns: [
      /\bproject\s+manager\b/i,
      /\bproject\s+coordinator\b/i,
      /\bproject\s+administrator\b/i,
      /\bprogram\s+manager\b/i,
      /\bprogram\s+coordinator\b/i,
      /\bprogram\s+administrator\b/i,
      /\boperations\s+manager\b/i,
      /\boperations\s+coordinator\b/i,
      /\boperations\s+specialist\b/i,
      /\boperations\s+analyst\b/i,
      /\boperations\s+director\b/i,
      /\boperations\s+lead\b/i,
      /\bbusiness\s+operations\b/i,
      /\bpeople\s+operations\b/i,
      /\bchief\s+of\s+staff\b/i,
      /\bproject\s+management\b/i,
      /\bprogram\s+management\b/i,
      /\boperations\s+management\b/i,
      /\bpmo\b/i,
      /\bscrum\s+master\b/i,
      /\boperations\b/i,
    ],
  },
  {
    id: 'product_mgmt',
    label: 'Product Management',
    patterns: [
      /\bproduct\s+manager\b/i,
      /\bproduct\s+lead\b/i,
      /\bgroup\s+product\s+manager\b/i,
      /\bprincipal\s+product\s+manager\b/i,
      /\bvp\s+of\s+product\b/i,
      /\bhead\s+of\s+product\b/i,
      /\bchief\s+product\b/i,
    ],
  },

  // ── Finance / Accounting ─────────────────────────────────────────────────
  {
    id: 'accounting',
    label: 'Accounting / Bookkeeping',
    patterns: [
      /\baccountant\b/i,
      /\bbookkeeper\b/i,
      /\bcontroller\b/i,
      /\bcomptroller\b/i,
      /\bauditor\b/i,
      /\btax\s+specialist\b/i,
      /\btax\s+analyst\b/i,
      /\btax\s+manager\b/i,
      /\bpayroll\s+specialist\b/i,
      /\bpayroll\s+manager\b/i,
      /\baccounts\s+payable\b/i,
      /\baccounts\s+receivable\b/i,
    ],
  },
  {
    id: 'finance',
    label: 'Finance / Quantitative Analysis',
    patterns: [
      /\bfinancial\s+analyst\b/i,
      /\bfinancial\s+planner\b/i,
      /\bfinancial\s+advisor\b/i,
      /\bfinance\s+manager\b/i,
      /\binvestment\s+analyst\b/i,
      /\binvestment\s+banker\b/i,
      /\bportfolio\s+manager\b/i,
      /\bequity\s+analyst\b/i,
      /\btreasury\s+analyst\b/i,
      /\brisk\s+analyst\b/i,
      /\bcredit\s+analyst\b/i,
      /\bactuary\b/i,
      /\bactuarial\b/i,
      /\bquantitative\s+analyst\b/i,
      /\bquant\b/i,
    ],
  },

  // ── Sales / Customer ─────────────────────────────────────────────────────
  // technical_sales before sales (solutions engineer before "sales")
  {
    id: 'technical_sales',
    label: 'Solutions / Customer Success',
    patterns: [
      /\bsolutions\s+engineer\b/i,
      /\bsales\s+engineer\b/i,
      /\bimplementation\s+engineer\b/i,
      /\bcustomer\s+success\s+engineer\b/i,
      /\bcustomer\s+success\s+manager\b/i,
      /\baccount\s+manager\b/i,
      /\bclient\s+success\b/i,
      /\bcustomer\s+success\b/i,
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    patterns: [
      /\baccount\s+executive\b/i,
      /\bsales\s+manager\b/i,
      /\bsales\s+director\b/i,
      /\bsales\s+representative\b/i,
      /\benterprise\s+sales\b/i,
      /\binside\s+sales\b/i,
      /\boutside\s+sales\b/i,
      /\bbdr\b/i,
      /\bsdr\b/i,
      /\bbusiness\s+development\s+representative\b/i,
      /\bbusiness\s+development\s+manager\b/i,
    ],
  },

  // ── Legal / Admin ─────────────────────────────────────────────────────────
  {
    id: 'legal',
    label: 'Legal',
    patterns: [
      /\battorney\b/i,
      /\bcounsel\b/i,
      /\bparalegal\b/i,
      /\blegal\s+assistant\b/i,
      /\blegal\s+coordinator\b/i,
      /\blegal\s+analyst\b/i,
      /\bcompliance\s+officer\b/i,
    ],
  },
  {
    id: 'admin',
    label: 'Administrative / Operations Support',
    patterns: [
      /\bexecutive\s+assistant\b/i,
      /\badministrative\s+assistant\b/i,
      /\boffice\s+manager\b/i,
      /\boffice\s+coordinator\b/i,
      /\boffice\s+assistant\b/i,
      /\boperations\s+coordinator\b/i,
      /\badministrative\s+coordinator\b/i,
    ],
  },
]

// ---------------------------------------------------------------------------
// Cluster distance table (asymmetric: some crossovers are easier one way)
// Keys: { fromCluster }{ toCluster }
// Symmetric: if a→b is not defined, b→a is checked, then defaults to 5.
// ---------------------------------------------------------------------------
// 0 = exact same cluster (handled in code)
// 1 = very close — near-automatic crossover
// 2 = adjacent — strong bridge if skills support it
// 3 = stretch — possible with clear evidence
// 4 = weak — hide unless user is in explore mode
// 5 = block
const RAW_DISTANCES = {
  ux_design: {
    ui_visual: 1,
    design_systems: 1,
    brand_creative: 2,
    design_content: 2,
    frontend: 2,
    marketing: 3,
    product_mgmt: 3,
    content_writing: 3,
    mobile: 4,
    fullstack: 4,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  ui_visual: {
    ux_design: 1,
    design_systems: 1,
    brand_creative: 1,
    design_content: 2,
    frontend: 1,
    marketing: 2,
    content_writing: 3,
    product_mgmt: 4,
    mobile: 4,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  design_systems: {
    ux_design: 1,
    ui_visual: 1,
    frontend: 1,
    brand_creative: 2,
    design_content: 2,
    backend: 3,
    fullstack: 2,
    marketing: 3,
    product_mgmt: 4,
    mobile: 4,
    platform: 4,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  design_content: {
    ux_design: 2,
    ui_visual: 2,
    design_systems: 2,
    brand_creative: 2,
    content_writing: 2,
    marketing: 3,
    product_mgmt: 3,
    frontend: 3,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  brand_creative: {
    ui_visual: 1,
    ux_design: 2,
    design_systems: 2,
    design_content: 2,
    marketing: 2,
    content_writing: 3,
    frontend: 3,
    product_mgmt: 4,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  frontend: {
    design_systems: 1,
    ui_visual: 1,
    fullstack: 1,
    ux_design: 2,
    brand_creative: 3,
    backend: 3,
    mobile: 2,
    technical_sales: 3,
    marketing: 4,
    design_content: 3,
    platform: 4,
    data_ml: 4,
    product_mgmt: 4,
    accounting: 5,
    finance: 5,
    sales: 5,
    legal: 5,
    admin: 5,
  },
  fullstack: {
    frontend: 1,
    backend: 1,
    design_systems: 2,
    mobile: 2,
    platform: 2,
    data_ml: 3,
    ux_design: 4,
    technical_sales: 3,
    marketing: 4,
    accounting: 5,
    finance: 5,
    sales: 5,
    legal: 5,
    admin: 5,
  },
  backend: {
    fullstack: 1,
    platform: 2,
    data_ml: 2,
    mobile: 2,
    frontend: 3,
    design_systems: 3,
    technical_sales: 3,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    design_content: 5,
    marketing: 5,
    content_writing: 5,
    product_mgmt: 4,
    accounting: 5,
    finance: 5,
    sales: 5,
    legal: 5,
    admin: 5,
  },
  platform: {
    backend: 2,
    fullstack: 2,
    data_ml: 2,
    mobile: 3,
    frontend: 4,
    technical_sales: 4,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    design_content: 5,
    marketing: 5,
    content_writing: 5,
    product_mgmt: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    legal: 5,
    admin: 5,
  },
  data_ml: {
    backend: 2,
    platform: 2,
    fullstack: 3,
    finance: 3,
    frontend: 4,
    product_mgmt: 4,
    accounting: 4,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    design_content: 5,
    marketing: 5,
    content_writing: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  mobile: {
    frontend: 2,
    fullstack: 2,
    backend: 2,
    platform: 3,
    ux_design: 4,
    ui_visual: 4,
    data_ml: 4,
    design_systems: 4,
    accounting: 5,
    finance: 5,
    sales: 5,
    legal: 5,
    admin: 5,
    brand_creative: 5,
    content_writing: 5,
    marketing: 5,
    product_mgmt: 4,
  },
  marketing: {
    brand_creative: 2,
    content_writing: 2,
    ui_visual: 2,
    ux_design: 3,
    design_content: 3,
    product_mgmt: 3,
    technical_sales: 3,
    sales: 3,
    frontend: 4,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    legal: 5,
    admin: 5,
  },
  content_writing: {
    design_content: 2,
    brand_creative: 3,
    marketing: 2,
    ux_design: 3,
    product_mgmt: 3,
    technical_sales: 4,
    frontend: 4,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    sales: 5,
    legal: 5,
    admin: 5,
  },
  product_mgmt: {
    ux_design: 3,
    design_content: 3,
    marketing: 3,
    backend: 4,
    frontend: 4,
    content_writing: 3,
    technical_sales: 3,
    data_ml: 4,
    accounting: 5,
    finance: 5,
    sales: 4,
    ui_visual: 4,
    brand_creative: 4,
    legal: 5,
    admin: 5,
  },
  project_ops: {
    admin: 1,
    product_mgmt: 2,
    technical_sales: 4,
    accounting: 4,
    finance: 4,
    legal: 4,
    sales: 4,
    ux_design: 5,
    ui_visual: 5,
    design_systems: 5,
    design_content: 5,
    brand_creative: 5,
    frontend: 3,
    fullstack: 3,
    backend: 3,
    platform: 3,
    data_ml: 3,
    mobile: 3,
    marketing: 5,
    content_writing: 5,
  },
  accounting: {
    finance: 2,
    data_ml: 4,
    admin: 3,
    legal: 4,
    product_mgmt: 5,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    frontend: 5,
    backend: 5,
    platform: 5,
    marketing: 5,
    content_writing: 5,
    sales: 5,
    technical_sales: 5,
  },
  finance: {
    accounting: 2,
    data_ml: 3,
    product_mgmt: 4,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    frontend: 5,
    backend: 5,
    platform: 5,
    marketing: 5,
    content_writing: 5,
    sales: 5,
    technical_sales: 5,
    legal: 5,
    admin: 5,
  },
  sales: {
    technical_sales: 2,
    marketing: 3,
    product_mgmt: 4,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    frontend: 5,
    backend: 5,
    platform: 5,
    data_ml: 5,
    accounting: 5,
    finance: 5,
    legal: 5,
    admin: 5,
  },
  technical_sales: {
    sales: 2,
    marketing: 3,
    backend: 3,
    frontend: 3,
    product_mgmt: 3,
    fullstack: 3,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    design_systems: 5,
    platform: 4,
    data_ml: 4,
    accounting: 5,
    finance: 5,
    legal: 5,
    admin: 5,
  },
  legal: {
    admin: 3,
    accounting: 4,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    frontend: 5,
    backend: 5,
    platform: 5,
    data_ml: 5,
    marketing: 5,
    content_writing: 5,
    product_mgmt: 5,
    sales: 5,
    technical_sales: 5,
    finance: 5,
  },
  admin: {
    legal: 3,
    accounting: 3,
    technical_sales: 4,
    product_mgmt: 4,
    ux_design: 5,
    ui_visual: 5,
    brand_creative: 5,
    frontend: 5,
    backend: 5,
    platform: 5,
    data_ml: 5,
    marketing: 5,
    content_writing: 5,
    sales: 5,
    finance: 5,
  },
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect which cluster a title string belongs to.
 * Returns { id, label } or null if unclassified.
 */
function detectCluster(title) {
  if (!title) return null
  for (const cluster of CLUSTERS) {
    if (cluster.patterns.some(p => p.test(title))) {
      return { id: cluster.id, label: cluster.label }
    }
  }
  return null
}

/**
 * Get the semantic distance between two cluster IDs.
 * 0 = same cluster, 5 = hard block, symmetric.
 */
function getDistance(a, b) {
  if (!a || !b) return 3  // unknown cluster → moderate caution, don't hard block
  if (a === b) return 0
  return RAW_DISTANCES[a]?.[b] ?? RAW_DISTANCES[b]?.[a] ?? 5
}

/**
 * Convert distance to a 0–100 role score.
 * Bridge evidence (0–1) can soften the penalty at distances 2–3.
 */
function roleScoreFromDistance(distance, bridgeEvidence = 0) {
  switch (distance) {
    case 0: return 100
    case 1: return 85
    case 2: return 60 + Math.round(bridgeEvidence * 15)  // 60–75
    case 3: return 30 + Math.round(bridgeEvidence * 20)  // 30–50
    case 4: return 15
    default: return 0  // distance 5 → hard block handled before scoring
  }
}

/**
 * Classify match type label for display.
 */
function classifyMatchType(distance) {
  if (distance <= 1) return 'direct'
  if (distance <= 2) return 'adjacent'
  if (distance <= 3) return 'stretch'
  return 'stretch'  // distance 4 is shown only rarely, still label as stretch
}

module.exports = { detectCluster, getDistance, roleScoreFromDistance, classifyMatchType }

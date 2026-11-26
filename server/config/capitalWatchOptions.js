'use strict'

// The choices a business profile is built from. The dashboard loads these from
// GET /capitalwatch/options, so adding a value here adds it everywhere.

// What kinds of funding a business can seek or ignore. Each opportunity falls in one.
const FUNDING_CATEGORIES = [
  { id: 'grant', label: 'Grants' },
  { id: 'loan', label: 'Loans and financing' },
  { id: 'investment', label: 'Angel and venture investment' },
  { id: 'competition', label: 'Pitch competitions and prizes' },
  { id: 'accelerator', label: 'Accelerators and incubators' },
  { id: 'fellowship', label: 'Fellowships and scholarships' },
  { id: 'contract', label: 'Government contracts (SBIR, RFPs)' },
]

const DEMOGRAPHICS = [
  { id: 'women', label: 'Woman-owned' },
  { id: 'black', label: 'Black or African American-owned' },
  { id: 'latino', label: 'Latino or Hispanic-owned' },
  { id: 'asian', label: 'Asian American-owned' },
  { id: 'native', label: 'Native American or Indigenous-owned' },
  { id: 'veteran', label: 'Veteran or military-owned' },
  { id: 'lgbtq', label: 'LGBTQ+-owned' },
  { id: 'disabled', label: 'Disability-owned' },
  { id: 'immigrant', label: 'Immigrant-owned' },
  { id: 'youth', label: 'Young founder (under 30)' },
  { id: 'rural', label: 'Rural business' },
  { id: 'low_income', label: 'Low-income or underserved community' },
]

// "minority" in an opportunity's eligibility covers any of these founders.
const MINORITY_GROUPS = ['black', 'latino', 'asian', 'native']

const ENTITY_TYPES = [
  { id: 'for_profit', label: 'For-profit company' },
  { id: 'nonprofit', label: 'Nonprofit' },
  { id: 'sole_proprietor', label: 'Sole proprietor or freelancer' },
  { id: 'individual', label: 'Individual (not yet incorporated)' },
]

const STAGES = [
  { id: 'idea', label: 'Idea' },
  { id: 'pre_revenue', label: 'Building, pre-revenue' },
  { id: 'early_revenue', label: 'Early revenue' },
  { id: 'growth', label: 'Growing' },
  { id: 'established', label: 'Established' },
]

const INDUSTRIES = [
  { id: 'software', label: 'Software and SaaS' },
  { id: 'ai', label: 'AI and data' },
  { id: 'ecommerce', label: 'E-commerce and retail' },
  { id: 'media', label: 'Media, content and creators' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'education', label: 'Education' },
  { id: 'health', label: 'Health and life sciences' },
  { id: 'fintech', label: 'Finance and fintech' },
  { id: 'climate', label: 'Climate, energy and environment' },
  { id: 'food', label: 'Food, beverage and agriculture' },
  { id: 'manufacturing', label: 'Manufacturing and hardware' },
  { id: 'defense', label: 'Defense and aerospace' },
  { id: 'arts', label: 'Arts, design and fashion' },
  { id: 'services', label: 'Professional and local services' },
  { id: 'real_estate', label: 'Real estate and construction' },
  { id: 'transport', label: 'Transportation and logistics' },
  { id: 'social_impact', label: 'Social impact and community' },
  { id: 'workforce', label: 'Jobs, hiring and workforce' },
]

const ids = (list) => list.map((o) => o.id)

module.exports = {
  FUNDING_CATEGORIES,
  DEMOGRAPHICS,
  MINORITY_GROUPS,
  ENTITY_TYPES,
  STAGES,
  INDUSTRIES,
  FUNDING_CATEGORY_IDS: ids(FUNDING_CATEGORIES),
  DEMOGRAPHIC_IDS: ids(DEMOGRAPHICS),
  ENTITY_TYPE_IDS: ids(ENTITY_TYPES),
  STAGE_IDS: ids(STAGES),
  INDUSTRY_IDS: ids(INDUSTRIES),
}

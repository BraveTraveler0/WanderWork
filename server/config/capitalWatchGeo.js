'use strict'

// Geographic eligibility for Capital Watch. The team operates in the US, UK, and
// Thailand (top priority for ranking) plus Brazil/Latin America (kept, but ranked
// lower) -- everything else gets filtered out at ingestion so the dashboard doesn't
// fill up with opportunities the team can't act on (e.g. "XTC India 2026").
// Bare "us"/"uk" tokens are deliberately excluded -- "us" is a common pronoun and
// would false-positive on nearly every summary.
const TOP_TIER_RE = /\b(united states|u\.s\.a\.?|usa|united kingdom|u\.k\.?|britain|british|thailand|thai)\b/i

const SECOND_TIER_RE = /\b(brazil|brazilian|latin america|latam|mexico|mexican|argentina|argentine|chile|chilean|colombia|colombian|peru|peruvian|venezuela|venezuelan|ecuador|ecuadorian|bolivia|bolivian|paraguay|paraguayan|uruguay|uruguayan|guatemala|guatemalan|honduras|honduran|nicaragua|nicaraguan|panama|panamanian|costa rica|costa rican|el salvador|salvadoran|dominican republic|dominican|belize)\b/i

// Countries this team does not operate in -- explicit mentions of these (without a
// top/second tier mention also present) get filtered out at ingestion. Deliberately
// omits "Georgia" (ambiguous with the US state, which scoring already favors) and
// anything covered by the tiers above.
const EXCLUDED_COUNTRY_RE = new RegExp('\\b(' + [
  'afghanistan', 'albania', 'algeria', 'angola', 'armenia', 'australia', 'austria',
  'azerbaijan', 'bahrain', 'bangladesh', 'belarus', 'belgium', 'benin', 'bhutan',
  'bosnia', 'botswana', 'brunei', 'bulgaria', 'burkina faso', 'burundi', 'cambodia',
  'cameroon', 'canada', 'chad', 'china', 'chinese', 'croatia', 'cuba', 'cyprus',
  'czech republic', 'czechia', 'denmark', 'djibouti', 'egypt', 'egyptian', 'estonia',
  'ethiopia', 'ethiopian', 'fiji', 'finland', 'france', 'french', 'gabon', 'gambia',
  'germany', 'german', 'ghana', 'ghanaian', 'greece', 'greek', 'guinea', 'haiti',
  'hungary', 'iceland', 'india', 'indian', 'indonesia', 'indonesian', 'iran',
  'iraq', 'ireland', 'irish', 'israel', 'israeli', 'italy', 'italian', 'ivory coast',
  "cote d'ivoire", 'jamaica', 'jamaican', 'japan', 'japanese', 'jordan', 'kazakhstan',
  'kenya', 'kenyan', 'kuwait', 'kyrgyzstan', 'laos', 'latvia', 'lebanon', 'lesotho',
  'liberia', 'libya', 'lithuania', 'luxembourg', 'madagascar', 'malawi', 'malaysia',
  'malaysian', 'maldives', 'mali', 'malta', 'mauritania', 'mauritius', 'moldova',
  'mongolia', 'montenegro', 'morocco', 'moroccan', 'mozambique', 'myanmar', 'namibia',
  'nepal', 'netherlands', 'dutch', 'new zealand', 'niger', 'nigeria', 'nigerian',
  'norway', 'oman', 'pakistan', 'pakistani', 'palestine', 'papua new guinea',
  'philippines', 'filipino', 'poland', 'polish', 'portugal', 'portuguese', 'qatar',
  'romania', 'russia', 'russian', 'rwanda', 'saudi arabia', 'senegal', 'serbia',
  'sierra leone', 'singapore', 'slovakia', 'slovenia', 'somalia', 'south africa',
  'south korea', 'korean', 'spain', 'spanish', 'sri lanka', 'sudan', 'swaziland',
  'eswatini', 'sweden', 'switzerland', 'swiss', 'syria', 'taiwan', 'taiwanese',
  'tajikistan', 'tanzania', 'togo', 'tunisia', 'turkey', 'turkish', 'turkmenistan',
  'uganda', 'ukraine', 'ukrainian', 'united arab emirates', 'uzbekistan', 'vanuatu',
  'vietnam', 'vietnamese', 'yemen', 'zambia', 'zimbabwe',
].join('|') + ')\\b', 'i')

// location + title -- title catches cases like "XTC India 2026" where the model
// left location null but the country is named right in the opportunity's name.
function eligibilityText(grant) {
  return `${grant.location || ''} ${grant.title || ''}`
}

function isEligibleLocation(grant) {
  const text = eligibilityText(grant)
  if (!text.trim()) return true
  if (TOP_TIER_RE.test(text) || SECOND_TIER_RE.test(text)) return true
  return !EXCLUDED_COUNTRY_RE.test(text)
}

// Additive ranking bonus -- US/UK/Thailand opportunities should outrank Brazil/Latin
// America ones, which should outrank ones with no stated location at all.
function locationTierBonus(grant) {
  const text = grant.location || ''
  if (TOP_TIER_RE.test(text)) return 2
  if (SECOND_TIER_RE.test(text)) return 0.5
  return 0
}

module.exports = { TOP_TIER_RE, SECOND_TIER_RE, EXCLUDED_COUNTRY_RE, isEligibleLocation, locationTierBonus }

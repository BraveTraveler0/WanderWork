/**
 * Syncs recruiter data from Airtable into MongoDB.
 * Designed to run inside an existing Mongoose connection.
 */
const Recruiter = require('../models/JobSeeker/jobSeeker.Recruiter')

const SPECIALTY_RULES = [
  { specialty: 'tech', patterns: [/software/i, /engineer/i, /developer/i, /\bIT\b/, /devops/i, /cloud/i, /cybersecurity/i, /fullstack/i, /full.stack/i, /front.end/i, /back.end/i, /platform/i, /infrastructure/i, /\bsre\b/i, /machine learning/i, /\bml\b/i, /semiconductor/i, /quantum/i, /robotics/i, /blockchain/i, /web3/i, /embedded/i, /firmware/i] },
  { specialty: 'creative', patterns: [/creative/i, /design/i, /\bux\b/i, /\bui\b/i, /brand/i, /art direct/i, /copywriter/i, /content (creator|strategist)/i, /advertising/i, /marketing/i, /motion/i, /animation/i, /graphic/i, /visual design/i, /social media/i, /\bseo\b/i, /media buyer/i] },
  { specialty: 'product', patterns: [/product manager/i, /product owner/i, /product recruit/i, /product lead/i, /product design/i, /product strategy/i, /program manager/i, /project manager/i, /scrum master/i] },
  { specialty: 'data', patterns: [/data scien/i, /data engineer/i, /data analyst/i, /business intelligence/i, /\bBI\b/i, /analytics.*recruit/i, /\bLLM\b/i, /generative ai/i, /\bgenai\b/i] },
  { specialty: 'sales', patterns: [/\bsales\b/i, /account executive/i, /account manager/i, /business development/i, /go.to.market/i, /\bgtm\b/i, /revenue/i, /\bsdr\b/i, /\bbdr\b/i, /customer success/i, /partnerships/i] },
  { specialty: 'operations', patterns: [/operat/i, /supply chain/i, /logistics/i, /procurement/i, /chief of staff/i, /\bhr\b/i, /human resource/i, /people ops/i, /talent ops/i, /executive assistant/i] },
  { specialty: 'finance', patterns: [/finance/i, /accounting/i, /\bcpa\b/i, /\bcfo\b/i, /investment/i, /private equity/i, /\bvc\b/i, /venture/i, /banking/i, /financial.*recruit/i] },
  { specialty: 'business', patterns: [/executive search/i, /c-suite/i, /\bceo\b/i, /\bcoo\b/i, /chief.*officer/i, /board.*recruit/i, /leadership.*search/i] },
  { specialty: 'healthcare', patterns: [/medical/i, /health/i, /clinical/i, /nurs/i, /pharma/i, /biotech/i, /physician/i, /dental/i, /hospital/i, /life science/i, /therapeutics/i] },
  { specialty: 'legal', patterns: [/legal/i, /attorney/i, /\blaw\b/i, /compliance/i, /paralegal/i] },
]

const COMPANY_HINTS = [
  { specialty: 'creative', pattern: /music|audio|sound|studio|creative|art\b|design|brand|media|fashion|film|photo|publishing|record|entertainment/i },
  { specialty: 'tech', pattern: /tech|software|systems|digital|cloud|data|cyber|platform|saas|fintech|edtech/i },
  { specialty: 'healthcare', pattern: /health|medical|pharma|clinic|hospital|dental|biotech|life science|therapeutics/i },
  { specialty: 'legal', pattern: /law|legal|attorney|counsel/i },
  { specialty: 'finance', pattern: /capital|equity|ventures|fund|asset|wealth|financial/i },
]

function classifySpecialty(jobTitle = '', company = '') {
  const text = `${jobTitle} ${company}`
  const scores = SPECIALTY_RULES.map(({ specialty, patterns }) => ({
    specialty,
    score: patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0),
  })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score)

  if (!scores.length) return 'general'
  if (scores.length === 1 || scores[0].score > scores[1].score) return scores[0].specialty
  for (const { specialty, pattern } of COMPANY_HINTS) {
    if (pattern.test(company)) return specialty
  }
  return scores[0].specialty
}

async function fetchAllRecruiters() {
  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  const table = process.env.AIRTABLE_RECRUITERS_TABLE_ID

  if (!token || !baseId || !table) {
    throw new Error('AIRTABLE_TOKEN, AIRTABLE_BASE_ID, and AIRTABLE_RECRUITERS_TABLE_ID are required')
  }

  const records = []
  let offset = null
  const base = `https://api.airtable.com/v0/${baseId}/${table}`

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.append('offset', offset)
    const res = await fetch(`${base}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Airtable recruiter fetch error ${res.status}: ${await res.text()}`)
    const body = await res.json()
    records.push(...body.records)
    offset = body.offset || null
  } while (offset)

  return records
}

function transformRecord(record) {
  const f = record.fields || {}
  const emailTemplate = (() => {
    const s = f['Attachment Summary']
    if (!s) return null
    if (typeof s === 'string') return s
    if (s?.state === 'generated' && s?.value) return s.value
    return null
  })()
  return {
    airtableId:  record.id,
    leadKey:     f.Lead_Key || null,
    firstName:   f.First_Name || null,
    lastName:    f.Last_Name  || null,
    name:        f.recruiter_name || `${f.First_Name || ''} ${f.Last_Name || ''}`.trim() || 'Unknown',
    email:       f.email || null,
    linkedinUrl: f.linkedin_url || null,
    jobTitle:    f.job_title || null,
    company:     f.company_name || null,
    location:    f.Location || null,
    source:      f.source || null,
    specialty:   classifySpecialty(f.job_title, f.company_name),
    emailTemplate,
    status:      'active',
    score:       typeof f.score === 'number' ? f.score : 0,
    lastSeenAt:  f.last_seen_at ? new Date(f.last_seen_at) : null,
  }
}

async function syncRecruiters() {
  console.log('[RecruiterSync] Fetching from Airtable…')
  const records = await fetchAllRecruiters()
  console.log(`[RecruiterSync] ${records.length} records fetched`)

  let upserted = 0, skipped = 0
  for (const record of records) {
    try {
      await Recruiter.findOneAndUpdate(
        { airtableId: record.id },
        { $set: transformRecord(record) },
        { upsert: true, new: true }
      )
      upserted++
    } catch (e) {
      console.warn(`[RecruiterSync] Skipped ${record.id}: ${e.message}`)
      skipped++
    }
  }

  console.log(`[RecruiterSync] Done — upserted: ${upserted}, skipped: ${skipped}`)
  return { upserted, skipped, total: records.length }
}

async function upsertRecruiters(records) {
  let upserted = 0, skipped = 0
  for (const doc of records) {
    if (!doc.airtableId) { skipped++; continue }
    try {
      await Recruiter.findOneAndUpdate(
        { airtableId: doc.airtableId },
        { $set: doc },
        { upsert: true, new: true }
      )
      upserted++
    } catch (e) {
      console.warn(`[upsertRecruiters] Skipped ${doc.airtableId}: ${e.message}`)
      skipped++
    }
  }
  console.log(`[upsertRecruiters] Done — upserted: ${upserted}, skipped: ${skipped}`)
  return { upserted, skipped, total: records.length }
}

module.exports = { syncRecruiters, upsertRecruiters }

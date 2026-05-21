#!/usr/bin/env node
/**
 * Syncs recruiter data from Airtable into MongoDB jobseeker.recruiters collection.
 * Usage: node sync-recruiters.js
 */
require('dotenv').config()
const mongoose = require('mongoose')
const Recruiter = require('./models/JobSeeker/jobSeeker.Recruiter')

const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const AIRTABLE_TABLE   = process.env.AIRTABLE_RECRUITERS_TABLE_ID
const MONGO_URI        = process.env.DATABASE_URI || 'mongodb://localhost:27017/aon'

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE) {
  throw new Error('AIRTABLE_TOKEN, AIRTABLE_BASE_ID, and AIRTABLE_RECRUITERS_TABLE_ID are required')
}

// ── Specialty classifier ────────────────────────────────────────────────────
const SPECIALTY_RULES = [
  {
    specialty: 'tech',
    patterns: [
      /technical/i, /software/i, /engineer/i, /developer/i, /\bIT\b/,
      /data\s*(science|engineer|analyst)/i, /devops/i, /cloud/i,
      /cybersecurity/i, /fullstack/i, /full.stack/i, /front.end/i,
      /back.end/i, /platform/i, /infrastructure/i, /\bsre\b/i,
      /machine learning/i, /\bml\b/i, /\bai\b/i,
    ],
  },
  {
    specialty: 'creative',
    patterns: [
      /creative/i, /design/i, /\bux\b/i, /\bui\b/i, /brand/i,
      /art direct/i, /copywriter/i, /content (creator|strategist)/i,
      /advertising/i, /marketing/i, /motion/i, /video/i, /animation/i,
      /illustration/i, /photographer/i, /graphic/i, /visual design/i,
      /social media/i, /\bseo\b/i,
    ],
  },
  {
    specialty: 'business',
    patterns: [
      /business/i, /sales/i, /finance/i, /operation/i, /strategy/i,
      /consult/i, /\bhr\b/i, /human resource/i, /people ops/i,
      /talent acquisition/i, /people partner/i, /account executive/i,
      /account manager/i, /supply chain/i, /procurement/i,
      /chief of staff/i, /general counsel/i,
    ],
  },
  {
    specialty: 'healthcare',
    patterns: [
      /medical/i, /health/i, /clinical/i, /nurs/i, /pharma/i,
      /biotech/i, /physician/i, /dental/i, /hospital/i, /life science/i,
    ],
  },
  {
    specialty: 'legal',
    patterns: [
      /legal/i, /attorney/i, /\blaw\b/i, /compliance/i, /paralegal/i,
    ],
  },
]

// Company name hints that break classification ties
const COMPANY_HINTS = [
  { specialty: 'creative', pattern: /music|audio|sound|studio|creative|art\b|design|brand|media|fashion|film|photo|publishing|record|entertainment/i },
  { specialty: 'tech',     pattern: /tech|software|systems|digital|cloud|data|cyber|platform|\bai\b|saas|fintech|edtech/i },
  { specialty: 'healthcare', pattern: /health|medical|pharma|clinic|hospital|dental|biotech|life science/i },
  { specialty: 'legal',    pattern: /law|legal|attorney|counsel/i },
]

function classifySpecialty(jobTitle = '', company = '') {
  const text = `${jobTitle} ${company}`
  const scores = SPECIALTY_RULES.map(({ specialty, patterns }) => ({
    specialty,
    score: patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0),
  })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score)

  if (!scores.length) return 'general'
  // Clear winner
  if (scores.length === 1 || scores[0].score > scores[1].score) return scores[0].specialty
  // Tie — use company name as tiebreaker
  for (const { specialty, pattern } of COMPANY_HINTS) {
    if (pattern.test(company)) return specialty
  }
  return scores[0].specialty
}

// ── Airtable fetch ──────────────────────────────────────────────────────────
async function fetchAllRecruiters() {
  const records = []
  let offset = null
  const base = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.append('offset', offset)

    const res = await fetch(`${base}?${params}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    })
    if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`)
    const body = await res.json()
    records.push(...body.records)
    offset = body.offset || null
  } while (offset)

  return records
}

// ── Transform ───────────────────────────────────────────────────────────────
function transform(record) {
  const f = record.fields || {}

  const emailTemplate = (() => {
    const s = f['Attachment Summary']
    if (!s) return null
    if (typeof s === 'string') return s
    if (s?.state === 'generated' && s?.value) return s.value
    return null
  })()

  const name = f.recruiter_name || `${f.First_Name || ''} ${f.Last_Name || ''}`.trim() || 'Unknown'
  const specialty = classifySpecialty(f.job_title, f.company_name)

  return {
    airtableId:    record.id,
    leadKey:       f.Lead_Key || null,
    firstName:     f.First_Name || null,
    lastName:      f.Last_Name  || null,
    name,
    email:         f.email || null,
    linkedinUrl:   f.linkedin_url || null,
    jobTitle:      f.job_title || null,
    company:       f.company_name || null,
    location:      f.Location || null,
    source:        f.source || null,
    specialty,
    emailTemplate,
    status:        'active',
    score:         typeof f.score === 'number' ? f.score : 0,
    lastSeenAt:    f.last_seen_at ? new Date(f.last_seen_at) : null,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  console.log('Fetching recruiters from Airtable…')
  const records = await fetchAllRecruiters()
  console.log(`Fetched ${records.length} records`)

  let upserted = 0, skipped = 0
  for (const record of records) {
    try {
      const doc = transform(record)
      await Recruiter.findOneAndUpdate(
        { airtableId: record.id },
        { $set: doc },
        { upsert: true, new: true }
      )
      upserted++
    } catch (e) {
      console.warn(`Skipped ${record.id}: ${e.message}`)
      skipped++
    }
  }

  // Print specialty breakdown
  const breakdown = await Recruiter.aggregate([
    { $group: { _id: '$specialty', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])
  console.log('\nSpecialty breakdown:')
  breakdown.forEach(({ _id, count }) => console.log(`  ${_id}: ${count}`))
  console.log(`\nDone — upserted: ${upserted}, skipped: ${skipped}`)

  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })

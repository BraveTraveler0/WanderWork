/**
 * Pulls recruiter leads straight from the "RecruiterSearchII" Apify actor task and
 * upserts them into MongoDB, replacing the n8n -> Airtable -> backend relay.
 * Normalization/scoring logic is a direct port of the n8n "Normalize + Key + Score" node.
 */
const { ApifyClient } = require('apify-client')
const { upsertRecruiters } = require('./recruiterSyncService')

const SOURCE = 'apify_linkedin_recruiters'

const TARGET_ROLES = 'recruiter,talent acquisition,talent partner,headhunter,technical recruiter,design recruiter,creative recruiter,staffing consultant,agency recruiter,founder,head of talent,people partner,hiring manager'
const TARGET_NICHES = 'startup,agency,design,product,front-end,frontend,ui,ux,creative,web,ai,ml,agentic,vibe coding,no-code,prototype,mvp'
const REGION_ALLOWLIST = new Set(['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'ES', 'PT', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT', 'PL', 'CZ', 'HU', 'RO', 'AU', 'BR'])

function safeStr(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function cleanUrl(url) {
  let value = safeStr(url)
  if (!value) return ''
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  return value.replace(/\/+$/, '')
}

function cleanEmail(email) {
  const value = safeStr(email).toLowerCase()
  if (!value) return ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : ''
}

function extractEmailFromText(text) {
  const match = safeStr(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : ''
}

function extractUrlFromText(text) {
  const match = safeStr(text).match(/(?:https?:\/\/|www\.)[^\s]+/i)
  return match ? match[0] : ''
}

function makeLeadKey(linkedin, email, fullName, company) {
  const li = safeStr(linkedin).toLowerCase()
  const em = safeStr(email).toLowerCase()
  const nm = safeStr(fullName).toLowerCase()
  const co = safeStr(company).toLowerCase()
  if (li) return `linkedin:${li}`
  if (em) return `email:${em}`
  return `name_company:${nm}|${co}`
}

function containsAny(text, csv) {
  const hay = safeStr(text).toLowerCase()
  const needles = safeStr(csv).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
  return needles.some((n) => hay.includes(n))
}

function extractCurrentPosition(raw) {
  if (Array.isArray(raw.experience) && raw.experience.length) return raw.experience[0]
  if (Array.isArray(raw.currentPosition) && raw.currentPosition.length) return raw.currentPosition[0]
  if (Array.isArray(raw.currentPositions) && raw.currentPositions.length) return raw.currentPositions[0]
  return {}
}

function scoreLead(lead) {
  let score = 0
  if (lead.email) score += 40
  if (lead.personal_email) score += 10
  if (lead.linkedin) score += 15
  if (lead.company_website) score += 10
  if (lead.company_domain) score += 8
  if (lead.company_name) score += 5
  if (lead.first_name) score += 3
  if (lead.job_title_match) score += 20
  if (lead.niche_match) score += 20
  if (lead.region_ok) score += 5
  if (safeStr(lead.job_title).toLowerCase().includes('founder')) score += 4
  if (safeStr(lead.job_title).toLowerCase().includes('hiring manager')) score += 4
  return Math.min(score, 100)
}

function normalizeApifyItem(raw, runId) {
  const current = extractCurrentPosition(raw)

  const first_name = safeStr(raw.firstName || raw.first_name)
  const last_name = safeStr(raw.lastName || raw.last_name)
  const full_name = safeStr(raw.full_name || [first_name, last_name].filter(Boolean).join(' '))

  const linkedin = cleanUrl(raw.linkedinUrl || raw.linkedin || raw.linkedin_url || raw.profile_url || raw.url)
  const public_identifier = safeStr(raw.publicIdentifier || raw.public_identifier)

  const headline = safeStr(raw.headline || raw.position || current.position || current.title)
  const about = safeStr(raw.about || raw.summary)
  const current_description = safeStr(current.description)

  const directEmail = cleanEmail(raw.emails?.[0]?.email) || cleanEmail(raw.email) || cleanEmail(raw.work_email)
  const emailFromAbout = cleanEmail(extractEmailFromText(about))
  const emailFromCurrentDesc = cleanEmail(extractEmailFromText(current_description))
  const email = directEmail || emailFromAbout || emailFromCurrentDesc
  const personal_email = cleanEmail(raw.personal_email || raw.personalEmail)

  const phone = safeStr(raw.phone || raw.mobile_number || raw.mobile)

  const company_website = cleanUrl(
    raw.companyWebsites?.[0]?.url ||
    raw.company_website ||
    raw.website ||
    raw.profileActions?.[0]?.url ||
    extractUrlFromText(about) ||
    extractUrlFromText(current_description)
  )
  const company_domain = safeStr(raw.companyWebsites?.[0]?.domain)

  const company_name = safeStr(
    current.companyName ||
    raw.currentPosition?.[0]?.companyName ||
    raw.currentPositions?.[0]?.companyName ||
    raw.company_name ||
    raw.company
  )
  const company_linkedin = cleanUrl(
    current.companyLinkedinUrl ||
    raw.currentPosition?.[0]?.companyLinkedinUrl ||
    raw.currentPositions?.[0]?.companyLinkedinUrl
  )

  const job_title = safeStr(current.position || current.title || raw.position || raw.job_title || raw.headline)

  const city = safeStr(raw.location?.parsed?.city || raw.city || raw.location?.city)
  const state = safeStr(raw.location?.parsed?.state || raw.state || raw.location?.state)
  const country = safeStr(
    raw.location?.parsed?.countryCode || raw.location?.countryCode || raw.country || raw.location?.parsed?.country
  ).toUpperCase()

  const company_size = safeStr(raw.company_size || raw.organization?.employee_count || raw.employeesCount)
  const company_founded_year = safeStr(raw.company_founded_year || raw.organization?.founded_year)

  const roleText = [job_title, headline, about, current_description].filter(Boolean).join(' ')
  const nicheText = [job_title, company_name, headline, about, current_description].filter(Boolean).join(' ')

  const job_title_match = containsAny(roleText, TARGET_ROLES)
  const niche_match = containsAny(nicheText, TARGET_NICHES)
  const region_ok = country ? REGION_ALLOWLIST.has(country) : false

  const tags = []
  if (job_title_match) tags.push('Recruiter')
  if (niche_match) tags.push('Target Niche')
  if (containsAny(nicheText, 'startup,saas,venture,series a,series b,early stage')) tags.push('Startup')
  if (containsAny(nicheText, 'agency,creative,digital,studio')) tags.push('Agency')
  if (containsAny(nicheText, 'design,ui,ux,creative,product')) tags.push('Design')
  if (containsAny(nicheText, 'front-end,frontend,react,web')) tags.push('FrontEnd')
  if (containsAny(nicheText, 'ai,ml,agentic,vibe coding,no-code,prototype,mvp,automation')) tags.push('AI')
  if (region_ok) tags.push('Region OK')
  if (email) tags.push('Has Email')

  const lead = {
    lead_key: makeLeadKey(linkedin, email || personal_email, full_name, company_name),
    first_name,
    last_name,
    full_name,
    email,
    personal_email,
    mobile_number: phone,
    linkedin,
    public_identifier,
    company_name,
    company_website,
    company_domain,
    company_linkedin,
    job_title,
    headline,
    industry: '',
    city,
    state,
    country,
    company_size,
    company_founded_year,
    about,
    status: 'New',
    source: SOURCE,
    run_id: runId,
    last_seen_at: new Date().toISOString(),
    tags: tags.join(','),
    job_title_match,
    niche_match,
    region_ok,
    contact_method: email ? 'email' : (linkedin ? 'linkedin' : ''),
  }

  lead.score = scoreLead(lead)
  return lead
}

function normalizeItems(rawItems, runId) {
  return rawItems
    .map((raw) => normalizeApifyItem(raw, runId))
    .filter((lead) =>
      lead.full_name &&
      lead.linkedin &&
      (lead.job_title_match || /recruit|talent|hiring|headhunt|staffing/i.test(lead.job_title || ''))
    )
}

// Poll with plain GETs instead of the SDK's long-poll, which has been prone to
// "socket hang up" over long-running tasks on this connection (see capitalWatchPipeline.cjs).
async function waitForRun(client, runId) {
  for (;;) {
    const run = await client.run(runId).get()
    if (run.status !== 'RUNNING' && run.status !== 'READY') return run
    await new Promise((r) => setTimeout(r, 15000))
  }
}

async function fetchDatasetItems(existingRunId) {
  const token = process.env.APIFY_TOKEN
  const taskId = process.env.APIFY_RECRUITER_TASK_ID
  if (!token) throw new Error('APIFY_TOKEN is required')
  if (!existingRunId && !taskId) throw new Error('APIFY_RECRUITER_TASK_ID is required')

  const client = new ApifyClient({ token })

  let run
  if (existingRunId) {
    console.log(`[RecruiterApify] Resuming existing run ${existingRunId}...`)
    run = await waitForRun(client, existingRunId)
  } else {
    console.log('[RecruiterApify] Starting Apify actor task...')
    const started = await client.task(taskId).start({ timeout: 2000, memory: 2048 })
    run = await waitForRun(client, started.id)
  }

  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Apify run ended with status ${run.status}`)
  }

  console.log('[RecruiterApify] Fetching dataset items...')
  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  return items
}

async function runRecruiterApifyPipeline(existingRunId) {
  const runId = new Date().toISOString()
  const rawItems = await fetchDatasetItems(existingRunId)
  const leads = normalizeItems(rawItems, runId)
  console.log(`[RecruiterApify] Scraped ${rawItems.length}, matched ${leads.length} recruiter leads`)

  const result = await upsertRecruiters(leads)
  return { ...result, scraped: rawItems.length, matched: leads.length, runId }
}

module.exports = {
  runRecruiterApifyPipeline,
  normalizeApifyItem,
  normalizeItems,
}

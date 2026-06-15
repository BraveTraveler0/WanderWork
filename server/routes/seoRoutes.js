'use strict'

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()

const APP_URL = 'https://wanderwork.io'
const BACKEND_URL = process.env.BACKEND_URL || 'https://wanderwork-backend-server.onrender.com'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function xmlDate(d) {
  return d ? new Date(d).toISOString() : new Date().toISOString()
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function jobSlug(job) {
  const title = String(job.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const company = String(job.company || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = String(job._id)
  return `${title}-at-${company}-${id}`
}

// ─── IndexNow key verification file ──────────────────────────────────────────
// IndexNow requires hosting a key file at a known URL to prove domain ownership.
// Set INDEXNOW_KEY in .env, then submit https://wanderwork.io/feeds/indexnow-{key}.txt to Bing.

router.get('/feeds/indexnow-:key.txt', (req, res) => {
  const key = process.env.INDEXNOW_KEY
  if (!key || req.params.key !== key) return res.status(404).send('Not found')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.send(key)
})

// ─── Sitemap index ───────────────────────────────────────────────────────────

router.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  const now = xmlDate(new Date())
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${APP_URL}/sitemaps/static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${APP_URL}/sitemaps/jobs-live.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`)
})

// ─── Static pages sitemap ─────────────────────────────────────────────────────

router.get('/sitemaps/static.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  const now = xmlDate(new Date())

  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/remote-jobs', priority: '1.0', changefreq: 'hourly' },
    { url: '/digital-nomad-jobs', priority: '0.9', changefreq: 'hourly' },
    { url: '/work-from-home-jobs', priority: '0.9', changefreq: 'hourly' },
    { url: '/ai-job-search', priority: '0.8', changefreq: 'weekly' },
    { url: '/resume-cover-letter-ai', priority: '0.8', changefreq: 'weekly' },
    { url: '/about', priority: '0.6', changefreq: 'monthly' },
    { url: '/privacy', priority: '0.3', changefreq: 'monthly' },
    { url: '/support', priority: '0.3', changefreq: 'monthly' },
  ]

  const urls = staticPages.map(p => `  <url>
    <loc>${APP_URL}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`)
})

// ─── Live jobs sitemap ────────────────────────────────────────────────────────

router.get('/sitemaps/jobs-live.xml', async (req, res) => {
  try {
    const col = mongoose.connection.collection('jobseeker.jobs')
    // No date filter — purgeJobs already removes stale/low-quality jobs.
    // The sitemap reflects whatever is live in the DB right now.
    const jobs = await col.find(
      {},
      { projection: { _id: 1, title: 1, company: 1, datePosted: 1 } }
    ).sort({ datePosted: -1 }).limit(49000).toArray()

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=1800')

    const urls = jobs.map(job => {
      const slug = jobSlug(job)
      const lastmod = xmlDate(job.datePosted)
      return `  <url>
    <loc>${APP_URL}/jobs/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    }).join('\n')

    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`)
  } catch (err) {
    console.error('[SEO] jobs sitemap error:', err.message)
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>')
  }
})

// ─── Public job feed (JSON) ───────────────────────────────────────────────────

router.get('/feeds/jobs.json', async (req, res) => {
  try {
    const col = mongoose.connection.collection('jobseeker.jobs')
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // match purge window

    const jobs = await col.find(
      { datePosted: { $gte: cutoff } },
      {
        projection: {
          _id: 1, title: 1, company: 1, url: 1, salary: 1,
          jobType: 1, datePosted: 1, description_short: 1,
          has_recruiter: 1, tags: 1, location: 1,
        },
      }
    ).sort({ datePosted: -1 }).limit(500).toArray()

    const items = jobs.map(job => ({
      id: String(job._id),
      title: job.title,
      company: job.company,
      url: `${APP_URL}/jobs/${jobSlug(job)}`,
      applyUrl: job.url,
      salary: job.salary || null,
      employmentType: job.jobType || null,
      datePosted: job.datePosted ? new Date(job.datePosted).toISOString().split('T')[0] : null,
      description: job.description_short || null,
      remote: true,
      location: job.location || null,
      tags: job.tags || [],
    }))

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=1800')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({ updated: new Date().toISOString(), count: items.length, jobs: items })
  } catch (err) {
    console.error('[SEO] jobs feed error:', err.message)
    res.status(500).json({ error: 'Feed temporarily unavailable' })
  }
})

// ─── Public job feed (XML/RSS) ────────────────────────────────────────────────

router.get('/feeds/jobs.xml', async (req, res) => {
  try {
    const col = mongoose.connection.collection('jobseeker.jobs')
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const jobs = await col.find(
      { datePosted: { $gte: cutoff } },
      { projection: { _id: 1, title: 1, company: 1, url: 1, salary: 1, jobType: 1, datePosted: 1, description_short: 1 } }
    ).sort({ datePosted: -1 }).limit(500).toArray()

    const items = jobs.map(job => {
      const slug = jobSlug(job)
      const pubDate = job.datePosted ? new Date(job.datePosted).toUTCString() : new Date().toUTCString()
      return `    <item>
      <title>${escapeXml(job.title)} — ${escapeXml(job.company)}</title>
      <link>${APP_URL}/jobs/${slug}</link>
      <guid isPermaLink="true">${APP_URL}/jobs/${slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(job.description_short || '')}</description>
      <category>Remote Jobs</category>
    </item>`
    }).join('\n')

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=1800')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>WanderWork — Remote Jobs Feed</title>
    <link>${APP_URL}/remote-jobs</link>
    <description>Fresh remote, work-from-home, and digital nomad-friendly jobs updated every 6 hours.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${APP_URL}/feeds/jobs.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`)
  } catch (err) {
    console.error('[SEO] RSS feed error:', err.message)
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>')
  }
})

// ─── Individual job page (SSR) ───────────────────────────────────────────────

function jobPageHtml(job) {
  const title = escapeXml(job.title || 'Job')
  const company = escapeXml(job.company || '')
  const description = escapeXml(job.description_short || '')
  const salary = job.salary ? escapeXml(job.salary) : null
  const jobType = job.jobType || 'FULL_TIME'
  const applyUrl = job.url || APP_URL
  const datePosted = job.datePosted ? new Date(job.datePosted).toISOString().split('T')[0] : null
  const validThrough = job.datePosted
    ? new Date(new Date(job.datePosted).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null
  const slug = jobSlug(job)
  const canonicalUrl = `${APP_URL}/jobs/${slug}`
  const tags = Array.isArray(job.tags) ? job.tags.slice(0, 8) : []

  // JobPosting JSON-LD
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    '@id': `${canonicalUrl}#job`,
    title: job.title || '',
    description: job.description_short || '',
    datePosted,
    validThrough,
    employmentType: jobType === 'FULL_TIME' ? 'FULL_TIME' : jobType === 'PART_TIME' ? 'PART_TIME' : 'CONTRACTOR',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company || '',
      ...(job.company_url ? { sameAs: job.company_url } : {}),
    },
    identifier: {
      '@type': 'PropertyValue',
      name: job.company || '',
      value: String(job._id),
    },
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: { '@type': 'Country', name: 'Worldwide' },
    url: canonicalUrl,
    directApply: Boolean(job.ats_direct),
    ...(salary ? {
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: 'USD',
        value: { '@type': 'QuantitativeValue', value: salary, unitText: 'YEAR' },
      },
    } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Remote Jobs', item: `${APP_URL}/remote-jobs` },
      { '@type': 'ListItem', position: 2, name: `${job.title} at ${job.company}`, item: canonicalUrl },
    ],
  }

  const metaDesc = `Apply for ${job.title} at ${job.company}. ${salary ? `Salary: ${job.salary}. ` : ''}Remote position${datePosted ? ` posted ${datePosted}` : ''}. View full job details and generate a tailored resume and cover letter.`
  const tagPills = tags.map(t => `<span class="tag">${escapeXml(String(t))}</span>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} at ${company} — Remote Job | WanderWork</title>
  <meta name="description" content="${escapeXml(metaDesc)}"/>
  <meta name="robots" content="index, follow"/>
  <link rel="canonical" href="${canonicalUrl}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${title} at ${company} | WanderWork"/>
  <meta property="og:description" content="${escapeXml(metaDesc)}"/>
  <meta property="og:url" content="${canonicalUrl}"/>
  <meta property="og:site_name" content="WanderWork"/>
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f4f6f7;color:#1f2937;line-height:1.6}
    .wrap{max-width:760px;margin:0 auto;padding:32px 20px 64px}
    .brand{display:block;font-size:13px;font-weight:700;letter-spacing:3px;color:#306770;margin-bottom:24px;text-decoration:none}
    .card{background:#fff;border-radius:20px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,.07);margin-bottom:20px}
    .breadcrumb{font-size:12px;color:#9ca3af;margin-bottom:20px}
    .breadcrumb a{color:#306770;text-decoration:none}
    .breadcrumb span{margin:0 6px}
    .badge{display:inline-block;background:#f0f7f8;color:#306770;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:4px 10px;border-radius:6px;margin-bottom:16px}
    h1{font-size:26px;font-weight:800;color:#1f2937;margin-bottom:6px;line-height:1.25}
    .company{font-size:16px;color:#4b6a73;font-weight:600;margin-bottom:20px}
    .meta-row{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
    .meta-pill{background:#f0f7f8;color:#306770;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px}
    .salary{background:#e6f4f1;color:#1e5560}
    .section-label{font-size:11px;font-weight:700;color:#306770;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
    .description{font-size:14px;color:#4b5563;line-height:1.75}
    .tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
    .tag{background:#f9fafb;border:1px solid #e5e7eb;color:#6b7280;font-size:12px;padding:3px 10px;border-radius:6px}
    .cta{display:inline-block;background:linear-gradient(135deg,#112e33 0%,#1e5560 55%,#306770 100%);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:.3px}
    .cta-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
    .cta-secondary{font-size:13px;color:#306770;text-decoration:none;font-weight:600}
    .related-label{font-size:13px;font-weight:700;color:#1f2937;margin-bottom:12px}
    .related-link{display:block;font-size:13px;color:#306770;text-decoration:none;padding:8px 0;border-bottom:1px solid #f0f0f0}
    .related-link:last-child{border-bottom:none}
    footer{margin-top:40px;text-align:center;font-size:12px;color:#9ca3af}
    footer a{color:#306770;text-decoration:none}
  </style>
</head>
<body>
<div class="wrap">
  <a href="${APP_URL}" class="brand">WANDER/WORK</a>

  <p class="breadcrumb">
    <a href="${APP_URL}">Home</a><span>›</span>
    <a href="${APP_URL}/remote-jobs">Remote Jobs</a><span>›</span>
    ${title} at ${company}
  </p>

  <div class="card">
    <span class="badge">Remote Job</span>
    <h1>${title}</h1>
    <p class="company">${company}</p>

    <div class="meta-row">
      <span class="meta-pill">Remote</span>
      ${salary ? `<span class="meta-pill salary">${escapeXml(salary)}</span>` : ''}
      ${jobType ? `<span class="meta-pill">${escapeXml(jobType.replace(/_/g, ' '))}</span>` : ''}
      ${datePosted ? `<span class="meta-pill">Posted ${datePosted}</span>` : ''}
    </div>

    ${description ? `
    <p class="section-label">About the Role</p>
    <div class="description">${description}</div>
    ` : ''}

    ${tagPills ? `<div class="tags">${tagPills}</div>` : ''}

    <div style="margin-top:28px;" class="cta-row">
      <a href="${escapeXml(applyUrl)}" class="cta" target="_blank" rel="noopener noreferrer">Apply Now</a>
      <a href="${APP_URL}?signup=true" class="cta-secondary">Get AI resume help →</a>
    </div>
  </div>

  <div class="card">
    <p class="related-label">More Remote Jobs</p>
    <a href="${APP_URL}/remote-jobs" class="related-link">Browse all remote jobs →</a>
    <a href="${APP_URL}/digital-nomad-jobs" class="related-link">Digital nomad jobs →</a>
    <a href="${APP_URL}/work-from-home-jobs" class="related-link">Work from home jobs →</a>
    <a href="${APP_URL}?signup=true" class="related-link">Get AI-matched jobs for your profile →</a>
  </div>

  <footer>
    <p><a href="${APP_URL}">WanderWork</a> &nbsp;·&nbsp; <a href="${APP_URL}/about">About</a> &nbsp;·&nbsp; <a href="${APP_URL}/privacy">Privacy</a> &nbsp;·&nbsp; <a href="${APP_URL}/terms">Terms</a></p>
    <p style="margin-top:8px">Remote job data updated every 6 hours.</p>
  </footer>
</div>
</body>
</html>`
}

router.get('/jobs/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const idMatch = slug.match(/[0-9a-f]{24}$/i)
    if (!idMatch) return res.status(404).send(jobNotFoundHtml())

    const col = mongoose.connection.collection('jobseeker.jobs')
    const { ObjectId } = require('mongodb')

    let job
    try {
      job = await col.findOne({ _id: new ObjectId(idMatch[0]) })
    } catch {
      return res.status(404).send(jobNotFoundHtml())
    }

    if (!job) return res.status(404).send(jobNotFoundHtml())

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    res.send(jobPageHtml(job))
  } catch (err) {
    console.error('[SEO] job page error:', err.message)
    res.status(500).send(jobNotFoundHtml())
  }
})

function jobNotFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Job Not Found | WanderWork</title>
  <meta name="robots" content="noindex"/>
  <style>body{font-family:system-ui,sans-serif;background:#f4f6f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .box{background:#fff;border-radius:20px;padding:48px;text-align:center;max-width:480px;box-shadow:0 4px 24px rgba(0,0,0,.07)}
  h1{color:#306770;font-size:22px;font-weight:800;margin-bottom:12px}p{color:#6b7280;font-size:14px;margin-bottom:24px}
  a{display:inline-block;background:#306770;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px}</style>
</head>
<body>
<div class="box">
  <h1>WANDER/WORK</h1>
  <p>This job listing has expired or been removed. Browse our latest remote jobs below.</p>
  <a href="${APP_URL}/remote-jobs">Browse Remote Jobs</a>
</div>
</body>
</html>`
}

module.exports = router

'use strict'

const { base } = require('./mail.templates')

const FROM_EMAIL = { name: 'Alice @ Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' }

function adminDigestEmail({ weekStart, weekEnd, stats }) {
  const fmt = (n) => Number(n ?? 0).toLocaleString()
  const pct = (n, d) => d ? `${Math.round((n / d) * 100)}%` : '—'
  const date = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'

  const statCard = (label, value, sub = '') =>
    `<td style="padding:0 6px 12px;width:33.33%;vertical-align:top;">
      <div style="background:#f0f7f8;border-radius:14px;padding:16px 12px;text-align:center;">
        <p style="margin:0 0 2px;font-size:26px;font-weight:800;color:#112e33;line-height:1;">${value}</p>
        <p style="margin:0;font-size:10px;font-weight:700;color:#306770;text-transform:uppercase;letter-spacing:0.8px;">${label}</p>
        ${sub ? `<p style="margin:3px 0 0;font-size:10px;color:#9ca3af;">${sub}</p>` : ''}
      </div>
    </td>`

  const sectionLabel = (title, sub = '') =>
    `<p style="margin:28px 0 4px;font-size:11px;font-weight:700;color:#306770;text-transform:uppercase;letter-spacing:1.5px;">${title}</p>
     ${sub ? `<p style="margin:0 0 12px;font-size:12px;color:#9ca3af;">${sub}</p>` : '<div style="height:12px;"></div>'}`

  const divider = `<div style="height:1px;background:#f0f0f0;margin:20px 0 0;"></div>`

  // Auto-insights
  const insights = []

  if (stats.newCandidates === 0) {
    insights.push('Zero new signups this week. Worth a LinkedIn post or a quick referral nudge.')
  } else if (stats.newCandidates < 3) {
    insights.push(`Only ${stats.newCandidates} new signup${stats.newCandidates === 1 ? '' : 's'} this week — growth is slow. A short social post could help.`)
  } else {
    insights.push(`${stats.newCandidates} new signups this week — momentum is good.`)
  }

  const pairingRate = stats.totalCandidates > 0
    ? Math.round((stats.candidatesWithPairings / stats.totalCandidates) * 100)
    : 0
  if (pairingRate < 60) {
    insights.push(`Only ${pairingRate}% of candidates have job matches. Check that pairAllCandidates is running after each import.`)
  } else {
    insights.push(`${pairingRate}% of candidates have job matches — the matching pipeline looks healthy.`)
  }

  if (stats.jobsWithoutDescription > 0) {
    insights.push(`${stats.jobsWithoutDescription} jobs still need description cleaning — OpenAI cleaning may be behind.`)
  }

  if (stats.newJobs < 50) {
    insights.push(`Only ${stats.newJobs} new jobs imported this week. ATS sources or Remotive fallback may need attention.`)
  } else {
    insights.push(`${stats.newJobs} new jobs imported — the feed is staying fresh.`)
  }

  if (stats.recruiterEmailsSent === 0) {
    insights.push('No recruiter outreach emails sent this week. Candidates may not know the feature exists.')
  } else {
    insights.push(`${stats.recruiterEmailsSent} recruiter outreach email${stats.recruiterEmailsSent === 1 ? '' : 's'} sent — candidates are using the feature.`)
  }

  if (stats.materialsGenerated > 0) {
    insights.push(`${stats.materialsGenerated} resume/cover letter${stats.materialsGenerated === 1 ? '' : 's'} generated — AI tools are being used.`)
  }

  const insightList = insights.map(text =>
    `<tr>
      <td width="16" valign="top" style="padding:4px 10px 4px 0;font-size:14px;color:#36BF8F;line-height:1;">&#8250;</td>
      <td style="padding:4px 0;font-size:13px;color:#4b6a73;line-height:1.6;">${text}</td>
    </tr>`
  ).join('')

  const topCompaniesRows = (stats.topCompanies || []).length
    ? stats.topCompanies.map((c, i) =>
        `<tr>
          <td style="padding:6px 0;font-size:13px;color:#1f2937;border-bottom:1px solid #f0f0f0;">${i + 1}. ${c.company}</td>
          <td style="padding:6px 0;font-size:13px;color:#9ca3af;text-align:right;border-bottom:1px solid #f0f0f0;">${c.count} jobs</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="2" style="font-size:13px;color:#9ca3af;padding:6px 0;">No data</td></tr>`

  const content = `
    <!-- Gradient hero banner -->
    <div style="background:linear-gradient(135deg,#112e33 0%,#1e5560 55%,#306770 100%);border-radius:14px;padding:28px 32px;margin-bottom:32px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(180,215,220,0.8);text-transform:uppercase;">Founder Digest</p>
      <p style="margin:0 0 2px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Weekly Stats</p>
      <p style="margin:0;font-size:13px;color:rgba(180,215,220,0.75);">${date(weekStart)} — ${date(weekEnd)}</p>
    </div>

    <!-- Growth -->
    ${sectionLabel('Growth', 'New users and account activity this week')}
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        ${statCard('New Signups', fmt(stats.newCandidates), `${fmt(stats.totalCandidates)} total`)}
        ${statCard('With Resume', fmt(stats.candidatesWithResume), pct(stats.candidatesWithResume, stats.totalCandidates) + ' of all')}
        ${statCard('Paid Plans', fmt(stats.paidCandidates), pct(stats.paidCandidates, stats.totalCandidates) + ' of all')}
      </tr>
    </table>

    ${divider}

    <!-- Job Inventory -->
    ${sectionLabel('Job Inventory', 'Feed health and coverage')}
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        ${statCard('New Jobs', fmt(stats.newJobs), 'added this week')}
        ${statCard('Total Jobs', fmt(stats.totalJobs), 'in database')}
        ${statCard('With Recruiter', fmt(stats.jobsWithRecruiter), pct(stats.jobsWithRecruiter, stats.totalJobs) + ' of all')}
      </tr>
      <tr>
        ${statCard('Cleaned', fmt(stats.jobsCleaned), pct(stats.jobsCleaned, stats.totalJobs) + ' complete')}
        ${statCard('Need Cleaning', fmt(stats.jobsWithoutDescription), 'pending OpenAI')}
      </tr>
    </table>

    ${divider}

    <!-- Matching -->
    ${sectionLabel('Matching & Engagement', 'How well candidates are being served')}
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        ${statCard('New Pairings', fmt(stats.newPairings), 'created this week')}
        ${statCard('Users Matched', fmt(stats.candidatesWithPairings), pct(stats.candidatesWithPairings, stats.totalCandidates) + ' of users')}
        ${statCard('Avg Score', stats.avgMatchScore ? stats.avgMatchScore.toFixed(1) : '—', 'new pairings')}
      </tr>
    </table>

    ${divider}

    <!-- Feature Usage -->
    ${sectionLabel('Feature Usage', 'AI tools and outreach this week')}
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        ${statCard('AI Docs Made', fmt(stats.materialsGenerated), 'resumes + letters')}
        ${statCard('Recruiter Emails', fmt(stats.recruiterEmailsSent), 'sent this week')}
        ${statCard('Tokens Spent', fmt(stats.tokensSpentTotal), 'platform-wide')}
      </tr>
    </table>

    ${divider}

    <!-- Insights -->
    ${sectionLabel('Auto-Insights')}
    <table cellpadding="0" cellspacing="0" width="100%">
      ${insightList}
    </table>

    ${divider}

    <!-- Top Companies -->
    ${sectionLabel('Top Companies in Feed')}
    <table cellpadding="0" cellspacing="0" width="100%">
      ${topCompaniesRows}
    </table>

    <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
      — The Wander/Work Team
    </p>
  `

  return {
    from: FROM_EMAIL,
    to: 'darrienccarter@gmail.com',
    subject: `WW Digest: ${fmt(stats.newCandidates)} new signup${stats.newCandidates === 1 ? '' : 's'} · ${fmt(stats.newJobs)} new jobs · ${date(weekStart)}`,
    html: base(content),
  }
}

module.exports = { adminDigestEmail }

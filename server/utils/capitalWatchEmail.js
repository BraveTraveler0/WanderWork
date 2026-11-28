'use strict'

const FROM_EMAIL = { name: 'Capital Watch', email: process.env.EMAIL_FROM || 'support@wanderwork.io' }

const MONO = "Menlo,Consolas,'Liberation Mono','Courier New',monospace"
const YELLOW = '#FACC15'
const LINE = '#e5e7eb'
const SUBTLE = '#9ca3af'

// Scraped links go into href attributes: only http(s), and escaped so a stray quote
// in a URL can't break out of the attribute.
function safeHref(url) {
  const u = String(url || '').trim()
  return /^https?:\/\//i.test(u) ? escapeHtml(u) : '#'
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

// --- Geometric accents, kept email-client-safe (border tricks + rotated squares, no SVG) ---

function shapeTriangle(color, size = 10) {
  return `<span style="display:inline-block;width:0;height:0;border-left:${Math.round(size * 0.6)}px solid transparent;border-right:${Math.round(size * 0.6)}px solid transparent;border-bottom:${size}px solid ${color};vertical-align:middle;"></span>`
}

function shapeDiamond(color, size = 8, filled = true) {
  const fill = filled ? `background:${color};` : `background:transparent;border:1.5px solid ${color};`
  return `<span style="display:inline-block;width:${size}px;height:${size}px;${fill}transform:rotate(45deg);vertical-align:middle;"></span>`
}

function shapeRect(color, w = 11, h = 8, filled = false) {
  const fill = filled ? `background:${color};` : `background:transparent;border:1.5px solid ${color};`
  return `<span style="display:inline-block;width:${w}px;height:${h}px;${fill}vertical-align:middle;"></span>`
}

function header() {
  return `
    <div style="background:${YELLOW};border-bottom:1px solid #000;padding:18px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;">${shapeTriangle('rgba(0,0,0,.55)', 11)}<span style="margin-left:8px;">Capital Watch <span style="opacity:.55;">/</span></span></td>
        <td align="right" style="font-family:${MONO};color:rgba(0,0,0,.35);font-size:15px;">+</td>
      </tr></table>
    </div>`
}

function footer(dashboardUrl, label, unsubscribeUrl) {
  const cta = dashboardUrl
    ? `<div style="padding:24px 0 4px;"><a href="${safeHref(dashboardUrl)}" style="display:inline-block;background:${YELLOW};border:1px solid #000;color:#000;padding:11px 20px;text-decoration:none;font-weight:700;font-family:${MONO};font-size:13px;">${label || 'Review on the dashboard'} &rarr;</a></div>`
    : ''
  const unsub = unsubscribeUrl
    ? `<div style="margin-top:8px;text-transform:none;letter-spacing:0;">You get this because you have a Capital Watch account. <a href="${safeHref(unsubscribeUrl)}" style="color:${SUBTLE};">Stop these emails</a></div>`
    : ''
  return `
    ${cta}
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid ${LINE};font-family:${MONO};font-size:11px;color:${SUBTLE};text-transform:uppercase;letter-spacing:0.4px;">
      ${shapeTriangle('#d1d5db', 7)}<span style="margin-left:6px;">Capital Watch</span>
      ${unsub}
    </div>`
}

function shell(contentHtml) {
  return `
    <div style="background:#f4f4f5;padding:28px 12px;font-family:${MONO};">
      <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid ${LINE};">
        ${header()}
        <div style="padding:26px 24px 24px;color:#111827;">${contentHtml}</div>
      </div>
    </div>`
}

function metaLine(g) {
  return `<div style="font-size:12px;color:#6b7280;margin:4px 0 0;padding-left:16px;">${escapeHtml(g.agency || '')} &middot; ${escapeHtml(g.fundingType || '')} &middot; ${g.amountUsd ? '$' + g.amountUsd : 'Amount not stated'}</div>`
}

function grantLink(g) {
  return `${shapeDiamond('#000', 7)}<a href="${safeHref(g.link)}" style="margin-left:8px;color:#000;font-weight:700;text-decoration:none;border-bottom:2px solid ${YELLOW};">${escapeHtml(g.title)}</a>`
}

function weeklyDigestEmail(newGrants, dashboardUrl) {
  const rows = newGrants.map((g, i) => `
    <div style="padding:14px 0;${i < newGrants.length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">
      <div>${grantLink(g)}</div>
      ${metaLine(g)}
    </div>`).join('')

  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 18px;">${shapeTriangle('#000', 12)}<span style="margin-left:9px;">${newGrants.length} new funding opportunit${newGrants.length === 1 ? 'y' : 'ies'}</span></h1>
    ${rows}
    ${footer(dashboardUrl)}
  `)

  return {
    from: FROM_EMAIL,
    subject: `Capital Watch: ${newGrants.length} new funding opportunit${newGrants.length === 1 ? 'y' : 'ies'} found`,
    html,
  }
}

function matchReasons(grant) {
  const demo = grant.targetDemographics || []
  const reasons = []
  if (demo.includes('black') || demo.includes('african_american')) reasons.push('Black-owned eligible')
  if (demo.includes('veteran') || demo.includes('military')) reasons.push('Veteran-owned eligible')
  const loc = `${grant.location || ''} ${grant.title || ''} ${grant.agency || ''}`.toLowerCase()
  if (/atlanta|georgia/.test(loc)) reasons.push('Atlanta/Georgia')
  if (grant.amountUsd >= 5000) reasons.push(`High payout ($${grant.amountUsd.toLocaleString()})`)
  if (grant.fundingType === 'grant') reasons.push('Grant (non-dilutive)')
  if (/\bangel\b/.test((grant.title || '').toLowerCase()) || /\bangel\b/.test((grant.agency || '').toLowerCase())) reasons.push('Angel funding')
  if (!grant.requirements) reasons.push('Minimal stated paperwork')
  if (grant.rolling) reasons.push('Rolling deadline')
  return reasons
}

function amountChip(amountUsd) {
  if (!amountUsd) return ''
  return `<span style="display:inline-block;background:${YELLOW};border:1px solid #000;padding:4px 9px;font-family:${MONO};font-size:12px;font-weight:700;color:#000;white-space:nowrap;">$${amountUsd.toLocaleString()}</span>`
}

function matchCard(g, i) {
  // Per-business reasons from the matcher when present; the team's original rules otherwise.
  const reasons = Array.isArray(g.reasons) ? g.reasons : matchReasons(g)
  return `
    <div style="border:1px solid #000;padding:18px;margin-bottom:14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${MONO};font-size:11px;color:${SUBTLE};font-weight:700;letter-spacing:0.3px;">${shapeDiamond('#000', 6)}<span style="margin-left:7px;">#${i + 1}</span></td>
        <td align="right">${amountChip(g.amountUsd)}</td>
      </tr></table>
      <div style="margin-top:10px;">
        <a href="${safeHref(g.link)}" style="font-family:${MONO};font-size:18px;font-weight:700;line-height:1.35;color:#000;text-decoration:none;border-bottom:2px solid ${YELLOW};">${escapeHtml(g.title)}</a>
      </div>
      <div style="font-size:12.5px;color:#6b7280;margin-top:6px;">${escapeHtml(g.agency || '')}${g.agency && g.fundingType ? ' &middot; ' : ''}${escapeHtml(g.fundingType || '')}</div>
      ${reasons.length ? `<div style="font-size:12px;color:#6b7280;margin-top:10px;padding-top:10px;border-top:1px solid ${LINE};">${reasons.map(escapeHtml).join(' &middot; ')}</div>` : ''}
    </div>`
}

function topMatchesDigestEmail(rankedGrants, dashboardUrl) {
  const cards = rankedGrants.map((g, i) => matchCard(g, i)).join('')

  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 8px;">${shapeTriangle('#000', 12)}<span style="margin-left:9px;">Top ${rankedGrants.length} Best Matches</span></h1>
    <p style="color:#6b7280;font-size:13px;margin:0 0 18px;">Ranked for fit: Black-owned/veteran-owned eligibility, Atlanta/Georgia location, grants and angel funding over loans/accelerators/contests, and minimal paperwork to apply.</p>
    ${cards}
    ${footer(dashboardUrl)}
  `)

  return {
    from: FROM_EMAIL,
    subject: `Capital Watch: Top ${rankedGrants.length} best-matched opportunities`,
    html,
  }
}

const STATUS_SHAPE = {
  drafted: { shape: shapeDiamond('#000', 8), label: 'Drafted' },
  needs_input: { shape: shapeTriangle('#ca8a04', 10), label: 'Needs your input' },
  not_applicable: { shape: shapeRect('#9ca3af', 10, 7, false), label: 'N/A' },
}

function applicationDraftEmail(grant, companyName) {
  const checklist = grant.requirementsChecklist || []
  const needsInput = checklist.filter(c => c.status === 'needs_input')
  const checklistRows = checklist.map(c => {
    const status = STATUS_SHAPE[c.status] || { shape: shapeRect('#9ca3af', 10, 7, false), label: c.status }
    return `
    <div style="margin-bottom:12px;">
      <div><strong>${escapeHtml(c.requirement)}</strong> <span style="margin-left:6px;">${status.shape}</span> <span style="font-family:${MONO};font-size:11px;text-transform:uppercase;letter-spacing:0.3px;color:#4b5563;">${status.label}</span></div>
      <div style="color:#6b7280;font-size:13px;margin-top:2px;">${escapeHtml(c.detail || '')}</div>
    </div>`
  }).join('')

  const sectionTitle = (label) => `<h2 style="font-family:${MONO};font-size:14px;font-weight:700;color:#000;border-bottom:2px solid #000;padding-bottom:8px;margin:28px 0 14px;">${shapeRect('#000', 9, 9, true)}<span style="margin-left:9px;">${label}</span></h2>`

  const html = shell(`
    <h1 style="font-family:${MONO};font-size:18px;font-weight:700;color:#000;margin:0 0 4px;">${shapeDiamond('#000', 9)}<span style="margin-left:9px;">Application Draft Ready</span></h1>
    <p style="color:#6b7280;font-size:13px;margin:0;">for ${escapeHtml(companyName)}</p>

    ${sectionTitle('Opportunity Details')}
    <div style="font-size:13px;line-height:1.7;">
      <div><span style="color:#6b7280;">Title:</span> <strong>${escapeHtml(grant.title || 'Untitled')}</strong></div>
      <div><span style="color:#6b7280;">Agency:</span> ${escapeHtml(grant.agency || 'Unknown')}</div>
      <div><span style="color:#6b7280;">Type:</span> ${escapeHtml(grant.fundingType || 'grant')}</div>
      <div><span style="color:#6b7280;">Amount:</span> ${grant.amountUsd ? '$' + grant.amountUsd : 'N/A'}</div>
      <div><span style="color:#6b7280;">Deadline:</span> ${grant.rolling ? 'Rolling' : (grant.dueDate || 'N/A')}</div>
      <div><span style="color:#6b7280;">Link:</span> <a href="${safeHref(grant.link)}" style="color:#000;border-bottom:2px solid ${YELLOW};text-decoration:none;">${escapeHtml(grant.link || 'N/A')}</a></div>
      <div><span style="color:#6b7280;">Requirements (as stated):</span> ${escapeHtml(grant.requirements || 'Not stated')}</div>
    </div>

    ${sectionTitle(needsInput.length ? `${needsInput.length} Item${needsInput.length === 1 ? '' : 's'} Need Your Input` : 'Everything Drafted, Ready to Review')}
    <div style="background:#fffbeb;border-left:3px solid ${YELLOW};padding:14px 16px;">
      ${checklistRows || '<div style="color:#6b7280;font-size:13px;">No requirements checklist generated.</div>'}
    </div>

    ${sectionTitle('Outreach Email')}
    <div style="background:#f9fafb;border-left:3px solid #000;padding:14px 16px;font-size:13px;white-space:pre-wrap;">${escapeHtml(grant.outreachEmail || 'N/A')}</div>

    ${sectionTitle('Application Narrative')}
    <div style="background:#f9fafb;border-left:3px solid #000;padding:14px 16px;font-size:13px;white-space:pre-wrap;">${escapeHtml(grant.applicationNarrative || 'N/A')}</div>

    <div style="margin-top:26px;font-size:13px;color:#374151;">
      <strong>Next steps:</strong>
      <ul style="padding-left:18px;margin:8px 0;">
        <li>Review the drafted sections above and the checklist for anything marked "Needs your input"</li>
        <li>Gather/attach whatever's flagged above (documents, signatures, etc.)</li>
        <li>Copy/paste into the application portal and submit before the deadline</li>
      </ul>
    </div>

    ${footer(null)}
  `)

  return {
    from: FROM_EMAIL,
    subject: `Application Draft (${companyName}): ${grant.agency || grant.title}${needsInput.length ? `: ${needsInput.length} item${needsInput.length === 1 ? '' : 's'} need input` : ''}`,
    html,
  }
}

// dueByTier: { '3d': [grant...], '7d': [...], '14d': [...] } -- keys match the tier
// keys used by the deadline-check cron in server/schedules/capitalWatchDeadlines.js.
// Shape per tier maps to urgency: triangle (warning) > diamond (mid) > rectangle (low).
// The one-time sign-in link. Also the welcome email for a new account.
function signInEmail(link, { isNew = false } = {}) {
  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 12px;">${shapeTriangle('#000', 12)}<span style="margin-left:9px;">${isNew ? 'Welcome to Capital Watch' : 'Sign in to Capital Watch'}</span></h1>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 6px;">${isNew
      ? 'Capital Watch finds grants, loans, investors and competitions, and ranks them for your business. Click below to confirm your email and sign in, then describe your business so we can match you. The link works once and expires in 20 minutes; you can always get a new one with "Email me a sign-in link".'
      : 'Click below to sign in. The link works once and expires in 20 minutes.'}</p>
    ${footer(link, isNew ? 'Confirm my email' : 'Sign in')}
    <p style="font-size:12px;color:${SUBTLE};margin:16px 0 0;">If you didn't ask for this, you can ignore it.</p>
  `)
  return { from: FROM_EMAIL, subject: isNew ? 'Welcome to Capital Watch: confirm your email' : 'Your Capital Watch sign-in link', html }
}

function passwordResetEmail(link) {
  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 12px;">${shapeTriangle('#000', 12)}<span style="margin-left:9px;">Reset your password</span></h1>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 6px;">Click below to choose a new password. The link works once and expires in 20 minutes.</p>
    ${footer(link, 'Choose a new password')}
    <p style="font-size:12px;color:${SUBTLE};margin:16px 0 0;">If you didn't ask for this, you can ignore it. Your password hasn't changed.</p>
  `)
  return { from: FROM_EMAIL, subject: 'Reset your Capital Watch password', html }
}

function welcomeEmail(dashboardUrl) {
  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 12px;">${shapeTriangle('#000', 12)}<span style="margin-left:9px;">Welcome to Capital Watch</span></h1>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 6px;">Capital Watch finds grants, loans, investors, competitions and accelerators every week and ranks them for your business. Describe your business on the dashboard to see your matches; we'll email you the best new ones each week.</p>
    ${footer(dashboardUrl, 'Open Capital Watch')}
  `)
  return { from: FROM_EMAIL, subject: 'Welcome to Capital Watch', html }
}

// Weekly: the best new matches for each of a member's businesses.
// sections: [{ businessName, matches: [grant with reasons] }]
function memberDigestEmail(sections, dashboardUrl, unsubscribeUrl) {
  const total = sections.reduce((n, s) => n + s.matches.length, 0)
  const body = sections.map((s) => `
    ${sections.length > 1 ? `<h2 style="font-family:${MONO};font-size:14px;font-weight:700;color:#000;border-bottom:2px solid #000;padding-bottom:8px;margin:24px 0 14px;">For ${escapeHtml(s.businessName)}</h2>` : ''}
    ${s.matches.map((g, i) => matchCard(g, i)).join('')}`).join('')
  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 8px;">${shapeTriangle('#000', 12)}<span style="margin-left:9px;">${total} new match${total === 1 ? '' : 'es'} this week</span></h1>
    <p style="color:#6b7280;font-size:13px;margin:0 0 18px;">Ranked against your business profile. Edit your profile on the dashboard to change what you see.</p>
    ${body}
    ${footer(dashboardUrl, 'See all matches', unsubscribeUrl)}
  `)
  return { from: FROM_EMAIL, subject: `Capital Watch: ${total} new funding match${total === 1 ? '' : 'es'} for you`, html }
}

function deadlineAlertEmail(dueByTier, dashboardUrl, unsubscribeUrl) {
  const sections = [
    { key: '3d', label: 'Final days, apply now', color: '#dc2626', shape: (c) => shapeTriangle(c, 12) },
    { key: '7d', label: '1 week left', color: '#ea580c', shape: (c) => shapeDiamond(c, 9) },
    { key: '14d', label: '2 weeks left', color: '#ca8a04', shape: (c) => shapeRect(c, 11, 8, false) },
  ]

  const sectionHtml = sections
    .filter((s) => dueByTier[s.key]?.length)
    .map((s) => {
      const rows = dueByTier[s.key].map((g, i) => `
        <div style="padding:12px 0;${i < dueByTier[s.key].length - 1 ? `border-bottom:1px solid ${LINE};` : ''}">
          <div>${shapeDiamond('#000', 6)}<a href="${safeHref(g.link)}" style="margin-left:8px;color:#000;font-weight:700;text-decoration:none;border-bottom:2px solid ${YELLOW};">${escapeHtml(g.title)}</a></div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;padding-left:14px;">${g.businessName ? `${escapeHtml(g.businessName)} &middot; ` : ''}Due ${escapeHtml(g.dueDate || '')} &middot; ${g.status === 'approved' ? 'Applied / in progress' : 'Saved for later'}</div>
        </div>`).join('')
      return `
        <h2 style="font-family:${MONO};font-size:14px;font-weight:700;color:${s.color};border-bottom:2px solid ${s.color};padding-bottom:8px;margin:24px 0 4px;">${s.shape(s.color)}<span style="margin-left:9px;">${s.label} (${dueByTier[s.key].length})</span></h2>
        ${rows}`
    }).join('')

  const totalCount = sections.reduce((n, s) => n + (dueByTier[s.key]?.length || 0), 0)

  const html = shell(`
    <h1 style="font-family:${MONO};font-size:19px;font-weight:700;color:#000;margin:0 0 4px;">${shapeTriangle('#dc2626', 12)}<span style="margin-left:9px;">Deadline Alert</span></h1>
    ${sectionHtml}
    ${footer(dashboardUrl, null, unsubscribeUrl)}
  `)

  return {
    from: FROM_EMAIL,
    subject: `Capital Watch: ${totalCount} deadline${totalCount === 1 ? '' : 's'} approaching`,
    html,
  }
}

module.exports = { weeklyDigestEmail, topMatchesDigestEmail, applicationDraftEmail, deadlineAlertEmail, signInEmail, memberDigestEmail, passwordResetEmail, welcomeEmail, FROM_EMAIL }

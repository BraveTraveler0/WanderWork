'use strict'

// Reads an opportunity's web page so drafts can follow what the application actually
// asks for. Pulls out readable text and any form fields (labels, required flags,
// choices). If the page has no form but links to an application, follows that one link.
//
// Safety: http(s) only, public addresses only (no localhost or private networks, checked
// on every redirect), a 10 second timeout, and a 1.5 MB size cap.

const dns = require('dns').promises
const net = require('net')

const TIMEOUT_MS = 10000
const MAX_BYTES = 1.5 * 1024 * 1024
const MAX_REDIRECTS = 3
const MAX_TEXT = 12000

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7))
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

async function assertPublicUrl(raw) {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web pages can be read.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true })
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new Error('That address is not public.')
  return url
}

async function fetchHtml(raw) {
  let current = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current)
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CapitalWatchReader/1.0)', Accept: 'text/html,application/xhtml+xml' },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString()
      continue
    }
    if (!res.ok) throw new Error(`Page returned ${res.status}.`)
    if (!/html|xml/i.test(res.headers.get('content-type') || '')) throw new Error('Not a web page.')
    // Read with a size cap so a huge page can't tie up memory.
    const reader = res.body.getReader()
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) { await reader.cancel().catch(() => {}); break }
      chunks.push(value)
    }
    return { html: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8'), finalUrl: url.toString() }
  }
  throw new Error('Too many redirects.')
}

const decode = (s) => String(s || '')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
const stripTags = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : ''
}
const humanize = (name) => String(name || '').replace(/[_\-[\].]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password'])
const SKIP_NAMES = /csrf|token|captcha|honeypot|^utm|recaptcha|newsletter|search|^s$|^q$/i

function extractFields(html) {
  const labelsFor = {}
  for (const m of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const id = attr(m[1], 'for')
    if (id) labelsFor[id] = stripTags(m[2])
  }
  const fields = []
  const seen = new Set()
  const add = (field) => {
    const key = field.label.toLowerCase()
    if (!field.label || field.label.length < 2 || field.label.length > 200 || seen.has(key)) return
    seen.add(key)
    fields.push(field)
  }

  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>|<(input|textarea)\b([^>]*)>/gi)) {
    const isSelect = m[1] !== undefined
    const attrs = isSelect ? m[1] : m[4]
    const selectBody = isSelect ? m[2] : ''
    const tagName = isSelect ? 'select' : m[3].toLowerCase()
    const type = tagName === 'input' ? (attr(attrs, 'type') || 'text').toLowerCase() : tagName
    const name = attr(attrs, 'name')
    if (SKIP_TYPES.has(type) || SKIP_NAMES.test(name)) continue
    const id = attr(attrs, 'id')
    const label = labelsFor[id] || attr(attrs, 'aria-label') || attr(attrs, 'placeholder') || attr(attrs, 'title') || humanize(name)
    const options = selectBody
      ? [...selectBody.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)].map((o) => stripTags(o[1])).filter((o) => o && !/^(select|choose|--)/i.test(o)).slice(0, 20)
      : []
    add({ label: label.replace(/\s*\*\s*$/, ''), type, required: /\brequired\b/i.test(attrs) || /\*\s*$/.test(label), options })
    if (fields.length >= 60) break
  }

  // Google Forms keep their questions in a data blob rather than plain inputs.
  const gf = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/)
  if (gf) {
    try {
      const items = JSON.parse(gf[1])?.[1]?.[1] || []
      for (const item of items) {
        if (!item?.[1] || !Array.isArray(item[4])) continue
        const q = item[4][0]
        add({ label: String(item[1]), type: 'text', required: Boolean(q?.[2]), options: (q?.[1] || []).map((o) => String(o?.[0] || '')).filter(Boolean).slice(0, 20) })
      }
    } catch { /* not the shape we expected; fall back to the page text */ }
  }
  return fields
}

function extractText(html) {
  return stripTags(html
    .replace(/<(script|style|noscript|svg|nav|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/li|\/h\d|\/div)\b[^>]*>/gi, '\n'))
    .slice(0, MAX_TEXT)
}

function findApplyLink(html, baseUrl) {
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(m[2])
    const href = attr(m[1], 'href')
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue
    if (/\b(apply( now| here| online| today)?|start (your )?application|application form|submit (an )?application)\b/i.test(text)) {
      try { return new URL(href, baseUrl).toString() } catch { /* bad link */ }
    }
  }
  return null
}

// ─── Contact addresses ───────────────────────────────────────────────────────

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi
const FILE_RE = /\.(png|jpe?g|gif|svg|webp|css|js)$/i
const JUNK_DOMAIN_RE = /(^|\.)(example\.(com|org)|domain\.com|email\.com|sentry\.io|wixpress\.com|sentry-next\.wixpress\.com|godaddy\.com|squarespace\.com|yourdomain\.com)$/i
const BAD_LOCAL_RE = /^(no-?reply|donotreply|do-not-reply|privacy|webmaster|abuse|postmaster|press|media|news(letter)?|careers|jobs|hr|recruit(ing)?|unsubscribe|test|marketing|billing|accounts?payable|security|legal|dpo|foia)$/i
const GOOD_LOCAL_RE = /grant|fund|program|apply|application|award|loan|lend|invest|capital|small|business|entrepreneur|startup|accelerat|fellow|scholar|competition|challenge|prize|inquir|partner/i
const OK_LOCAL_RE = /^(info|contact|hello|help|support|admin|team|office|general)$/i

// Cloudflare hides addresses as data-cfemail="<hex>": the first byte is the XOR key.
function decodeCfEmail(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16)
    let out = ''
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
    return out
  } catch { return '' }
}

function extractEmails(html) {
  const found = new Set()
  const add = (e) => {
    const email = String(e || '').trim().toLowerCase().replace(/^mailto:/, '').split('?')[0]
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(email) || FILE_RE.test(email)) return
    if (JUNK_DOMAIN_RE.test(email.split('@')[1])) return
    found.add(email)
  }
  for (const m of html.matchAll(/href\s*=\s*["']mailto:([^"']+)["']/gi)) add(decodeURIComponent(m[1]))
  for (const m of html.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi)) add(decodeCfEmail(m[1]))
  const text = decode(html.replace(/<[^>]+>/g, ' '))
  for (const m of text.matchAll(EMAIL_RE)) add(m[0])
  // "grants [at] city [dot] gov" and similar.
  for (const m of text.matchAll(/([a-z0-9._%+-]+)\s*[[(]\s*at\s*[\])]\s*([a-z0-9-]+(?:\s*[[(]\s*dot\s*[\])]\s*[a-z0-9-]+)+)/gi)) {
    add(`${m[1]}@${m[2].replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.')}`)
  }
  return [...found].slice(0, 30)
}

const baseDomain = (host) => String(host || '').toLowerCase().replace(/^www\./, '').split('.').slice(-2).join('.')

// The address most likely to reach the program team, or '' when none looks right.
function pickContact(emails, siteUrl) {
  let site = ''
  try { site = baseDomain(new URL(siteUrl).hostname) } catch { /* no site */ }
  let best = ''
  let bestScore = 0
  for (const email of emails || []) {
    const [local, domain] = email.split('@')
    if (BAD_LOCAL_RE.test(local)) continue
    let score = 0
    if (site && baseDomain(domain) === site) score += 3
    if (GOOD_LOCAL_RE.test(local)) score += 3
    else if (OK_LOCAL_RE.test(local)) score += 1
    if (/\.(gov|org|edu)$/.test(domain)) score += 1
    if (score > bestScore) { best = email; bestScore = score }
  }
  // An off-site address with no program words is more likely a vendor than the program.
  return bestScore >= 3 ? best : ''
}

function findContactLink(html, baseUrl) {
  let fallback = null
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(m[2])
    const href = attr(m[1], 'href')
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue
    let url
    try { url = new URL(href, baseUrl) } catch { continue }
    if (/^contact( us)?$|^get in touch$/i.test(text) || /\/contact(-us)?\/?$/i.test(url.pathname)) return url.toString()
    if (!fallback && /\b(contact|staff|our team|about us)\b/i.test(text)) fallback = url.toString()
  }
  return fallback
}

// ─── Reading a page (cached a week) ──────────────────────────────────────────

let PageCache = null
const cacheModel = () => (PageCache ||= require('../models/CapitalWatch/capitalWatch.PageCache'))

async function readFresh(link) {
  const first = await fetchHtml(link)
  let fields = extractFields(first.html)
  let text = extractText(first.html)
  const emails = new Set(extractEmails(first.html))
  let applyUrl = null
  if (fields.length < 3) {
    const next = findApplyLink(first.html, first.finalUrl)
    if (next && next !== first.finalUrl) {
      applyUrl = next
      const second = await fetchHtml(next).catch(() => null)
      if (second) {
        const more = extractFields(second.html)
        if (more.length > fields.length) fields = more
        text = `${text}\n\nApplication page (${next}):\n${extractText(second.html)}`.slice(0, MAX_TEXT)
        extractEmails(second.html).forEach((e) => emails.add(e))
      }
    }
  }
  return { finalUrl: first.finalUrl, text, fields, applyUrl, emails: [...emails], contactPage: findContactLink(first.html, first.finalUrl) }
}

// Returns { url, text, fields, applyUrl, emails, contact, contactPage }, or null when the
// page can't be read. findContact: also open the site's contact page when the
// opportunity page itself has no usable address (one extra fetch, also cached).
// fresh: skip the cache ("Read the form again").
async function readOpportunityPage(link, { findContact = false, fresh = false } = {}) {
  if (!link) return null
  const Cache = cacheModel()
  try {
    let page = fresh ? null : await Cache.findOne({ url: link }).lean().catch(() => null)
    if (!page) {
      page = { url: link, ...(await readFresh(link)), contactChecked: false }
      await Cache.updateOne({ url: link }, { $set: { ...page, createdAt: new Date() } }, { upsert: true }).catch(() => {})
    }
    let contact = pickContact(page.emails, page.finalUrl || link)
    if (!contact && findContact && !page.contactChecked && page.contactPage) {
      const extra = await fetchHtml(page.contactPage).then((r) => extractEmails(r.html)).catch(() => [])
      page.emails = [...new Set([...(page.emails || []), ...extra])].slice(0, 40)
      page.contactChecked = true
      await Cache.updateOne({ url: link }, { $set: { emails: page.emails, contactChecked: true } }).catch(() => {})
      contact = pickContact(page.emails, page.finalUrl || link)
    }
    return { url: page.finalUrl || link, text: page.text || '', fields: page.fields || [], applyUrl: page.applyUrl || null, emails: page.emails || [], contact, contactPage: page.contactPage || null }
  } catch (err) {
    console.warn('[CapitalWatch] Could not read page:', link, err.message)
    return null
  }
}

module.exports = { readOpportunityPage, extractFields, extractEmails, pickContact, isPrivateIp }

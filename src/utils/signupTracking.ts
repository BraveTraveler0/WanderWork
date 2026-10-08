// Sign-up tracking. Remembers where a visitor first came from (UTM tags or a
// Facebook/Google ad click id, the first page they landed on), then on a real
// sign-up tells Google Analytics (sign_up), the Meta pixel
// (CompleteRegistration) and MarketGenius (signup_completed), so all three
// can say which ad, post or page brought each new user. Every call is
// fire-and-forget: tracking can never block or break sign-up.

const MG_TRACK_URL = 'https://marketinggenius-backend-server.onrender.com/api/track'
const PRODUCT_ID = 'wanderwork'
const FIRST_TOUCH_KEY = 'ww_first_touch'
const ANON_KEY = 'ww_anon_id'

type FirstTouch = { source: string; medium: string; campaign: string; content: string; landing: string; referrer: string; at: string }

declare global {
  interface Window { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void }
}

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(ANON_KEY, id) }
    return id
  } catch { return '' }
}

// Call once on load. Keeps the first touch (it isn't overwritten by later visits).
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(FIRST_TOUCH_KEY)) return
    const q = new URLSearchParams(window.location.search)
    const ref = document.referrer || ''
    let source = q.get('utm_source') || ''
    let medium = q.get('utm_medium') || ''
    if (!source && q.get('fbclid')) { source = /instagram/i.test(ref) ? 'ig' : 'fb'; medium = 'paid' }
    if (!source && (q.get('gclid') || q.get('gbraid') || q.get('wbraid'))) { source = 'google'; medium = 'cpc' }
    if (!source && ref) {
      try { const host = new URL(ref).hostname.replace(/^www\./, ''); if (host && host !== window.location.hostname) { source = host; medium = /google|bing|duckduckgo|yahoo/.test(host) ? 'organic' : 'referral' } } catch { /* ignore */ }
    }
    const touch: FirstTouch = {
      source: source || 'direct', medium: medium || 'none',
      campaign: q.get('utm_campaign') || '', content: q.get('utm_content') || '',
      landing: window.location.pathname, referrer: ref, at: new Date().toISOString(),
    }
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch))
  } catch { /* storage blocked: nothing to remember */ }
}

function firstTouch(): FirstTouch | null {
  try { return JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || 'null') } catch { return null }
}

function sendToMarketGenius(eventType: 'signup_clicked' | 'signup_completed'): void {
  try {
    const t = firstTouch()
    const body = JSON.stringify({
      product_id: PRODUCT_ID, event_type: eventType,
      source: t?.source || 'direct', medium: t?.medium || 'none',
      landing_page_variant: t?.landing || window.location.pathname,
      anonymized_user_id: anonId(), page_url: window.location.href.split('?')[0], referrer: t?.referrer || document.referrer || '',
    })
    // keepalive lets it finish even if the page navigates away right after.
    fetch(MG_TRACK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch { /* never block sign-up */ }
}

// The visitor pressed a sign-up button (intent).
export function trackSignupStarted(method: 'email' | 'google'): void {
  try { window.gtag?.('event', 'sign_up_start', { method }) } catch { /* ignore */ }
  sendToMarketGenius('signup_clicked')
}

// A new account was really created.
export function trackSignupCompleted(method: 'email' | 'google'): void {
  const t = firstTouch()
  try {
    window.gtag?.('event', 'sign_up', { method, ...(t ? { first_source: t.source, first_medium: t.medium, first_campaign: t.campaign } : {}) })
  } catch { /* ignore */ }
  try { window.fbq?.('track', 'CompleteRegistration', { status: true, content_name: method }) } catch { /* ignore */ }
  sendToMarketGenius('signup_completed')
}

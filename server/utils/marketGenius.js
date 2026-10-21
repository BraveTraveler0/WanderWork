// Reports Wanderwork conversions (new accounts, paid plans) to MarketGenius so
// Inanna sees them in the product's sign-up funnel. This runs on the server,
// so it still counts sign-ups the browser can't report: ad blockers, the
// LinkedIn redirect, the extension and the mobile app. The browser passes its
// first-touch attribution (utm source/medium, landing page) along with the
// sign-up request so the source isn't lost. Fire-and-forget: a slow or down
// MarketGenius never delays or fails a sign-up or a webhook.

const crypto = require('crypto');

const MARKETGENIUS_URL = (process.env.MARKETGENIUS_URL || 'https://marketinggenius-backend.onrender.com').replace(/\/+$/, '');
const PRODUCT_ID = process.env.MARKETGENIUS_PRODUCT_ID || 'wanderwork';

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// The same person always hashes to the same id, so a sign-up and a later
// paid plan line up in MarketGenius without sending the email itself.
function anonymize(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(`${process.env.USER_ID_SALT || ''}${normalized}`).digest('hex');
}

// Picks the attribution fields out of whatever the browser sent (or the
// LinkedIn session copy of it). Anything missing falls back to direct.
function readAttribution(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  return {
    source: clean(a.source, 100) || 'direct',
    medium: clean(a.medium, 100) || 'none',
    landing_page_variant: clean(a.landing, 100) || 'default',
    page_url: clean(a.pageUrl, 500) || undefined,
    referrer: clean(a.referrer, 500) || undefined,
  };
}

function reportConversion(eventType, { email, attribution } = {}) {
  try {
    const body = {
      product_id: PRODUCT_ID,
      event_type: eventType,
      anonymized_user_id: anonymize(email),
      ...readAttribution(attribution),
    };
    fetch(`${MARKETGENIUS_URL}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // MarketGenius is on Render and can take a while to wake up.
      signal: AbortSignal.timeout(90000),
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          console.warn(`[MarketGenius] ${eventType} was not recorded (${response.status}): ${text.slice(0, 200)}`);
        }
      })
      .catch((err) => console.warn(`[MarketGenius] ${eventType} could not be sent:`, err.message));
  } catch (err) {
    console.warn('[MarketGenius] reportConversion failed:', err.message);
  }
}

module.exports = { reportConversion, readAttribution };

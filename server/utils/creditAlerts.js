'use strict'

// Emails the owner when a paid service is running low or has run out, so the AI and the
// weekly scrape don't quietly stop. Each kind of alert goes out at most once a day, even
// with two server instances.
//
// - OpenRouter and Apify: balances are read once a day (checkCredits, from the daily
//   Capital Watch job).
// - OpenAI has no balance API, so the alert fires the moment a request is refused for
//   quota or billing (noteAIError, called from utils/aiChat.js).
//
// Env (all optional): CREDIT_ALERT_EMAIL, OPENROUTER_MIN_USD (default 3), APIFY_MIN_USD (default 10).

const axios = require('axios')
const mongoose = require('mongoose')

const ALERT_TO = () => process.env.CREDIT_ALERT_EMAIL || 'darrienccarter@gmail.com'
const minUsd = (name, fallback) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
const usd = (n) => `$${Number(n).toFixed(2)}`
const today = () => new Date().toISOString().slice(0, 10)

async function sendAlert(kind, subject, lines) {
  // Needs the database (for the once-a-day claim) and SendGrid.
  if (mongoose.connection.readyState !== 1 || !process.env.SENDGRID_API_KEY) return false
  const { claimPeriod } = require('./schedulerClaim')
  if (!(await claimPeriod(`credit_alert_${kind}`, today()).catch(() => false))) return false
  try {
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    const { FROM_EMAIL } = require('./capitalWatchEmail')
    const text = `${lines.join('\n\n')}\n\nThis alert is sent at most once a day.`
    await sgMail.send({
      to: ALERT_TO(),
      from: FROM_EMAIL,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${lines.map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}<p style="color:#888;font-size:12px">This alert is sent at most once a day.</p></div>`,
    })
    console.log(`[credits] Alert sent: ${subject}`)
    return true
  } catch (err) {
    console.error('[credits] Alert email failed:', err.message)
    return false
  }
}

// Called by aiChat when a provider refuses a request. Only billing and quota problems alert.
function noteAIError(err, provider) {
  const status = err?.response?.status
  const apiError = err?.response?.data?.error || {}
  const code = String(apiError.code || apiError.type || '')
  const message = String(apiError.message || err?.message || '')
  const outOfCredit = provider === 'openai'
    ? /insufficient_quota|billing_hard_limit|billing_not_active|quota/i.test(`${code} ${message}`)
    : status === 402 || /insufficient credits|credit/i.test(message)
  if (!outOfCredit) return
  const name = provider === 'openai' ? 'OpenAI' : 'OpenRouter'
  const where = provider === 'openai' ? 'https://platform.openai.com/settings/organization/billing' : 'https://openrouter.ai/settings/credits'
  sendAlert(`${provider}_empty`, `${name} is out of credits`, [
    `${name} just refused a request because the account is out of credits or over its limit (${message.slice(0, 200)}).`,
    provider === 'openai'
      ? 'Requests are falling back to OpenRouter for now, which works but can be slower and lower quality.'
      : 'Background AI work and the OpenAI backup path will fail until it is topped up.',
    `Add credits here: ${where}`,
  ]).catch(() => {})
}

// Daily balance check for the services that report one.
async function checkCredits() {
  const results = {}
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const { data } = await axios.get('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }, timeout: 15000,
      })
      const left = Number(data?.data?.total_credits) - Number(data?.data?.total_usage)
      results.openrouter = left
      const min = minUsd('OPENROUTER_MIN_USD', 3)
      if (Number.isFinite(left) && left < min) {
        await sendAlert('openrouter_low', `OpenRouter credits are low: ${usd(left)} left`, [
          `OpenRouter has ${usd(left)} of credit left (alert level ${usd(min)}).`,
          'It runs the background AI work (cheap models first) and is the backup when OpenAI fails.',
          'Add credits here: https://openrouter.ai/settings/credits',
        ])
      }
    } catch (err) {
      console.warn('[credits] OpenRouter balance check failed:', err.message)
    }
  }
  if (process.env.APIFY_TOKEN) {
    try {
      const { data } = await axios.get('https://api.apify.com/v2/users/me/limits', {
        headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` }, timeout: 15000,
      })
      const used = Number(data?.data?.current?.monthlyUsageUsd)
      const cap = Number(data?.data?.limits?.maxMonthlyUsageUsd)
      const left = cap - used
      results.apify = left
      const min = minUsd('APIFY_MIN_USD', 10)
      if (Number.isFinite(left) && left < min) {
        await sendAlert('apify_low', `Apify is near its monthly limit: ${usd(left)} left`, [
          `Apify has used ${usd(used)} of its ${usd(cap)} monthly limit, leaving ${usd(left)} (alert level ${usd(min)}).`,
          `The weekly Capital Watch scrape stops when the limit is reached. The cycle resets on ${String(data?.data?.monthlyUsageCycle?.endAt || '').slice(0, 10) || 'the next billing date'}.`,
          'Raise the limit or add credit here: https://console.apify.com/billing',
        ])
      }
    } catch (err) {
      console.warn('[credits] Apify balance check failed:', err.message)
    }
  }
  return results
}

module.exports = { checkCredits, noteAIError, sendAlert }

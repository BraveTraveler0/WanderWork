const PRODUCTION_API_BASE_URL = 'https://wanderwork-backend-server.onrender.com'
const LOCAL_URL_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i

function isLocalRuntime() {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
}

function publicUrl(value: string | undefined) {
  const url = String(value || '').trim().replace(/\/$/, '')
  if (!url) return ''
  if (LOCAL_URL_RE.test(url) && !isLocalRuntime()) return ''
  return url
}

export const API_BASE_URL =
  publicUrl(import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  publicUrl(import.meta.env.VITE_LOCAL_APP_SERVER_URL as string | undefined) ||
  PRODUCTION_API_BASE_URL

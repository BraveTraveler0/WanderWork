import { useState } from 'react'
import { API_BASE_URL } from '../api/config'
import { getNativePlatform, isNative } from '../native'

// Sign in with Apple, iPhone app only. The App Store requires it whenever the app
// offers another sign-in service (Google, LinkedIn). Shown first and styled per
// Apple's guidelines (black, Apple logo, at least as prominent as the others).

interface AppleAuthButtonProps {
  onAuth: (user: any, token: string) => void
  onError: (message: string) => void
  /** Return false to abort the sign-in attempt (e.g. terms not yet accepted). */
  beforeStart?: () => boolean
  label?: string
}

export const appleSignInAvailable = () => isNative && getNativePlatform() === 'ios'

function AppleLogo() {
  return (
    <svg width="16" height="19" viewBox="0 0 814 1000" fill="#fff" aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  )
}

export default function AppleAuthButton({ onAuth, onError, beforeStart, label }: AppleAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  if (!appleSignInAvailable()) return null

  const handleClick = async () => {
    if (beforeStart && !beforeStart()) return
    setLoading(true)
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
      // clientId and redirectURI are only used on the web; iOS uses the app's own Apple ID setup.
      const { response } = await SignInWithApple.authorize({
        clientId: 'io.wanderwork.app',
        redirectURI: 'https://wanderwork.io',
        scopes: 'email name',
      })
      const res = await fetch(`${API_BASE_URL}/oauth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityToken: response.identityToken,
          authorizationCode: response.authorizationCode,
          givenName: response.givenName,
          familyName: response.familyName,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Apple sign-in failed')
      localStorage.setItem('wanderworkToken', data.token)
      localStorage.setItem('wanderworkUser', JSON.stringify(data.user))
      onAuth(data.user, data.token)
    } catch (err: any) {
      // Closing Apple's sheet isn't an error worth showing.
      const msg = String(err?.message || '')
      if (/1001|cancel/i.test(msg)) return
      onError(msg || 'Apple sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black text-white hover:bg-gray-900 transition font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <AppleLogo />}
      {label || 'Continue with Apple'}
    </button>
  )
}

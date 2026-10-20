import { useState } from 'react'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import { API_BASE_URL } from '../api/config'
import { trackSignupCompleted, trackSignupStarted } from '../utils/signupTracking'

// Google and LinkedIn sign-up, shared by the sign-up page and the landing page.

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '406462367912-qsnckspm7sepdi011ubrvo80q49l1ovf.apps.googleusercontent.com'

// LinkedIn is a full-page redirect; the app picks the session up from the
// callback URL (and reports new sign-ups from its new=1 flag).
export function startLinkedInAuth() {
  trackSignupStarted('linkedin')
  window.location.href = `${API_BASE_URL}/oauth/linkedin`
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  )
}

export function LinkedInIcon({ size = 18, color = '#0077B5' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

interface GoogleAuthButtonProps {
  onSignup: (user: any, token: string) => void
  onError: (message: string) => void
  className?: string
  label?: string
}

function GoogleAuthButtonInner({ onSignup, onError, className, label = 'Continue with Google' }: GoogleAuthButtonProps) {
  const [googleLoading, setGoogleLoading] = useState(false)

  const googleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/oauth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.message || 'Google sign-up failed')
        if (data?.isNewUser) trackSignupCompleted('google')

        localStorage.setItem('wanderworkToken', data.token)
        localStorage.setItem('wanderworkUser', JSON.stringify(data.user))
        onSignup(data.user, data.token)
      } catch (err: any) {
        onError(err?.message || 'Google sign-up failed')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => onError('Google sign-up was cancelled'),
  })

  return (
    <button
      type="button"
      onClick={() => {
        trackSignupStarted('google')
        googleSignup()
      }}
      disabled={googleLoading}
      className={className ?? 'flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60'}
    >
      {googleLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      ) : (
        <GoogleIcon />
      )}
      <span className="social-label">{label}</span>
    </button>
  )
}

export function GoogleAuthButton(props: GoogleAuthButtonProps) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <GoogleAuthButtonInner {...props} />
    </GoogleOAuthProvider>
  )
}

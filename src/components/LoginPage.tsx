import { useState, useEffect } from 'react'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  || (import.meta.env.VITE_LOCAL_APP_SERVER_URL as string | undefined)
  || 'http://localhost:8000'

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || ''

interface LoginPageProps {
  onLogin: (user: any, token: string) => void
  onForgotPassword?: () => void
  onBackToLanding?: () => void
  onCreateAccount?: () => void
}

// ── Google button (must live inside GoogleOAuthProvider) ──────────────────────
function GoogleLoginButton({ onLogin, onError }: { onLogin: (user: any, token: string) => void; onError: (msg: string) => void }) {
  const [googleLoading, setGoogleLoading] = useState(false)

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      try {
        const res = await fetch(`${BASE_URL}/oauth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: tokenResponse.access_token,
          }),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.message || 'Google login failed')
        }
        const data = await res.json()
        localStorage.setItem('wanderworkToken', data.token)
        localStorage.setItem('wanderworkUser', JSON.stringify(data.user))
        onLogin(data.user, data.token)
      } catch (err: any) {
        onError(err?.message || 'Google login failed')
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => onError('Google sign-in was cancelled'),
  })

  return (
    <button
      type="button"
      onClick={() => googleLogin()}
      disabled={googleLoading}
      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition font-semibold text-sm text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {googleLoading ? (
        <span className="w-4 h-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
      )}
      Continue with Google
    </button>
  )
}

// ── Social buttons section ────────────────────────────────────────────────────
function SocialButtons({ onLogin, onError }: { onLogin: (user: any, token: string) => void; onError: (msg: string) => void }) {
  const handleLinkedIn = () => {
    window.location.href = `${BASE_URL}/oauth/linkedin`
  }

  return (
    <div className="flex flex-col gap-3 mt-2">
      {GOOGLE_CLIENT_ID && (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <GoogleLoginButton onLogin={onLogin} onError={onError} />
        </GoogleOAuthProvider>
      )}

      <button
        type="button"
        onClick={handleLinkedIn}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition font-semibold text-sm text-gray-700"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077B5">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        Continue with LinkedIn
      </button>
    </div>
  )
}

// ── Main login page ───────────────────────────────────────────────────────────
export default function LoginPage({ onLogin, onForgotPassword, onBackToLanding, onCreateAccount }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mounted, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()
    if (!normalizedEmail) {
      setError('Email is required')
      return
    }
    if (!normalizedPassword) {
      setError('Password is required')
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Login failed')
      }
      const data = await response.json()
      localStorage.setItem('wanderworkToken', data.token)
      localStorage.setItem('wanderworkUser', JSON.stringify(data.user))
      onLogin(data.user, data.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#306770] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#306770] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      </div>

      <div
        className="relative z-10 w-full max-w-md transition-all duration-700"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)' }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 md:p-10 border border-white/20">
          <div className="mb-8 text-center">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 2 }}>
              <h1 className="text-3xl md:text-4xl font-bold text-[#306770] tracking-wide break-words" style={{ lineHeight: '1.1', margin: 0 }}>
                WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
              </h1>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#306770', background: '#EEF6F7', border: '1px solid #C8DEDE', borderRadius: 6, padding: '2px 7px', letterSpacing: 1, alignSelf: 'flex-start', marginTop: 4 }}>BETA</span>
            </div>
            <p className="text-gray-600 text-base">Work smarter, wander farther</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50/95 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Social login */}
          <SocialButtons onLogin={onLogin} onError={setError} />

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#306770] focus:border-transparent outline-none transition bg-gray-50/50 focus:bg-white text-gray-900 placeholder-gray-500"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#306770] focus:border-transparent outline-none transition bg-gray-50/50 focus:bg-white text-gray-900 placeholder-gray-500"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <a href="#" onClick={(e) => { e.preventDefault(); onForgotPassword?.() }} className="text-xs text-[#306770] hover:underline">
                  Forgot password?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#306770] hover:bg-[#245460] disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200 text-base mt-6 shadow-lg hover:shadow-xl"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-600">
            First time?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onCreateAccount?.() }} className="text-[#306770] font-semibold hover:underline">
              Create an account
            </a>
          </p>
          {onBackToLanding && (
            <p className="text-sm text-gray-500">
              <a href="#" onClick={e => { e.preventDefault(); onBackToLanding() }} className="text-[#306770] hover:underline">
                Back to landing page
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

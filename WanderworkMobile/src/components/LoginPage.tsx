import { useState, useEffect } from 'react'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { API_BASE_URL } from '../api/config'
import { startLinkedInAuth } from '../native'
import GoogleAuthButton from './GoogleAuthButton'

const BASE_URL = API_BASE_URL

interface LoginPageProps {
  onLogin: (user: any, token: string) => void
  onForgotPassword?: () => void
  onBackToLanding?: () => void
  onCreateAccount?: () => void
}

// ── Social buttons section ────────────────────────────────────────────────────
function SocialButtons({ onLogin, onError }: { onLogin: (user: any, token: string) => void; onError: (msg: string) => void }) {
  const handleLinkedIn = () => startLinkedInAuth(`${BASE_URL}/oauth/linkedin`)

  return (
    <div className="flex flex-col gap-3 mt-2">
      <GoogleAuthButton onAuth={onLogin} onError={onError} />

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
    <div className="min-h-screen safe-area-top flex items-center justify-center p-4" style={{ fontFamily: "'Manrope', sans-serif", animation: 'bgBreathe 6s ease-in-out infinite', background: 'linear-gradient(135deg, #a8cece, #c4dede, #e0eeee)' }}>
      <style>{`
        @keyframes bgBreathe {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.12); }
        }
      `}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-[#306770] rounded-full filter blur-[120px] opacity-25" style={{ animation: 'bgBreathe 8s ease-in-out infinite' }} />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-[#63B08D] rounded-full filter blur-[100px] opacity-20" style={{ animation: 'bgBreathe 8s ease-in-out infinite reverse' }} />
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
              <span style={{ fontSize: 9, fontWeight: 500, color: '#AAAAAA', background: 'transparent', border: '1px solid #DCDCDC', borderRadius: 5, padding: '1px 6px', letterSpacing: 0.5, alignSelf: 'flex-start', marginTop: 6 }}>BETA</span>
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

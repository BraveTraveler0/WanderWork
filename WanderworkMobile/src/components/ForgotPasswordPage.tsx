import { useState, useEffect } from 'react'
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { API_BASE_URL } from '../api/config'

interface ForgotPasswordPageProps {
  onBack: () => void
}

export default function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const BASE_URL = API_BASE_URL

      const response = await fetch(`${BASE_URL}/auth/forgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 404) {
          setSent(true)
          return
        }
        throw new Error(data.message || 'Request failed')
      }

      setSent(true)
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
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#306770] text-sm font-medium mb-6 hover:opacity-70 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </button>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#306770] mb-1" style={{ letterSpacing: '0.02em' }}>Reset your password</h1>
            <p className="text-gray-500 text-sm">Enter your email and we'll send you a reset link.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50/95 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {sent ? (
            <div className="p-5 bg-[#306770]/5 border border-[#306770]/20 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#306770] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#306770] font-semibold text-sm">Check your inbox</p>
                <p className="text-gray-600 text-sm mt-1">
                  If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#306770] focus:border-transparent outline-none transition bg-gray-50/50 focus:bg-white text-gray-900 placeholder-gray-500"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#306770] hover:bg-[#245460] disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200 text-base shadow-lg hover:shadow-xl"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

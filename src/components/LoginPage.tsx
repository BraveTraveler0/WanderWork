import { useState } from 'react'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface LoginPageProps {
  onLogin: (user: any, token: string) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('darrienccarter@gmail.com')
  const [password, setPassword] = useState('password123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
        || (import.meta.env.VITE_LOCAL_APP_SERVER_URL as string | undefined)
        || 'http://localhost:8000'
      
      console.log('Attempting login at:', `${BASE_URL}/auth/login`)
      
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Login failed')
      }

      const data = await response.json()
      
      // Save token and user to localStorage
      localStorage.setItem('wanderworkToken', data.token)
      localStorage.setItem('wanderworkUser', JSON.stringify(data.user))
      
      onLogin(data.user, data.token)
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Glassmorphic background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#306770] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#306770] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 md:p-10 border border-white/20">
          {/* Logo */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-[#306770] mb-2 tracking-wide break-words" style={{ lineHeight: '1.1' }}>WANDER<span style={{ opacity: 0.45 }}>/</span>WORK</h1>
            <p className="text-gray-600 text-base">Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/95 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
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
                  placeholder="darrienccarter@gmail.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#306770] focus:border-transparent outline-none transition bg-gray-50/50 focus:bg-white text-gray-900 placeholder-gray-500"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
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
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#306770] hover:bg-[#245460] disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition duration-200 text-base mt-6 shadow-lg hover:shadow-xl"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-gradient-to-r from-[#306770]/5 to-[#306770]/10 rounded-xl border border-[#306770]/20">
            <p className="text-xs font-semibold text-gray-700 mb-3">Demo Credentials:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Email:</span>
                <code className="bg-white/60 px-3 py-1 rounded-lg text-xs text-[#306770] font-mono">darrienccarter@gmail.com</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Password:</span>
                <code className="bg-white/60 px-3 py-1 rounded-lg text-xs text-[#306770] font-mono">password123</code>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          First time? <a href="#" className="text-[#306770] font-semibold hover:underline">Create an account</a>
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import type React from 'react'
import { ArrowLeft, Briefcase, Link2, Lock, Mail, MapPin, Phone, Upload, User } from 'lucide-react'
import { uploadCandidateResume } from '../api/jobseeker'

interface SignupPageProps {
  onSignup: (user: any, token: string) => void
  onSignIn: () => void
  onBackToLanding?: () => void
}

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_LOCAL_APP_SERVER_URL as string | undefined) ||
  'http://localhost:8000'

export default function SignupPage({ onSignup, onSignIn, onBackToLanding }: SignupPageProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    targetRole: '',
    seniority: '',
    skills: '',
    linkedinUrl: '',
    portfolioUrl: '',
    calendlyUrl: '',
  })
  const [resume, setResume] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          displayName: `${form.firstName} ${form.lastName}`.trim(),
          skills: form.skills.split(',').map((item) => item.trim()).filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || 'Could not create your account.')

      const token = data.token || data.user?.token
      localStorage.setItem('wanderworkToken', token)
      localStorage.setItem('wanderworkUser', JSON.stringify(data.user))

      if (resume && form.email) {
        await uploadCandidateResume(form.email, resume)
      }

      onSignup(data.user, token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-300 bg-gray-50/60 px-4 py-3 text-gray-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#306770]'

  return (
    <div className="min-h-screen bg-gray-100 p-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#306770] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#63B08D] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-3xl py-8">
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#306770] hover:underline"
          >
            <ArrowLeft size={16} />
            Back to landing
          </button>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-xl md:p-10">
          <div className="mb-8 text-center">
            <h1 className="mb-2 break-words text-3xl font-bold tracking-wide text-[#306770] md:text-4xl" style={{ lineHeight: 1.1 }}>
              WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
            </h1>
            <p className="text-base text-gray-600">Create your profile and start matching with remote jobs</p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50/95 p-4 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field icon={<User size={18} />} label="First Name" required>
              <input className={inputClass} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} required autoComplete="given-name" />
            </Field>
            <Field label="Last Name" required>
              <input className={inputClass} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} required autoComplete="family-name" />
            </Field>
            <Field icon={<Mail size={18} />} label="Email" required>
              <input className={inputClass} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required autoComplete="email" />
            </Field>
            <Field icon={<Lock size={18} />} label="Password" required>
              <input className={inputClass} type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
            <Field icon={<Phone size={18} />} label="Phone Number" required>
              <input className={inputClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} required autoComplete="tel" />
            </Field>
            <Field icon={<MapPin size={18} />} label="Location" required>
              <input className={inputClass} value={form.location} onChange={(e) => setField('location', e.target.value)} required placeholder="Seattle, WA" />
            </Field>
            <Field icon={<Briefcase size={18} />} label="Target Role" required>
              <input className={inputClass} value={form.targetRole} onChange={(e) => setField('targetRole', e.target.value)} required placeholder="Senior Product Designer" />
            </Field>
            <Field label="Seniority">
              <input className={inputClass} value={form.seniority} onChange={(e) => setField('seniority', e.target.value)} placeholder="Senior, Lead" />
            </Field>
          </div>

          <Field label="Skills" className="mt-5">
            <textarea className={`${inputClass} min-h-[120px] resize-y`} value={form.skills} onChange={(e) => setField('skills', e.target.value)} placeholder="React, TypeScript, MongoDB" />
          </Field>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <Field icon={<Link2 size={18} />} label="LinkedIn URL">
              <input className={inputClass} value={form.linkedinUrl} onChange={(e) => setField('linkedinUrl', e.target.value)} />
            </Field>
            <Field label="Portfolio URL">
              <input className={inputClass} value={form.portfolioUrl} onChange={(e) => setField('portfolioUrl', e.target.value)} />
            </Field>
            <Field label="Calendly URL">
              <input className={inputClass} value={form.calendlyUrl} onChange={(e) => setField('calendlyUrl', e.target.value)} />
            </Field>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Upload your resume</label>
            <label className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 px-4 text-center transition hover:border-[#306770] hover:bg-white">
              <Upload size={24} className="mb-2 text-[#306770]" />
              <span className="text-sm font-semibold text-gray-700">{resume ? resume.name : 'Click to choose a file or drag here'}</span>
              <span className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX, RTF, or TXT. 10 MB max.</span>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.rtf,.txt" onChange={(e) => setResume(e.target.files?.[0] || null)} />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-7 w-full rounded-xl bg-[#306770] py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#245460] hover:shadow-xl disabled:bg-gray-400"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="mt-5 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button type="button" onClick={onSignIn} className="font-semibold text-[#306770] hover:underline">
              Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

function Field({ icon, label, required, className = '', children }: { icon?: React.ReactNode; label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
        {icon && <span className="text-[#306770]">{icon}</span>}
        {label}
        {required && <span className="text-[#306770]">*</span>}
      </span>
      {children}
    </label>
  )
}

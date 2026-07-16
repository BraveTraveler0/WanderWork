import { useRef, useState } from 'react'
import type React from 'react'
import { ArrowLeft, Briefcase, Eye, EyeOff, Link2, Lock, Mail, MapPin, Phone, Upload, User } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { parseSignupResume, uploadCandidateResume } from '../api/jobseeker'
import { API_BASE_URL } from '../api/config'
import { isNative, openOAuthInSystemBrowser } from '../native'
import GoogleAuthButton from './GoogleAuthButton'
import TermsOfServicePage from './TermsOfServicePage'

interface SignupPageProps {
  onSignup: (user: any, token: string) => void
  onSignIn: () => void
  onBackToLanding?: () => void
}

const BASE_URL = API_BASE_URL

const SIGNUP_STEPS = [
  {
    title: 'Account',
    description: 'Add your name and login details, then upload a resume to auto-fill your profile.',
  },
  {
    title: 'Profile',
    description: 'Only fill this out if you are not uploading a resume.',
  },
  {
    title: 'Links',
    description: 'Add optional links recruiters can use to learn more about you.',
  },
]


function SocialSignupBox({
  onSignup,
  onError,
  termsAccepted,
  onTermsAcceptedChange,
  onShowTerms,
  termsError,
  onRequireTerms,
}: {
  onSignup: (user: any, token: string) => void
  onError: (message: string) => void
  termsAccepted: boolean
  onTermsAcceptedChange: (checked: boolean) => void
  onShowTerms: () => void
  termsError: string | null
  onRequireTerms: () => void
}) {
  const handleLinkedIn = () => {
    if (!termsAccepted) {
      onRequireTerms()
      return
    }
    const linkedinUrl = `${BASE_URL}/oauth/linkedin`
    if (isNative) {
      openOAuthInSystemBrowser(linkedinUrl)
      return
    }
    window.location.href = linkedinUrl
  }

  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-[#306770]">Create your account faster</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <GoogleAuthButton
          onAuth={onSignup}
          onError={onError}
          beforeStart={() => {
            if (!termsAccepted) {
              onRequireTerms()
              return false
            }
            return true
          }}
        />
        <button
          type="button"
          onClick={handleLinkedIn}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077B5">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Continue with LinkedIn
        </button>
      </div>
      <TermsAgreement
        id="signup-terms-social"
        checked={termsAccepted}
        onChange={onTermsAcceptedChange}
        onShowTerms={onShowTerms}
        error={termsError}
        className="mt-4"
      />
      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#C8DEDE]" />
        <span className="text-xs font-medium text-gray-500">or fill out your profile manually</span>
        <div className="h-px flex-1 bg-[#C8DEDE]" />
      </div>
    </div>
  )
}

type SignupField = keyof ReturnType<typeof getInitialSignupForm>

function getInitialSignupForm() {
  return {
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
  }
}

function titleCaseNamePart(value: string) {
  return value
    .split(/(\s+|-)/)
    .map((part) => (/^[A-Za-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join('')
}

function inferNameFromResumeFilename(filename: string): Partial<Pick<ReturnType<typeof getInitialSignupForm>, 'firstName' | 'lastName'>> {
  const base = filename.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(?:resume|cv|curriculum|vitae|copy|final|updated|new)\b/gi, ' ')
    .replace(/\b\d{1,4}(?:[.\-/]\d{1,2}){0,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = cleaned.split(/\s+/).filter((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part))
  if (parts.length < 2) return {}
  return {
    firstName: titleCaseNamePart(parts[0]),
    lastName: titleCaseNamePart(parts.slice(1, 3).join(' ')),
  }
}

export default function SignupPage({ onSignup, onSignIn, onBackToLanding }: SignupPageProps) {
  const [form, setForm] = useState(getInitialSignupForm)
  const [showPassword, setShowPassword] = useState(false)
  const [resume, setResume] = useState<File | null>(null)
  const [resumeParsing, setResumeParsing] = useState(false)
  const [resumeParsed, setResumeParsed] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [isDraggingResume, setIsDraggingResume] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignupField, string>>>({})
  const [step, setStep] = useState(0)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const resumeParseRunRef = useRef(0)

  const setResumeFile = async (file: File | null) => {
    resumeParseRunRef.current += 1
    setResumeError(null)
    setResumeParsed(false)
    if (!file) {
      setResume(null)
      setResumeParsing(false)
      return
    }

    const allowedByName = /\.(pdf|docx)$/i.test(file.name)
    const allowedByType = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(file.type)

    if (!allowedByName && !allowedByType) {
      setResume(null)
      setResumeParsing(false)
      setResumeError('Upload a PDF or DOCX resume.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setResume(null)
      setResumeParsing(false)
      setResumeError('Resume must be 10 MB or smaller.')
      return
    }

    const parseRun = resumeParseRunRef.current
    setResume(file)
    setError(null)
    const filenameFields = inferNameFromResumeFilename(file.name)
    const filenameFieldNames = Object.keys(filenameFields) as SignupField[]
    if (filenameFieldNames.length > 0) {
      setForm((current) => {
        const next = { ...current }
        filenameFieldNames.forEach((field) => {
          const value = filenameFields[field as 'firstName' | 'lastName']
          if (value && !next[field].trim()) next[field] = value
        })
        return next
      })
    }
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.phone
      delete next.location
      delete next.targetRole
      filenameFieldNames.forEach((field) => delete next[field])
      return next
    })

    setResumeParsing(true)
    try {
      const parsed = await parseSignupResume(file)
      if (resumeParseRunRef.current !== parseRun) return
      const fields = parsed?.fields || {}
      const skillsValue = Array.isArray(fields.skills)
        ? fields.skills.filter(Boolean).join(', ')
        : typeof fields.skills === 'string'
          ? fields.skills
          : ''
      const parsedValues: Partial<Record<SignupField, string>> = {
        firstName: fields.firstName || '',
        lastName: fields.lastName || '',
        email: fields.email || '',
        phone: fields.phone || '',
        location: fields.location || '',
        targetRole: fields.targetRole || '',
        skills: skillsValue,
      }
      const parsedFieldNames = (Object.keys(parsedValues) as SignupField[]).filter((field) => parsedValues[field]?.trim())
      if (parsedFieldNames.length > 0) {
        setForm((current) => {
          const next = { ...current }
          parsedFieldNames.forEach((field) => {
            const value = parsedValues[field]
            if (value && !next[field].trim()) next[field] = value
          })
          return next
        })
        setFieldErrors((current) => {
          const next = { ...current }
          parsedFieldNames.forEach((field) => delete next[field])
          return next
        })
      }
      setResumeParsed(Boolean(parsed?.extracted?.fieldsPopulated || parsedFieldNames.length || filenameFieldNames.length))
    } catch (parseError) {
      if (resumeParseRunRef.current !== parseRun) return
      console.warn('Resume parse failed during signup', parseError)
      setResumeParsed(filenameFieldNames.length > 0)
      setResumeError('Resume added, but auto-fill could not read every field. You can keep going and fill any missing fields.')
    } finally {
      if (resumeParseRunRef.current === parseRun) setResumeParsing(false)
    }
  }

  const handleResumeDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingResume(false)
    void setResumeFile(event.dataTransfer.files?.[0] || null)
  }

  const requireTerms = () => {
    const message = 'Please accept the Terms of Service before creating an account.'
    setTermsError(message)
    setError(message)
  }

  const setTermsAgreement = (checked: boolean) => {
    setTermsAccepted(checked)
    if (checked) {
      setTermsError(null)
      if (error === 'Please accept the Terms of Service before creating an account.') setError(null)
    }
  }

  const setField = (field: SignupField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const validateStep = (targetStep: number) => {
    const requireValue = (value: string) => value.trim().length > 0
    const nextFieldErrors: Partial<Record<SignupField, string>> = {}

    if (targetStep === 0) {
      if (!requireValue(form.firstName)) nextFieldErrors.firstName = 'First name is required.'
      if (!requireValue(form.lastName)) nextFieldErrors.lastName = 'Last name is required.'
      if (!requireValue(form.email)) nextFieldErrors.email = 'Email is required.'
      if (!requireValue(form.password)) nextFieldErrors.password = 'Password is required.'
      if (requireValue(form.password) && form.password.length < 8) nextFieldErrors.password = 'Use at least 8 characters.'

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors)
        setError('Please fill in the highlighted fields to continue.')
        return false
      }
    }

    if (targetStep === 1 && !resume) {
      if (!requireValue(form.phone)) nextFieldErrors.phone = 'Phone number is required.'
      if (!requireValue(form.location)) nextFieldErrors.location = 'Location is required.'
      if (!requireValue(form.targetRole)) nextFieldErrors.targetRole = 'Target role is required.'

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors)
        setError('Please fill in the highlighted fields to continue.')
        return false
      }
    }

    setFieldErrors({})
    setError(null)
    return true
  }

  const goNext = () => {
    if (!validateStep(step)) return
    setStep((current) => Math.min(current + 1, SIGNUP_STEPS.length - 1))
  }

  const goBack = () => {
    setError(null)
    setFieldErrors({})
    setStep((current) => Math.max(current - 1, 0))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(0)) {
      setStep(0)
      return
    }
    if (!resume && !validateStep(1)) {
      setStep(1)
      return
    }
    if (!termsAccepted) {
      requireTerms()
      return
    }
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
        try {
          await uploadCandidateResume(form.email, resume)
        } catch (uploadError) {
          console.warn('Resume upload failed after signup', uploadError)
        }
      }

      onSignup(data.user, token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-300 bg-gray-50/60 px-4 py-3 text-gray-900 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[#306770]'
  const getInputClass = (field: SignupField) =>
    `${inputClass} ${
      fieldErrors[field]
        ? 'border-red-400 bg-red-50/80 focus:border-red-400 focus:ring-red-200'
        : ''
    }`
  const stepContent = [
    (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
          <Field icon={<User size={18} />} label="First Name" required error={fieldErrors.firstName}>
            <input className={getInputClass('firstName')} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} autoComplete="given-name" aria-invalid={Boolean(fieldErrors.firstName)} />
          </Field>
          <Field label="Last Name" required error={fieldErrors.lastName}>
            <input className={getInputClass('lastName')} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} autoComplete="family-name" aria-invalid={Boolean(fieldErrors.lastName)} />
          </Field>
          <Field icon={<Mail size={18} />} label="Email" required error={fieldErrors.email}>
            <input className={getInputClass('email')} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} />
          </Field>
          <Field icon={<Lock size={18} />} label="Password" required error={fieldErrors.password}>
            <div className="relative">
              <input className={getInputClass('password')} type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setField('password', e.target.value)} minLength={8} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} style={{ paddingRight: '2.75rem' }} />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-[#306770] transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        </div>

        <div>
          <label
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDraggingResume(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDraggingResume(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setIsDraggingResume(false)
            }}
            onDrop={handleResumeDrop}
            className={`flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition ${
              isDraggingResume
                ? 'border-[#306770] bg-[#EEF6F7]'
                : resume
                  ? 'border-[#306770] bg-[#F7FBFB]'
                  : 'border-gray-300 bg-gray-50/70 hover:border-[#306770] hover:bg-white'
            }`}
          >
            <Upload size={32} className="mb-3 text-[#306770]" />
            <span className="text-base font-bold text-gray-800">
              {resume ? resume.name : 'Upload your resume to skip manual profile entry'}
            </span>
            <span className="mt-2 max-w-xl text-sm font-medium text-gray-500">
              Drag and drop a PDF or DOCX here, or click to choose a file. We will read it now and fill in your role, skills, location, and profile details.
            </span>
            <input
              ref={resumeInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => void setResumeFile(e.target.files?.[0] || null)}
            />
          </label>

          {resumeError && <p className="mt-3 text-sm font-semibold text-red-700">{resumeError}</p>}
          {resume && (
            <div className="mt-4 rounded-xl border border-[#C8DEDE] bg-[#F7FBFB] p-4 text-sm font-semibold text-[#306770]">
              {resumeParsing
                ? 'Resume added. Reading it now to auto-fill your profile fields...'
                : resumeParsed
                  ? 'Resume read. We filled the details we found, and you can bypass the manual profile step.'
                  : 'Resume added. You can bypass the manual profile step after creating your account.'}
            </div>
          )}

          {resume && (
            <button
              type="button"
              onClick={() => {
                resumeParseRunRef.current += 1
                setResume(null)
                setResumeError(null)
                setResumeParsing(false)
                setResumeParsed(false)
                if (resumeInputRef.current) resumeInputRef.current.value = ''
              }}
              className="mt-4 text-sm font-semibold text-[#306770] underline-offset-2 hover:underline"
            >
              Remove resume
            </button>
          )}
        </div>
      </div>
    ),
    (
      <>
        {resume && (
          <div className="mb-6 rounded-xl border border-[#C8DEDE] bg-[#F7FBFB] p-4 text-sm font-semibold text-[#306770]">
            This step is optional because your resume will auto-fill the core profile fields. Add anything extra here only if you want to.
          </div>
        )}
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
          <Field icon={<Phone size={18} />} label="Phone Number" required={!resume} error={fieldErrors.phone}>
            <input className={getInputClass('phone')} value={form.phone} onChange={(e) => setField('phone', e.target.value)} autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} />
          </Field>
          <Field icon={<MapPin size={18} />} label="Location" required={!resume} error={fieldErrors.location}>
            <input className={getInputClass('location')} value={form.location} onChange={(e) => setField('location', e.target.value)} placeholder="New York, NY" aria-invalid={Boolean(fieldErrors.location)} />
          </Field>
          <Field icon={<Briefcase size={18} />} label="Target Role" required={!resume} error={fieldErrors.targetRole}>
            <input className={getInputClass('targetRole')} value={form.targetRole} onChange={(e) => setField('targetRole', e.target.value)} placeholder="Senior Product Designer" aria-invalid={Boolean(fieldErrors.targetRole)} />
          </Field>
          <Field label="Seniority">
            <input className={inputClass} value={form.seniority} onChange={(e) => setField('seniority', e.target.value)} placeholder="Senior, Lead" />
          </Field>
        </div>

        <Field label="Skills" className="mt-8">
          <textarea className={`${inputClass} min-h-[130px] resize-y`} value={form.skills} onChange={(e) => setField('skills', e.target.value)} placeholder="React, TypeScript, MongoDB" />
        </Field>
      </>
    ),
    (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
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
    ),
  ]
  const canSubmitFromCurrentStep = step === SIGNUP_STEPS.length - 1 || (Boolean(resume) && step === 0)

  return (
    <div className="min-h-screen safe-area-top p-4" style={{ fontFamily: "'Manrope', sans-serif", animation: 'bgBreathe 6s ease-in-out infinite', background: 'linear-gradient(135deg, #a8cece, #c4dede, #e0eeee)' }}>
      <style>{`
        @keyframes bgBreathe {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.12); }
        }
      `}</style>
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-[#306770] rounded-full filter blur-[120px] opacity-25" style={{ animation: 'bgBreathe 8s ease-in-out infinite' }} />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-[#63B08D] rounded-full filter blur-[100px] opacity-20" style={{ animation: 'bgBreathe 8s ease-in-out infinite reverse' }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl py-8">
        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#306770] hover:underline"
          >
            <ArrowLeft size={16} />
            Back to landing
          </button>
        )}

        <div className="mb-5 rounded-2xl border border-[#C8DEDE] bg-white/95 p-6 shadow-xl backdrop-blur-xl md:p-8">
          <div className="mb-8 text-center">
            <h1 className="mb-2 break-words text-3xl font-bold tracking-wide text-[#306770] md:text-4xl" style={{ lineHeight: 1.1 }}>
              WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
            </h1>
            <p className="text-base text-gray-600">Create your profile and start matching with remote jobs</p>
          </div>

          <SocialSignupBox
            onSignup={onSignup}
            onError={setError}
            termsAccepted={termsAccepted}
            onTermsAcceptedChange={setTermsAgreement}
            onShowTerms={() => setShowTermsModal(true)}
            termsError={termsError}
            onRequireTerms={requireTerms}
          />
        </div>

        <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} className="rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-xl md:p-12">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#306770]">Manual signup</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Build your job seeker profile</h2>
          </div>

          <div className="mb-6">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {SIGNUP_STEPS.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (index <= step) {
                      setStep(index)
                      setError(null)
                      setFieldErrors({})
                      return
                    }
                    if (index === step + 1 && validateStep(step)) setStep(index)
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    index === step
                      ? 'border-[#306770] bg-[#306770] text-white shadow-md'
                      : index < step
                        ? 'border-[#C8DEDE] bg-[#EEF6F7] text-[#306770]'
                        : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wide">Step {index + 1}</span>
                  <span className="block truncate text-sm font-semibold">{item.title}</span>
                </button>
              ))}
            </div>
            <p className="text-sm font-medium text-gray-600">{SIGNUP_STEPS[step].description}</p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-300 bg-red-50/95 p-4 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

          <div className="-mx-1 overflow-hidden px-1 pb-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ x: 52, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -52, opacity: 0 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
              >
                {stepContent[step]}
              </motion.div>
            </AnimatePresence>
          </div>

          <TermsAgreement
            id="signup-terms-manual"
            checked={termsAccepted}
            onChange={setTermsAgreement}
            onShowTerms={() => setShowTermsModal(true)}
            error={termsError}
            className="mt-5"
          />

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-base font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-40"
              >
                Back
              </button>
            )}
            {!canSubmitFromCurrentStep ? (
              <button
                type="button"
                onClick={goNext}
                disabled={resumeParsing}
                className="w-full rounded-xl bg-[#306770] py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#245460] hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {resumeParsing ? 'Reading resume...' : step === 0 && resume ? 'Continue to account' : 'Next'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || resumeParsing}
                className="w-full rounded-xl bg-[#306770] py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#245460] hover:shadow-xl disabled:bg-gray-400"
              >
                {resumeParsing ? 'Reading resume...' : loading ? 'Creating account...' : 'Create Account'}
              </button>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button type="button" onClick={onSignIn} className="font-semibold text-[#306770] hover:underline">
              Sign in
            </button>
          </p>
        </form>
      </div>
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <TermsOfServicePage onBack={() => setShowTermsModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function TermsAgreement({
  id = 'signup-terms',
  checked,
  onChange,
  onShowTerms,
  error,
  className = '',
}: {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  onShowTerms: () => void
  error?: string | null
  className?: string
}) {
  return (
    <div className={`rounded-xl border p-3 text-left ${error ? 'border-red-300 bg-red-50/95' : 'border-[#C8DEDE] bg-[#F7FBFB]'} ${className}`}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#306770] focus:ring-[#306770]"
          aria-invalid={Boolean(error)}
        />
        <div className="text-sm font-medium text-gray-700">
          <label htmlFor={id}>I agree to the </label>
          <button type="button" onClick={onShowTerms} className="font-semibold text-[#306770] underline-offset-2 hover:underline">
            Terms of Service
          </button>
          <span>.</span>
        </div>
      </div>
      {error && <span className="mt-2 block text-xs font-semibold text-red-700">{error}</span>}
    </div>
  )
}

function Field({ icon, label, required, error, className = '', children }: { icon?: React.ReactNode; label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className={`mb-2 flex items-center gap-2 text-sm font-semibold ${error ? 'text-red-700' : 'text-gray-700'}`}>
        {icon && <span className={error ? 'text-red-700' : 'text-[#306770]'}>{icon}</span>}
        {label}
        {required && <span className={error ? 'text-red-700' : 'text-[#306770]'}>*</span>}
      </span>
      {children}
      {error && <span className="mt-2 block text-xs font-semibold text-red-700">{error}</span>}
    </label>
  )
}

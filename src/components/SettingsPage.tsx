import { ArrowLeft, Check, CreditCard, Eye, Files, Upload, WalletCards, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { updateUser } from '../api/users'
import { updateJobSeeker, uploadCandidateCoverLetter, uploadCandidateResume, type JobSeekerData } from '../api/jobseeker'

interface SettingsPageProps {
  onBack: () => void
  currentPage: 'account' | 'personal' | 'payment' | 'upgrade'
  onPageChange: (page: 'account' | 'personal' | 'payment' | 'upgrade') => void
  data?: JobSeekerData
  onCandidateUpdate?: (patch: any) => void
}

type DocumentModalState = null | {
  type: 'resume' | 'coverLetter'
  mode: 'current' | 'history'
}

const getDocumentName = (doc: any, fallback = 'Document') => {
  if (!doc) return fallback
  if (typeof doc === 'string') return doc
  return doc.originalname || doc.filename || doc.name || fallback
}

const getDocumentUrl = (doc: any) => {
  if (!doc) return ''
  if (typeof doc === 'string' && /^https?:\/\//i.test(doc)) return doc
  return doc.url || doc.link || doc.href || ''
}

const SettingsPage = ({ onBack, currentPage, onPageChange, data, onCandidateUpdate }: SettingsPageProps) => {
  const candidate = Array.isArray(data?.Candidates) ? data!.Candidates[0] : undefined
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('wanderworkProfile')
    return saved ? JSON.parse(saved) : {
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
      resume: null,
      coverLetter: null,
    }
  })

  const [storedPassword, setStoredPassword] = useState(() => localStorage.getItem('wanderworkPassword') || 'password123')
  const [userId] = useState(() => localStorage.getItem('wanderworkUserId') || '')
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal'>(() => {
    const saved = localStorage.getItem('wanderworkPaymentProvider')
    return saved === 'paypal' ? 'paypal' : 'stripe'
  })
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const resumeFileRef = useRef<HTMLInputElement>(null)
  const coverLetterFileRef = useRef<HTMLInputElement>(null)
  const saveDebounceRef = useRef<number | null>(null)
  const [documentModal, setDocumentModal] = useState<DocumentModalState>(null)

  useEffect(() => {
    if (!candidate) return
    const nextProfile = {
      fullName: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || profile.fullName,
      email: candidate.email || profile.email,
      phone: candidate.phone || profile.phone,
      location: candidate.location?.[0]?.locationName || candidate.location?.[0]?.city || profile.location,
      resume: candidate.resume || candidate.resumeLink || profile.resume,
      coverLetter: candidate.coverLetter || candidate.coverLetterLink || profile.coverLetter,
    }
    setProfile(nextProfile)
    localStorage.setItem('wanderworkProfile', JSON.stringify(nextProfile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?._id])

  const buildCandidatePatch = (field: string, value: string) => {
    if (field === 'fullName') {
      const parts = value.trim().split(/\s+/).filter(Boolean)
      return {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || ''
      }
    }
    if (field === 'location') {
      return { location: [{ locationName: value, city: value }] }
    }
    if (field === 'email' || field === 'phone') {
      return { [field]: value }
    }
    return null
  }

  const handleProfileChange = (field: string, value: string) => {
    const updated = { ...profile, [field]: value }
    setProfile(updated)
    localStorage.setItem('wanderworkProfile', JSON.stringify(updated))

    const candidatePatch = buildCandidatePatch(field, value)
    if (userId || (candidate?._id && candidatePatch)) {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
      // @ts-ignore
      saveDebounceRef.current = window.setTimeout(async () => {
        try {
          if (userId) {
            await updateUser(userId, { [field]: value })
          }
          if (candidate?._id && candidatePatch) {
            const patch = { _id: candidate._id, ...candidatePatch }
            await updateJobSeeker({ Candidates: [patch] })
            onCandidateUpdate?.(candidatePatch)
          }
        } catch (e) {
          console.warn('Failed to update profile field on server', field, e)
        }
      }, 600)
    }
  }

  const handleFileUpload = async (type: 'resume' | 'coverLetter', file: File | null) => {
    if (!file) return

    if (type === 'resume') {
      const confirm = window.confirm(
        "Are you sure you want to re-upload your resume? This may change your matches and costs 1 credit."
      )
      if (!confirm) {
        if (resumeFileRef.current) resumeFileRef.current.value = ''
        return
      }

      try {
        const result = await uploadCandidateResume(profile.email, file)
        const nextResume = result?.candidate?.resume || result?.candidate?.resumeLink || file.name
        const updated = { ...profile, resume: nextResume }
        setProfile(updated)
        localStorage.setItem('wanderworkProfile', JSON.stringify(updated))
        if (result?.candidate) onCandidateUpdate?.(result.candidate)
      } catch (err) {
        console.warn('Resume upload failed', err)
        alert('Resume upload failed. Please try again.')
        if (resumeFileRef.current) resumeFileRef.current.value = ''
        return
      }
      return
    }

    if (type === 'coverLetter') {
      try {
        const result = await uploadCandidateCoverLetter(profile.email, file)
        const nextCoverLetter = result?.candidate?.coverLetter || result?.candidate?.coverLetterLink || file.name
        const updated = { ...profile, coverLetter: nextCoverLetter }
        setProfile(updated)
        localStorage.setItem('wanderworkProfile', JSON.stringify(updated))
        if (result?.candidate) onCandidateUpdate?.(result.candidate)
      } catch (err) {
        console.warn('Cover letter upload failed', err)
        alert('Cover letter upload failed. Please try again.')
        if (coverLetterFileRef.current) coverLetterFileRef.current.value = ''
      }
      return
    }

    const updated = { ...profile, [type]: file.name }
    setProfile(updated)
    localStorage.setItem('wanderworkProfile', JSON.stringify(updated))
  }

  const handleChangePassword = async () => {
    setPasswordStatus(null)
    if (passwordForm.current !== storedPassword) {
      setPasswordStatus({ type: 'error', message: 'Current password is incorrect.' })
      return
    }
    if (passwordForm.next.length < 8) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 8 characters.' })
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }
    try {
      if (userId) {
        await updateUser(userId, { password: passwordForm.next })
        setPasswordStatus({ type: 'success', message: 'Password updated on server.' })
      } else {
        setPasswordStatus({ type: 'success', message: 'Password updated locally (no userId).' })
      }
      setStoredPassword(passwordForm.next)
      localStorage.setItem('wanderworkPassword', passwordForm.next)
      setPasswordForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPasswordStatus({ type: 'error', message: 'Failed to update password on server; stored locally.' })
      setStoredPassword(passwordForm.next)
      localStorage.setItem('wanderworkPassword', passwordForm.next)
      setPasswordForm({ current: '', next: '', confirm: '' })
    }
  }

  const handleResetPasswordLink = () => {
    setPasswordStatus({ type: 'success', message: `Password reset link sent to ${profile.email}.` })
  }

  const handlePaymentProviderChange = async (provider: 'stripe' | 'paypal') => {
    setPaymentProvider(provider)
    localStorage.setItem('wanderworkPaymentProvider', provider)
    if (userId) {
      try {
        await updateUser(userId, { paymentProvider: provider })
      } catch (e) {
        console.warn('Failed to update payment provider on server', e)
      }
    }
  }

  const documentVariants = useMemo(() => {
    const applications = Array.isArray(data?.Applications) ? [...data!.Applications] : []
    return applications
      .filter((application: any) => {
        if (!candidate?._id) return true
        const candidateId = typeof application.candidateId === 'object' ? application.candidateId?._id : application.candidateId
        return !candidateId || String(candidateId) === String(candidate._id)
      })
      .sort((a: any, b: any) => new Date(b.preparedAt || 0).getTime() - new Date(a.preparedAt || 0).getTime())
  }, [candidate?._id, data?.Applications])

  const resumeVariants = documentVariants
    .filter((application: any) => application.resume && (typeof application.resume !== 'object' || application.resume.content || application.resume.url || application.resume.filename))
    .slice(0, 3)

  const coverLetterVariants = documentVariants
    .filter((application: any) => Boolean(application.coverLetter))
    .slice(0, 3)

  const getVariants = (type: 'resume' | 'coverLetter') => type === 'resume' ? resumeVariants : coverLetterVariants
  const getCurrentDocument = (type: 'resume' | 'coverLetter') => type === 'resume'
    ? (profile.resume || candidate?.resume || candidate?.resumeLink)
    : (profile.coverLetter || candidate?.coverLetter || candidate?.coverLetterLink)

  const openCurrentDocument = (type: 'resume' | 'coverLetter') => {
    const current = getCurrentDocument(type)
    const url = getDocumentUrl(current)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setDocumentModal({ type, mode: 'current' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
      <div className="max-w-[1460px] mx-auto p-4 sm:p-6">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between mb-6 sm:mb-8 py-4 -mt-4" style={{ background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} style={{ color: '#306770' }} />
            </button>
            <h1 className="font-bold text-[24px]" style={{ color: '#306770', fontFamily: 'Manrope' }}>
              Settings
            </h1>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-[200px] flex-shrink-0">
            <div className="bg-white rounded-[15px] p-4" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <nav className="flex flex-col gap-2">
                <button
                  onClick={() => onPageChange('personal')}
                  className="px-4 py-2 rounded-[10px] text-left text-[14px] transition-colors"
                  style={{
                    background: currentPage === 'personal' ? '#30677010' : 'transparent',
                    color: '#306770',
                    fontWeight: currentPage === 'personal' ? '600' : '400'
                  }}
                >
                  Personal
                </button>
                <button
                  onClick={() => onPageChange('account')}
                  className="px-4 py-2 rounded-[10px] text-left text-[14px] transition-colors"
                  style={{
                    background: currentPage === 'account' ? '#30677010' : 'transparent',
                    color: '#306770',
                    fontWeight: currentPage === 'account' ? '600' : '400'
                  }}
                >
                  Account Settings
                </button>
                <button
                  onClick={() => onPageChange('payment')}
                  className="px-4 py-2 rounded-[10px] text-left text-[14px] transition-colors"
                  style={{
                    background: currentPage === 'payment' ? '#30677010' : 'transparent',
                    color: '#306770',
                    fontWeight: currentPage === 'payment' ? '600' : '400'
                  }}
                >
                  Payment Methods
                </button>
                <button
                  onClick={() => onPageChange('upgrade')}
                  className="px-4 py-2 rounded-[10px] text-left text-[14px] transition-colors"
                  style={{
                    background: currentPage === 'upgrade' ? '#30677010' : 'transparent',
                    color: '#306770',
                    fontWeight: currentPage === 'upgrade' ? '600' : '400'
                  }}
                >
                  Upgrade Plan
                </button>
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {currentPage === 'personal' && (
              <div className="bg-white rounded-[15px] p-6 sm:p-8" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h2 className="text-[24px] font-semibold mb-6" style={{ color: '#306770' }}>Personal Information</h2>

                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-[12px] mb-2" style={{ color: '#787878' }}>Full Name</label>
                    <input
                      type="text"
                      value={profile.fullName}
                      onChange={(e) => handleProfileChange('fullName', e.target.value)}
                      className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                      style={{ borderColor: '#DCDCDC', color: '#306770' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] mb-2" style={{ color: '#787878' }}>Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                      className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                      style={{ borderColor: '#DCDCDC', color: '#306770' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] mb-2" style={{ color: '#787878' }}>Phone</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                      style={{ borderColor: '#DCDCDC', color: '#306770' }}
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] mb-2" style={{ color: '#787878' }}>Location</label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => handleProfileChange('location', e.target.value)}
                      className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                      style={{ borderColor: '#DCDCDC', color: '#306770' }}
                    />
                  </div>

                  <div className="border-t" style={{ borderColor: '#DCDCDC', paddingTop: '24px' }}>
                    <h3 className="text-[16px] font-semibold mb-4" style={{ color: '#306770' }}>Documents</h3>

                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-[12px] mb-2" style={{ color: '#787878' }}>Resume</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => resumeFileRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-[10px] border flex-1 transition-colors"
                            style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                          >
                            <Upload size={16} />
                            <span className="text-[12px] truncate">{profile.resume ? `Resume: ${getDocumentName(profile.resume)}` : 'Upload Resume'}</span>
                          </button>
                          <button
                            type="button"
                            title="View current resume"
                            aria-label="View current resume"
                            onClick={() => openCurrentDocument('resume')}
                            disabled={!getCurrentDocument('resume')}
                            className="w-10 h-10 rounded-[10px] border flex items-center justify-center transition-colors disabled:opacity-40"
                            style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                          >
                            <Eye size={16} />
                          </button>
                          {resumeVariants.length > 0 && (
                            <button
                              type="button"
                              title="View resume history"
                              aria-label="View resume history"
                              onClick={() => setDocumentModal({ type: 'resume', mode: 'history' })}
                              className="w-10 h-10 rounded-[10px] border flex items-center justify-center transition-colors"
                              style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                            >
                              <Files size={16} />
                            </button>
                          )}
                        </div>
                        <input
                          ref={resumeFileRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileUpload('resume', e.target.files?.[0] || null)}
                          style={{ display: 'none' }}
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] mb-2" style={{ color: '#787878' }}>Cover Letter</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => coverLetterFileRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-[10px] border flex-1 transition-colors"
                            style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                          >
                            <Upload size={16} />
                            <span className="text-[12px] truncate">{profile.coverLetter ? `Letter: ${getDocumentName(profile.coverLetter)}` : 'Upload Cover Letter'}</span>
                          </button>
                          <button
                            type="button"
                            title="View current cover letter"
                            aria-label="View current cover letter"
                            onClick={() => openCurrentDocument('coverLetter')}
                            disabled={!getCurrentDocument('coverLetter')}
                            className="w-10 h-10 rounded-[10px] border flex items-center justify-center transition-colors disabled:opacity-40"
                            style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                          >
                            <Eye size={16} />
                          </button>
                          {coverLetterVariants.length > 0 && (
                            <button
                              type="button"
                              title="View cover letter history"
                              aria-label="View cover letter history"
                              onClick={() => setDocumentModal({ type: 'coverLetter', mode: 'history' })}
                              className="w-10 h-10 rounded-[10px] border flex items-center justify-center transition-colors"
                              style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                            >
                              <Files size={16} />
                            </button>
                          )}
                        </div>
                        <input
                          ref={coverLetterFileRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileUpload('coverLetter', e.target.files?.[0] || null)}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'account' && (
              <div className="bg-white rounded-[15px] p-6 sm:p-8" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h2 className="text-[24px] font-semibold mb-6" style={{ color: '#306770' }}>Account Settings</h2>

                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-[16px] font-semibold mb-4" style={{ color: '#306770' }}>Email & Password</h3>

                    {passwordStatus && (
                      <div
                        className={`mb-4 px-4 py-3 rounded-[10px] text-[13px] ${passwordStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                        style={{ border: '1px solid #DCDCDC' }}
                      >
                        {passwordStatus.message}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px]" style={{ color: '#787878' }}>Current Password</label>
                        <input
                          type="password"
                          value={passwordForm.current}
                          onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                          className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                          style={{ borderColor: '#DCDCDC', color: '#306770' }}
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px]" style={{ color: '#787878' }}>New Password</label>
                        <input
                          type="password"
                          value={passwordForm.next}
                          onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                          className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                          style={{ borderColor: '#DCDCDC', color: '#306770' }}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[12px]" style={{ color: '#787878' }}>Confirm New Password</label>
                        <input
                          type="password"
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                          className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                          style={{ borderColor: '#DCDCDC', color: '#306770' }}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="flex flex-col gap-2 justify-end">
                        <button
                          onClick={handleChangePassword}
                          className="px-4 py-2 rounded-[10px] border transition-colors w-full"
                          style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                        >
                          Update Password
                        </button>
                        <button
                          onClick={handleResetPasswordLink}
                          className="px-4 py-2 rounded-[10px] text-[13px] transition-colors w-full"
                          style={{ color: '#306770' }}
                        >
                          Send password reset link
                        </button>
                        <p className="text-[12px]" style={{ color: '#787878' }}>
                          Password changes attempt server update if `wanderworkUserId` is set; otherwise stored locally.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t" style={{ borderColor: '#DCDCDC', paddingTop: '24px' }}>
                    <h3 className="text-[16px] font-semibold mb-4" style={{ color: '#306770' }}>Notifications</h3>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                        <span className="text-[14px]" style={{ color: '#787878' }}>Email notifications for new jobs</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                        <span className="text-[14px]" style={{ color: '#787878' }}>Weekly job digest</span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t" style={{ borderColor: '#DCDCDC', paddingTop: '24px' }}>
                    <h3 className="text-[16px] font-semibold mb-4 text-red-600">Danger Zone</h3>
                    <button
                      className="px-4 py-2 rounded-[10px] border text-red-600 transition-colors"
                      style={{ borderColor: '#ff6b6b', background: '#ffe0e0' }}
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'payment' && (
              <div className="bg-white rounded-[15px] p-6 sm:p-8" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h2 className="text-[24px] font-semibold mb-6" style={{ color: '#306770' }}>Payment Methods</h2>

                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-[16px] font-semibold mb-4" style={{ color: '#306770' }}>Payment Provider</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handlePaymentProviderChange('stripe')}
                        className="flex items-center justify-between gap-3 rounded-[12px] border p-4 text-left transition-colors"
                        style={{
                          borderColor: paymentProvider === 'stripe' ? '#306770' : '#DCDCDC',
                          background: paymentProvider === 'stripe' ? '#30677010' : 'white',
                          color: '#306770'
                        }}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <CreditCard size={18} />
                          <span className="flex flex-col min-w-0">
                            <span className="text-[14px] font-semibold">Stripe</span>
                            <span className="text-[12px] truncate" style={{ color: '#787878' }}>Cards and saved payment methods</span>
                          </span>
                        </span>
                        {paymentProvider === 'stripe' && <Check size={18} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePaymentProviderChange('paypal')}
                        className="flex items-center justify-between gap-3 rounded-[12px] border p-4 text-left transition-colors"
                        style={{
                          borderColor: paymentProvider === 'paypal' ? '#306770' : '#DCDCDC',
                          background: paymentProvider === 'paypal' ? '#30677010' : 'white',
                          color: '#306770'
                        }}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <WalletCards size={18} />
                          <span className="flex flex-col min-w-0">
                            <span className="text-[14px] font-semibold">PayPal</span>
                            <span className="text-[12px] truncate" style={{ color: '#787878' }}>Pay with your PayPal account</span>
                          </span>
                        </span>
                        {paymentProvider === 'paypal' && <Check size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="border rounded-[10px] p-4" style={{ borderColor: '#DCDCDC' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: '#306770' }}>
                          {paymentProvider === 'stripe' ? 'Visa •••• 4451' : 'PayPal'}
                        </p>
                        <p className="text-[12px]" style={{ color: '#787878' }}>
                          {paymentProvider === 'stripe' ? 'Expires 12/26' : profile.email}
                        </p>
                      </div>
                      <button
                        className="px-3 py-1 rounded-[8px] text-[12px] border transition-colors"
                        style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <button
                    className="px-4 py-2 rounded-[10px] border transition-colors"
                    style={{ borderColor: '#306770', color: '#306770', background: 'white' }}
                    onClick={() => handlePaymentProviderChange(paymentProvider === 'stripe' ? 'paypal' : 'stripe')}
                  >
                    + Add {paymentProvider === 'stripe' ? 'PayPal' : 'Stripe'} Payment Method
                  </button>

                  <div className="border-t" style={{ borderColor: '#DCDCDC', paddingTop: '24px' }}>
                    <h3 className="text-[16px] font-semibold mb-4" style={{ color: '#306770' }}>Billing Address</h3>
                    <input
                      type="text"
                      placeholder="Your billing address"
                      className="w-full px-4 py-2 rounded-[10px] border text-[14px]"
                      style={{ borderColor: '#DCDCDC', color: '#787878' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentPage === 'upgrade' && (
              <div className="bg-white rounded-[15px] p-6 sm:p-8" style={{ boxShadow: '0px 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h2 className="text-[24px] font-semibold mb-2" style={{ color: '#306770' }}>Upgrade Your Plan</h2>
                <p className="text-[14px] mb-6" style={{ color: '#787878' }}>Currently on <strong>Starter</strong> plan</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border rounded-[15px] p-6" style={{ borderColor: '#DCDCDC' }}>
                    <h3 className="text-[18px] font-semibold mb-2" style={{ color: '#306770' }}>Pro</h3>
                    <p className="text-[24px] font-bold mb-4" style={{ color: '#306770' }}>$19<span style={{ fontSize: '14px', fontWeight: 'normal' }}>/mo</span></p>
                    <ul className="flex flex-col gap-2 mb-6 text-[12px]" style={{ color: '#787878' }}>
                      <li>✓ Unlimited job matches</li>
                      <li>✓ 200 tokens/month</li>
                      <li>✓ Priority support</li>
                      <li>✓ Resume optimization</li>
                    </ul>
                    <button
                      className="w-full px-4 py-2 rounded-[10px] text-[12px] transition-colors"
                      style={{ border: '1px solid #306770', color: '#306770', background: 'white' }}
                    >
                      Upgrade to Pro
                    </button>
                  </div>

                  <div className="border-2 rounded-[15px] p-6" style={{ borderColor: '#306770', background: '#30677010' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[18px] font-semibold" style={{ color: '#306770' }}>Premium</h3>
                      <span className="px-2 py-1 rounded-[8px] text-[10px] font-semibold" style={{ color: 'white', background: '#36BF8F' }}>Popular</span>
                    </div>
                    <p className="text-[24px] font-bold mb-4" style={{ color: '#306770' }}>$49<span style={{ fontSize: '14px', fontWeight: 'normal' }}>/mo</span></p>
                    <ul className="flex flex-col gap-2 mb-6 text-[12px]" style={{ color: '#787878' }}>
                      <li>✓ Everything in Pro</li>
                      <li>✓ 500 tokens/month</li>
                      <li>✓ Career coach access</li>
                      <li>✓ Custom cover letters</li>
                      <li>✓ Interview prep</li>
                    </ul>
                    <button
                      className="w-full px-4 py-2 rounded-[10px] text-[12px] text-white transition-colors"
                      style={{ background: '#306770' }}
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {documentModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={() => setDocumentModal(null)}>
          <div
            className="bg-white rounded-[18px] w-full max-w-[720px] max-h-[82vh] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.16)]"
            style={{ fontFamily: 'Manrope' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#DCDCDC' }}>
              <h3 className="text-[18px] font-semibold" style={{ color: '#306770' }}>
                {documentModal.type === 'resume' ? 'Resume' : 'Cover Letter'}
              </h3>
              <button
                type="button"
                aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ color: '#787878' }}
                onClick={() => setDocumentModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(82vh-74px)]">
              {(() => {
                const current = getCurrentDocument(documentModal.type)
                const currentUrl = getDocumentUrl(current)
                const variants = documentModal.mode === 'history' ? getVariants(documentModal.type) : []

                return (
                  <div className="flex flex-col gap-4">
                    <div className="border rounded-[12px] p-4" style={{ borderColor: '#DCDCDC' }}>
                      <p className="text-[12px] mb-2" style={{ color: '#787878' }}>Uploaded</p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] truncate" style={{ color: '#306770' }}>{current ? getDocumentName(current, 'Uploaded document') : 'No uploaded document'}</p>
                        {currentUrl && (
                          <a
                            href={currentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] px-3 py-2 rounded-[8px] border whitespace-nowrap"
                            style={{ borderColor: '#306770', color: '#306770' }}
                          >
                            Open
                          </a>
                        )}
                      </div>
                      {!currentUrl && typeof current === 'string' && (
                        <pre className="mt-3 max-h-[220px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: '#787878' }}>{current}</pre>
                      )}
                    </div>

                    {variants.map((application: any, index: number) => {
                      const generated = documentModal.type === 'resume' ? application.resume : application.coverLetter
                      const generatedContent = typeof generated === 'object' ? generated.content : generated
                      const generatedUrl = getDocumentUrl(generated)
                      const title = application.jobTitle || generated?.jobTitle || 'Generated variation'
                      const company = application.company || generated?.company || ''
                      return (
                        <div key={application._id || index} className="border rounded-[12px] p-4" style={{ borderColor: '#DCDCDC' }}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="text-[14px]" style={{ color: '#306770' }}>{title}{company ? ` at ${company}` : ''}</p>
                              <p className="text-[11px]" style={{ color: '#787878' }}>{application.preparedAt ? new Date(application.preparedAt).toLocaleDateString() : 'Generated'}</p>
                            </div>
                            {generatedUrl && (
                              <a
                                href={generatedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] px-3 py-2 rounded-[8px] border whitespace-nowrap"
                                style={{ borderColor: '#306770', color: '#306770' }}
                              >
                                Open
                              </a>
                            )}
                          </div>
                          {generatedContent && (
                            <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: '#787878' }}>{generatedContent}</pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage

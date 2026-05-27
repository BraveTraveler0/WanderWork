import { ArrowLeft, Check, CreditCard, Eye, Files, Upload, WalletCards, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { updateUser } from '../api/users'
import { updateJobSeeker, uploadCandidateCoverLetter, uploadCandidateResume, type JobSeekerData } from '../api/jobseeker'
import { createCheckoutSession, openCustomerPortal, type Plan as StripePlan } from '../api/stripe'

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let k = 0

  const renderInline = (str: string): React.ReactNode => {
    const parts = str.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: '#1a1a1a', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      }
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(part.trim())) {
        return <a key={i} href={`mailto:${part.trim()}`} style={{ color: '#306770' }}>{part}</a>
      }
      return part
    })
  }

  const flushList = () => {
    if (!listItems.length) return
    elements.push(
      <ul key={k++} style={{ listStyle: 'none', padding: 0, margin: '0 0 10px 0' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, color: '#444', fontSize: 13, lineHeight: '1.6' }}>
            <span style={{ color: '#306770', flexShrink: 0 }}>•</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '---') {
      flushList()
      elements.push(<hr key={k++} style={{ borderColor: '#E5E7EB', borderTopWidth: 1, margin: '14px 0' }} />)
    } else if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2))
    } else if (trimmed === '') {
      flushList()
    } else {
      flushList()
      const isBold = trimmed.startsWith('**') && trimmed.endsWith('**')
      elements.push(
        <p key={k++} style={{ margin: '0 0 4px 0', fontSize: isBold ? 14 : 13, lineHeight: '1.6', color: isBold ? '#222' : '#444' }}>
          {renderInline(trimmed)}
        </p>
      )
    }
  }
  flushList()
  return elements
}

interface SettingsPageProps {
  onBack: () => void
  currentPage: 'account' | 'personal' | 'payment' | 'upgrade'
  onPageChange: (page: 'account' | 'personal' | 'payment' | 'upgrade') => void
  data?: JobSeekerData
  onCandidateUpdate?: (patch: any) => void
  onDeleteAccount?: () => void
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

const getSavedJson = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return fallback
    return JSON.parse(saved)
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

const SettingsPage = ({ onBack, currentPage, onPageChange, data, onCandidateUpdate, onDeleteAccount }: SettingsPageProps) => {
  const candidate = Array.isArray(data?.Candidates) ? data!.Candidates[0] : undefined
  const [profile, setProfile] = useState<any>(() => {
    return getSavedJson('wanderworkProfile', {
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      location: 'New York, NY',
      resume: null,
      coverLetter: null,
    })
  })

  const [storedPassword, setStoredPassword] = useState(() => localStorage.getItem('wanderworkPassword') || 'password123')
  const [userId] = useState(() => localStorage.getItem('wanderworkUserId') || '')
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal'>(() => {
    const saved = localStorage.getItem('wanderworkPaymentProvider')
    return saved === 'paypal' ? 'paypal' : 'stripe'
  })
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [notifications, setNotifications] = useState<{ jobAlerts: boolean; weeklyDigest: boolean }>(() => {
    return getSavedJson('wanderworkNotifications', { jobAlerts: true, weeklyDigest: true })
  })
  const [upgradeLoading, setUpgradeLoading] = useState<StripePlan | null>(null)
  const handleUpgrade = async (plan: StripePlan) => {
    setUpgradeLoading(plan)
    try {
      const url = await createCheckoutSession(plan, profile.email)
      window.location.href = url
    } catch (err: any) {
      await showAlert('Checkout Failed', err?.message || 'Could not start checkout. Please try again.')
    } finally {
      setUpgradeLoading(null)
    }
  }

  const handleNotificationChange = (key: 'jobAlerts' | 'weeklyDigest', value: boolean) => {
    const next = { ...notifications, [key]: value }
    setNotifications(next)
    localStorage.setItem('wanderworkNotifications', JSON.stringify(next))
    if (userId) {
      updateUser(userId, { notifications: next }).catch(e => console.warn('Failed to save notification prefs', e))
    }
  }

  const resumeFileRef = useRef<HTMLInputElement>(null)
  const coverLetterFileRef = useRef<HTMLInputElement>(null)
  const saveDebounceRef = useRef<number | null>(null)
  const [documentModal, setDocumentModal] = useState<DocumentModalState>(null)

  type SiteModal = null | {
    title: string
    message: string
    type: 'alert' | 'confirm'
    onConfirm?: () => void
    onCancel?: () => void
  }
  const [siteModal, setSiteModal] = useState<SiteModal>(null)
  const showAlert = (title: string, message: string) =>
    new Promise<void>(resolve =>
      setSiteModal({ title, message, type: 'alert', onConfirm: () => { setSiteModal(null); resolve() } })
    )
  const showConfirm = (title: string, message: string) =>
    new Promise<boolean>(resolve =>
      setSiteModal({
        title, message, type: 'confirm',
        onConfirm: () => { setSiteModal(null); resolve(true) },
        onCancel: () => { setSiteModal(null); resolve(false) },
      })
    )

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
      const hasResume = !!(profile.resume || profile.resumeLink)
      const confirmed = await showConfirm(
        'Upload Resume',
        hasResume
          ? 'Re-uploading your resume costs 3 credits and may change your job matches. Continue?'
          : 'Upload your resume to unlock personalized job matches. Your first upload is free. Continue?'
      )
      if (!confirmed) {
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
      } catch (err: any) {
        console.warn('Resume upload failed', err)
        await showAlert('Upload Failed', err?.message || 'Resume upload failed. Please try again.')
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

                    <div className="flex flex-col gap-0">

                      {/* Step 1 — Verify current password */}
                      <div className="rounded-[14px] p-5 mb-4" style={{ background: '#f9fafb', border: '1px solid #EBEBEB' }}>
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#306770', letterSpacing: '1.5px' }}>Current Password</p>
                        <div className="flex flex-col gap-2">
                          <label className="text-[12px]" style={{ color: '#9ca3af' }}>Enter your current password to make changes</label>
                          <input
                            type="password"
                            value={passwordForm.current}
                            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-[10px] border text-[14px] bg-white"
                            style={{ borderColor: '#DCDCDC', color: '#1f2937', outline: 'none' }}
                            autoComplete="current-password"
                          />
                        </div>
                      </div>

                      {/* Step 2 — Set new password */}
                      <div className="rounded-[14px] p-5" style={{ background: '#f9fafb', border: '1px solid #EBEBEB' }}>
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#306770', letterSpacing: '1.5px' }}>New Password</p>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[12px]" style={{ color: '#9ca3af' }}>New password</label>
                            <input
                              type="password"
                              value={passwordForm.next}
                              onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                              placeholder="Min. 8 characters"
                              className="w-full px-4 py-3 rounded-[10px] border text-[14px] bg-white"
                              style={{ borderColor: '#DCDCDC', color: '#1f2937', outline: 'none' }}
                              autoComplete="new-password"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[12px]" style={{ color: '#9ca3af' }}>Confirm new password</label>
                            <input
                              type="password"
                              value={passwordForm.confirm}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                              placeholder="Re-enter new password"
                              className="w-full px-4 py-3 rounded-[10px] border text-[14px] bg-white"
                              style={{ borderColor: '#DCDCDC', color: '#1f2937', outline: 'none' }}
                              autoComplete="new-password"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={handleChangePassword}
                          className="px-6 py-2.5 rounded-[10px] text-[13px] font-semibold transition-colors"
                          style={{ background: '#306770', color: 'white', border: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#245460')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#306770')}
                        >
                          Update Password
                        </button>
                        <button
                          onClick={handleResetPasswordLink}
                          className="text-[13px] transition-colors"
                          style={{ color: '#306770', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Send reset link instead
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t" style={{ borderColor: '#DCDCDC', paddingTop: '24px' }}>
                    <h3 className="text-[16px] font-semibold mb-4" style={{ color: '#306770' }}>Notifications</h3>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.jobAlerts}
                          onChange={e => handleNotificationChange('jobAlerts', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-[14px]" style={{ color: '#787878' }}>Email notifications for new jobs</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications.weeklyDigest}
                          onChange={e => handleNotificationChange('weeklyDigest', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-[14px]" style={{ color: '#787878' }}>Weekly job digest</span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t" style={{ borderColor: '#DCDCDC', paddingTop: '24px' }}>
                    <h3 className="text-[16px] font-semibold mb-4 text-red-600">Danger Zone</h3>
                    <button
                      className="px-4 py-2 rounded-[10px] border text-red-600 transition-colors"
                      style={{ borderColor: '#ff6b6b', background: '#ffe0e0' }}
                      onClick={() => {
                        if (window.confirm('Permanently delete your account? This cannot be undone.')) {
                          onDeleteAccount?.()
                        }
                      }}
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
                    onClick={() => {
                      if (paymentProvider === 'stripe') {
                        openCustomerPortal(profile.email).catch(() =>
                          window.open('https://billing.stripe.com', '_blank', 'noopener,noreferrer')
                        )
                      } else {
                        window.open('https://www.paypal.com/signin', '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    + Add {paymentProvider === 'stripe' ? 'Stripe' : 'PayPal'} Payment Method
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Starter — current plan */}
                  <div className="border-2 rounded-[15px] p-6 flex flex-col" style={{ borderColor: '#306770', borderStyle: 'dashed' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[18px] font-semibold" style={{ color: '#306770' }}>Starter</h3>
                      <span className="px-2 py-1 rounded-[8px] text-[10px] font-semibold" style={{ color: '#306770', background: '#30677015', border: '1px solid #306770' }}>Current Plan</span>
                    </div>
                    <p className="text-[24px] font-bold mb-4" style={{ color: '#306770' }}>$0<span style={{ fontSize: '14px', fontWeight: 'normal' }}>/mo</span></p>
                    <ul className="flex flex-col gap-2 mb-6 text-[12px] flex-1" style={{ color: '#787878' }}>
                      <li>✓ Daily job matches</li>
                      <li>✓ 10 tokens/month</li>
                      <li>✓ Basic resume upload</li>
                      <li>✓ Job bookmarks</li>
                    </ul>
                    <button
                      disabled
                      className="w-full px-4 py-2 rounded-[10px] text-[12px]"
                      style={{ border: '1px solid #DCDCDC', color: '#AAAAAA', background: '#F9F9F9', cursor: 'not-allowed' }}
                    >
                      Your Current Plan
                    </button>
                  </div>

                  {/* Pro */}
                  <div className="border rounded-[15px] p-6 flex flex-col" style={{ borderColor: '#DCDCDC' }}>
                    <h3 className="text-[18px] font-semibold mb-2" style={{ color: '#306770' }}>Pro</h3>
                    <p className="text-[24px] font-bold mb-4" style={{ color: '#306770' }}>$19<span style={{ fontSize: '14px', fontWeight: 'normal' }}>/mo</span></p>
                    <ul className="flex flex-col gap-2 mb-6 text-[12px] flex-1" style={{ color: '#787878' }}>
                      <li>✓ Unlimited job matches</li>
                      <li>✓ 100 tokens/month</li>
                      <li>✓ 20 recruiter emails/day</li>
                      <li>✓ Resume optimization</li>
                    </ul>
                    <button
                      className="w-full px-4 py-2 rounded-[10px] text-[12px] transition-colors"
                      style={{ border: '1px solid #306770', color: '#306770', background: 'white', opacity: upgradeLoading === 'pro' ? 0.6 : 1 }}
                      disabled={!!upgradeLoading}
                      onClick={() => handleUpgrade('pro')}
                    >
                      {upgradeLoading === 'pro' ? 'Redirecting...' : 'Upgrade to Pro'}
                    </button>
                  </div>

                  {/* Premium */}
                  <div className="border-2 rounded-[15px] p-6 flex flex-col" style={{ borderColor: '#306770', background: '#30677010' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[18px] font-semibold" style={{ color: '#306770' }}>Premium</h3>
                      <span className="px-2 py-1 rounded-[8px] text-[10px] font-semibold" style={{ color: 'white', background: '#36BF8F' }}>Popular</span>
                    </div>
                    <p className="text-[24px] font-bold mb-4" style={{ color: '#306770' }}>$49<span style={{ fontSize: '14px', fontWeight: 'normal' }}>/mo</span></p>
                    <ul className="flex flex-col gap-2 mb-6 text-[12px] flex-1" style={{ color: '#787878' }}>
                      <li>✓ Everything in Pro</li>
                      <li>✓ 200 tokens/month</li>
                      <li>✓ 30 recruiter emails/day</li>
                      <li>✓ Career coach access</li>
                      <li>✓ Interview prep</li>
                    </ul>
                    <button
                      className="w-full px-4 py-2 rounded-[10px] text-[12px] text-white transition-colors"
                      style={{ background: '#306770', opacity: upgradeLoading === 'premium' ? 0.6 : 1 }}
                      disabled={!!upgradeLoading}
                      onClick={() => handleUpgrade('premium')}
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
      {siteModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '32px 32px 28px', maxWidth: 420, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', fontFamily: 'Manrope, sans-serif' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#306770', marginBottom: 12 }}>{siteModal.title}</h3>
            <p style={{ fontSize: 14, color: '#787878', lineHeight: 1.65, marginBottom: 28 }}>{siteModal.message}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {siteModal.type === 'confirm' && (
                <button
                  onClick={siteModal.onCancel}
                  style={{ padding: '10px 22px', borderRadius: 10, border: '1.5px solid #DCDCDC', background: 'white', color: '#787878', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={siteModal.onConfirm}
                style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: '#306770', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
              >
                {siteModal.type === 'confirm' ? 'Continue' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
      {documentModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: 'rgba(48,103,112,0.18)', backdropFilter: 'blur(4px)' }} onClick={() => setDocumentModal(null)}>
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
                        <div className="mt-3 max-h-[220px] overflow-y-auto">{renderMarkdown(current)}</div>
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
                            <div className="max-h-[260px] overflow-y-auto">{renderMarkdown(generatedContent)}</div>
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

import { useEffect, useRef, useState } from 'react'
import { Check, ArrowRight, Users } from 'lucide-react'
import { submitCustomRequest, updateJobSeeker, getPairedRecruiters } from '../api/jobseeker.ts'
import { createTokenCheckoutSession } from '../api/stripe'

const INTERESTED_KEY = 'wanderworkInterestedJobs'
function loadInterestedOverrides(): Record<number, boolean> {
  try { return JSON.parse(localStorage.getItem(INTERESTED_KEY) || '{}') } catch { return {} }
}
import CustomJobRequestModal from './CustomJobRequestModal'
import RecruiterOutreach from './RecruiterOutreach'

interface StatsPanelProps {
  jobId: number | null
  onClose: () => void
  data?: any
  jobs?: any[]
  onNewJobsClick?: () => void
  onRecruiterContactsClick?: () => void
}

const StatsPanel = ({ jobId, data, jobs = [], onNewJobsClick, onRecruiterContactsClick }: StatsPanelProps) => {
  // Calculate stats from backend data or use sensible defaults
  const allJobs = Array.isArray(jobs) && jobs.length ? jobs : (data?.Jobs ?? [])
  const newJobsCount = allJobs.filter((j: any) => j.hasNewBadge === true).length
  const firstCandidate = Array.isArray(data?.Candidates) ? data!.Candidates[0] : undefined
  const tokensCount = (firstCandidate?.tokenBalance ?? firstCandidate?.tokens ?? 30)
  const recruiterContactsLeft: number = firstCandidate?.recruiterContactsLeft ?? 10
  const [showCustomRequestModal, setShowCustomRequestModal] = useState<{ jobId: string | number; jobTitle: string; company: string; job?: any } | null>(null)
  const selectedJobForCompany = jobs?.find((job: any) => job.id === jobId) ?? data?.Jobs?.find((job: any) => job.id === jobId)
  const selectedCompany: string | undefined = selectedJobForCompany?.company

  const [interestedOverrides, setInterestedOverrides] = useState<Record<number, boolean>>(loadInterestedOverrides)

  const toggleInterested = async (job: any) => {
    let nextValue = false
    setInterestedOverrides((prev) => {
      const base = Boolean(job.interested)
      const current = prev[job.id]
      nextValue = !(current !== undefined ? current : base)
      const next = { ...prev, [job.id]: nextValue }
      localStorage.setItem(INTERESTED_KEY, JSON.stringify(next))
      return next
    })
    try {
      const candidateId = firstCandidate?._id
      const backendJobId = job?.backendId
      if (candidateId && backendJobId) {
        await updateJobSeeker({ Applications: [{ jobId: backendJobId, candidateId, status: nextValue ? 'interested' : 'not_interested' }] })
      }
    } catch (e) {
      console.warn('Failed to update interested status', e)
    }
  }

  const [hasCompanyRecruiters, setHasCompanyRecruiters] = useState(false)
  const [showRecruiterModal, setShowRecruiterModal] = useState(false)
  const [showTokensModal, setShowTokensModal] = useState(false)
  const [tokenQty, setTokenQty] = useState(10)
  const [currentTokens, setCurrentTokens] = useState(tokensCount)
  const [displayTokens, setDisplayTokens] = useState(tokensCount)
  const prevTokensRef = useRef(tokensCount)
  const [showToast, setShowToast] = useState(false)
  const [floatDelta, setFloatDelta] = useState<number | null>(null)
  const [floatKey, setFloatKey] = useState(0)
  const [creditBalanceOverride, setCreditBalanceOverride] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal'>('stripe')
  const [tokenCheckoutLoading, setTokenCheckoutLoading] = useState(false)
  const [tokenCheckoutError, setTokenCheckoutError] = useState<string | null>(null)

  const baseCredits = (() => {
    const tokenValue = firstCandidate?.tokenBalance ?? firstCandidate?.tokens
    if (Number.isFinite(tokenValue)) return tokenValue as number
    const creditValue = firstCandidate?.creditsBalance
    return Number.isFinite(creditValue) ? (creditValue as number) : 0
  })()
  const currentCredits = creditBalanceOverride ?? baseCredits

  const openTokens = () => {
    setTokenQty(10)
    setShowTokensModal(true)
  }

  const closeTokens = () => setShowTokensModal(false)

  const increment = () => setTokenQty((q) => q + 1)
  const decrement = () => setTokenQty((q) => (q > 0 ? q - 1 : 0))

  const tokenPrice = (tokenQty / 3).toFixed(2)

  const openPayPalCheckout = () => {
    const params = new URLSearchParams({
      cmd: '_xclick',
      business: 'dcartercreative@gmail.com',
      amount: tokenPrice,
      currency_code: 'USD',
      item_name: `Wander/Work Tokens (${tokenQty})`,
      no_note: '1',
      no_shipping: '1',
    })
    window.open(`https://www.paypal.com/cgi-bin/webscr?${params.toString()}`, '_blank')
  }

  const addTokensLocally = async () => {
    const newTotal = currentTokens + tokenQty
    setCurrentTokens(newTotal)
    setShowTokensModal(false)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
    setFloatDelta(tokenQty)
    setFloatKey((k) => k + 1)
    setTimeout(() => setFloatDelta(null), 3200)
    // Persist token change for first candidate when possible
    try {
      const candidate = data?.Candidates?.[0]
      if (candidate?._id) {
        await updateJobSeeker({
          Candidates: [
            { _id: candidate._id, tokenBalance: newTotal }
          ]
        })
      }
    } catch (e) {
      // Swallow errors; UI remains responsive and local
      console.warn('Failed to persist token update', e)
    }
  }

  const purchase = async () => {
    if (tokenQty < 1 || tokenCheckoutLoading) return
    setTokenCheckoutError(null)

    if (paymentMethod === 'paypal') {
      openPayPalCheckout()
      await addTokensLocally()
      return
    }

    setTokenCheckoutLoading(true)
    try {
      const email = firstCandidate?.email || data?.Candidates?.[0]?.email || ''
      const url = await createTokenCheckoutSession(tokenQty, email)
      window.location.href = url
    } catch (err: any) {
      setTokenCheckoutError(err?.message || 'Could not start Stripe checkout. Please try again.')
      setTokenCheckoutLoading(false)
    }
  }

  useEffect(() => {
    const start = prevTokensRef.current
    const end = currentTokens
    if (start === end) {
      return
    }
    const duration = 2000
    const frames = 60
    let frame = 0
    const increment = (end - start) / frames
    setDisplayTokens(start)
    const timer = setInterval(() => {
      frame += 1
      const next = start + increment * frame
      if (frame >= frames) {
        setDisplayTokens(end)
        clearInterval(timer)
        prevTokensRef.current = end
      } else {
        setDisplayTokens(Math.round(next))
      }
    }, duration / frames)
    return () => clearInterval(timer)
  }, [currentTokens])

  useEffect(() => {
    setCreditBalanceOverride(baseCredits)
  }, [baseCredits])

  useEffect(() => {
    if (!firstCandidate?._id || !selectedCompany) { setHasCompanyRecruiters(false); return }
    let cancelled = false
    getPairedRecruiters(firstCandidate._id, 1, selectedCompany)
      .then(({ recruiters }) => { if (!cancelled) setHasCompanyRecruiters(recruiters.length > 0) })
      .catch(() => { if (!cancelled) setHasCompanyRecruiters(false) })
    return () => { cancelled = true }
  }, [selectedCompany, firstCandidate?._id])

  const handleCustomRequest = async (options: { resume: boolean; coverLetter: boolean }) => {
    if (!showCustomRequestModal) return
    const totalCost = (options.resume ? 1 : 0) + (options.coverLetter ? 1 : 0)
    if (totalCost <= 0) return

    const webhookPayload = {
      email: firstCandidate?.email || '',
      firstName: firstCandidate?.firstName || '',
      lastName: firstCandidate?.lastName || '',
      jobId: showCustomRequestModal.jobId,
      jobTitle: showCustomRequestModal.jobTitle,
      company: showCustomRequestModal.company,
      jobUrl: showCustomRequestModal.job?.url || '',
      resume: options.resume,
      coverLetter: options.coverLetter
    }

    const result = await submitCustomRequest(webhookPayload)
    // Server handles token deduction atomically and returns the new balance
    const newBalance = result?.tokensRemaining ?? Math.max(0, currentCredits - totalCost)
    setCreditBalanceOverride(newBalance)
  }
  
  return (
    <div className="flex flex-col gap-4 lg:gap-6 xl:gap-8 w-full pl-2 lg:pl-2 pr-0 min-h-full overflow-visible pt-2 lg:pt-3 xl:pt-4" style={{ fontFamily: 'Manrope' }}>
      <style>{`@keyframes tokenFloat { 0% { opacity: 1; transform: translate(-50%, 0); } 85% { opacity: 1; transform: translate(-50%, -36px); } 100% { opacity: 0; transform: translate(-50%, -72px); } }`}</style>
      {/* Stats - Desktop only */}
      <div className="hidden lg:flex gap-4 xl:gap-6 justify-center">
        <StatCard number={newJobsCount.toString()} label="New Jobs" onClick={onNewJobsClick} clickable />
        <div className="relative overflow-visible">
          <StatCard number={displayTokens.toString()} label="Tokens" onClick={openTokens} clickable />
          {floatDelta !== null && (
            <span
              key={floatKey}
              className="absolute left-1/2 top-4 text-[22px] font-bold select-none"
              style={{ color: '#36BF8F', animation: 'tokenFloat 2.5s ease-out forwards', transform: 'translate(-50%, 0)', zIndex: 20 }}
            >
              +{floatDelta}
            </span>
          )}
        </div>
        <StatCard
          number={recruiterContactsLeft.toString()}
          label="Recruiters Left"
          onClick={onRecruiterContactsClick}
          clickable
        />
      </div>
      {/* Job Detail Card */}
      {(() => {
        // First try to find in jobs array, then in data
        const selectedJob = jobs?.find((job: any) => job.id === jobId) || 
                           data?.Jobs?.find((job: any) => job.id === jobId) || 
                           {
          id: jobId,
          title: 'Job Title',
          company: 'Coca - Cola',
          location: 'New York, NY, USA',
          skills: ['UX', 'Design', 'Marketing'],
          description: 'We couldn\'t load this job\'s full description yet. You can still review your match, confirm the requirements, and apply directly on the employer\'s site.'
        }

        const formatPostedDate = (postedAt: string | null | undefined): string => {
          if (!postedAt) return 'Unknown'
          const posted = new Date(postedAt)
          if (isNaN(posted.getTime())) return 'Unknown'
          const now = new Date()
          const diffMs = now.getTime() - posted.getTime()
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          
          if (diffDays === 0) return 'Today'
          if (diffDays === 1) return 'Yesterday'
          if (diffDays <= 7) return `${diffDays} days ago`
          
          // After a week, show the actual date
          const month = posted.toLocaleString('en-US', { month: 'short' })
          const day = posted.getDate()
          const year = posted.getFullYear()
          return `${month} ${day}, ${year}`
        }

        const safeDescription = (() => {
          const stripHtml = (html: string) => {
            const tmp = document.createElement('div')
            tmp.innerHTML = html
            return (tmp.textContent || tmp.innerText || '').trim()
          }

          const fallbackMessage = "Unfortunately, we don’t have much information about this job. Check out the \"Apply\" link to learn more — Wander/Work Team."
          const isTooShort = (value: string) => {
            const trimmed = value.replace(/\s+/g, ' ').trim()
            const sentenceCount = (trimmed.match(/[.!?]/g) || []).length
            return trimmed.length < 120 && sentenceCount < 2
          }

          const addBreaks = (text: string) => {
            const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const toTitle = (value: string) => value.replace(/\b\w/g, (m) => m.toUpperCase())
            const sections = [
              'company overview',
              'key responsibilities',
              'qualifications/skills',
              'responsibilities',
              'responsibility',
              'requirements',
              'qualifications',
              'what you will do',
              'what you ll do',
              'what you\'ll do',
              'what you will bring',
              'what we are looking for',
              'who you are',
              'about the role',
              'about the opportunity',
              'benefits',
              'compensation',
              'skills',
              'nice to have',
              'preferred',
              'position',
              'job details'
            ]
            let withSections = text
            for (const section of sections) {
              const escaped = escapeRegExp(section)
              const label = toTitle(section)
              const re = new RegExp(`\\b${escaped}\\b`, 'ig')
              withSections = withSections.replace(re, `\n\n${label}`)
              const glued = new RegExp(`(${escaped})(?=[A-Z])`, 'ig')
              withSections = withSections.replace(glued, `\n\n${label} `)
            }

            const sentenceBreak = withSections.replace(/([.!?])\s*(?=[A-Z0-9])/g, '$1\n')
            const lines = sentenceBreak
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)

            const grouped: string[] = []
            let buffer: string[] = []
            for (const line of lines) {
              buffer.push(line)
              if (buffer.length >= 2) {
                grouped.push(buffer.join(' '))
                buffer = []
              }
            }
            if (buffer.length) grouped.push(buffer.join(' '))

            return grouped.join('\n\n')
          }

          const stripJunkMeta = (text: string) => {
            let s = text
            s = s.replace(/^[\s\S]*?skip\s+to\s+main\s+content\s*/i, '')
            s = s.replace(/^\s*why\s+you\s+were\s+matched\s*:?\s*/i, '')
            s = s.replace(/^best\s+\S.*?\bjobs?\b[^.]*?\d{4}\s*/i, '')
            s = s.replace(/\b(?:re)?posted\s+\d+\s+days?\s+ago\s*saved?\b/gi, '')
            s = s.replace(/\b\d+\s+days?\s+ago\s*saved?\b/gi, '')
            s = s.replace(/\bany\s+time\s+\(\d[\d,]+\)[\s\S]*$/i, '')
            return s.replace(/\s{3,}/g, '  ').trim()
          }

          const fromValue = (value: any): string => {
            if (!value) return ''
            if (typeof value === 'string') return stripJunkMeta(stripHtml(value))
            if (Array.isArray(value)) return stripJunkMeta(stripHtml(value.filter(Boolean).join(' ')))
            if (typeof value === 'object') {
              const joined = Object.values(value).filter((v) => typeof v === 'string').join(' ')
              return stripJunkMeta(stripHtml(joined))
            }
            return ''
          }

          const desc = fromValue((selectedJob as any).description)
          if (desc) {
            const formatted = addBreaks(desc)
            return isTooShort(formatted) ? fallbackMessage : formatted
          }
          const summary = fromValue((selectedJob as any).summary)
          if (summary) {
            const formatted = addBreaks(summary)
            return isTooShort(formatted) ? fallbackMessage : formatted
          }
          return fallbackMessage
        })()
        
        const applyUrl = typeof (selectedJob as any).url === 'string' ? (selectedJob as any).url : ''

        return (
          <div 
            key={(selectedJob as any).id ?? jobId}
            className="stats-panel-enter bg-white rounded-[16px] lg:rounded-[20px] p-5 lg:p-6 xl:p-10"
            style={{
              boxShadow: '0 2px 6px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.05)'
            }}
          >

            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3 lg:pr-4">
                  <h3 className="text-[18px] xl:text-[22px] 2xl:text-[24px] text-black mb-2 line-clamp-2">{selectedJob.title}</h3>
                  <p className="text-[18px] xl:text-[22px] 2xl:text-[24px] mb-3 xl:mb-4 line-clamp-2" style={{ color: '#787878' }}>{selectedJob.company}</p>
                </div>
                <div className="text-right text-[12px]" style={{ color: '#787878' }}>
                  {(() => {
                    const override = interestedOverrides[(selectedJob as any).id]
                    const isInterested = override !== undefined ? override : Boolean((selectedJob as any).interested)
                    return (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleInterested(selectedJob) }}
                        className="flex items-center justify-end gap-2 mb-2 rounded-full px-3 py-1 transition-all duration-200"
                        style={{
                          border: isInterested ? '1px solid #306770' : '1px solid #DCDCDC',
                          background: isInterested ? '#EEF6F7' : 'transparent',
                          color: isInterested ? '#306770' : '#AAAAAA',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#306770'; e.currentTarget.style.color = '#306770' }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isInterested ? '#306770' : '#DCDCDC'
                          e.currentTarget.style.color = isInterested ? '#306770' : '#AAAAAA'
                        }}
                      >
                        <Check size={13} />
                        <span className="whitespace-nowrap text-[11px] font-medium">
                          {isInterested ? "I'm Interested" : 'Mark Interested'}
                        </span>
                      </button>
                    )
                  })()}
                  <p className="mb-1">{formatPostedDate(selectedJob.postedAt ?? selectedJob.rawDate)}</p>
                  <p>{selectedJob.location}</p>
                </div>
              </div>

              {/* Match Reason */}
              <p className="text-[16px]" style={{ color: '#787878' }}>
                Why you were matched : {selectedJob.skills?.join(', ')}
              </p>

              {/* Description */}
              <p className="text-[16px] leading-relaxed whitespace-pre-line" style={{ color: '#787878' }}>
                {safeDescription}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 flex-wrap">
                  <a
                    className="px-5 py-2 rounded-[10px] text-[12px] bg-white whitespace-nowrap flex-shrink-0 transition-all duration-500 hover:bg-[#306770] hover:border-[#306770] hover:text-white"
                    style={{ 
                      border: '1px solid #306770',
                      color: '#306770',
                      transition: 'all 0.5s',
                      opacity: applyUrl ? 1 : 0.5,
                      pointerEvents: applyUrl ? 'auto' : 'none'
                    }}
                    href={applyUrl || undefined}
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#306770'}
                  >
                    Apply on site
                  </a>
                  <button
                    className="cta-glow flex items-center gap-2 px-4 py-2 rounded-[10px] text-[12px] text-white whitespace-nowrap flex-shrink-0 transition-all duration-300 hover:scale-105"
                    style={{ background: '#306770' }}
                    onClick={() => setShowCustomRequestModal({
                      jobId: selectedJob.backendId || selectedJob._id || selectedJob.job_code || selectedJob.id,
                      jobTitle: selectedJob.title,
                      company: selectedJob.company,
                      job: selectedJob
                    })}
                  >
                    Get Resume or Cover Letter
                    <span className="arrow-nudge"><ArrowRight size={14} /></span>
                  </button>
                  {hasCompanyRecruiters && (
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[12px] whitespace-nowrap flex-shrink-0 transition-all duration-300 hover:scale-105"
                      style={{ border: '1px solid #306770', color: '#306770' }}
                      onClick={() => setShowRecruiterModal(true)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#306770'; e.currentTarget.style.color = 'white' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#306770' }}
                    >
                      <Users size={13} />
                      Contact Recruiters
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {showTokensModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={closeTokens}>
          <div
            className="bg-white rounded-[20px] w-full max-w-[420px] shadow-[0_30px_90px_rgba(0,0,0,0.16)] p-8 relative"
            style={{ fontFamily: 'Manrope' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              className="absolute right-4 top-4 text-[16px]" 
              style={{ color: '#787878' }}
              onClick={closeTokens}
            >
              ×
            </button>

            <p className="text-[13px] mb-6" style={{ color: '#787878' }}>
              You currently have {currentTokens} Tokens.
            </p>

            <div className="flex items-center justify-center gap-6 mb-4">
              <button
                className="w-12 h-12 rounded-full border text-[28px] flex items-center justify-center"
                style={{ borderColor: '#DCDCDC', color: '#306770' }}
                onClick={decrement}
              >
                –
              </button>
              <div className="text-[54px] font-semibold" style={{ color: '#306770' }}>{tokenQty}</div>
              <button
                className="w-12 h-12 rounded-full border text-[28px] flex items-center justify-center"
                style={{ borderColor: '#DCDCDC', color: '#306770' }}
                onClick={increment}
              >
                +
              </button>
            </div>

            <p className="text-center text-[16px] mb-2" style={{ color: '#787878' }}>Tokens</p>
            <p className="text-center text-[13px] mb-6" style={{ color: '#787878' }}>
              {tokenQty} Tokens at 3 Tokens per $1 comes:
            </p>

            <div className="flex items-center justify-between text-[13px] mb-4" style={{ color: '#787878' }}>
              <span>Total</span>
              <span className="text-[14px]" style={{ color: '#306770' }}>${tokenPrice}</span>
            </div>

            <div className="text-[13px] mb-6" style={{ color: '#787878' }}>
              <span>Payment Method</span>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="rounded-[10px] border px-4 py-3 text-left transition-colors"
                  style={{
                    borderColor: paymentMethod === 'stripe' ? '#306770' : '#DCDCDC',
                    background: paymentMethod === 'stripe' ? 'rgba(48,103,112,0.08)' : 'white',
                    color: paymentMethod === 'stripe' ? '#306770' : '#787878',
                  }}
                  onClick={() => setPaymentMethod('stripe')}
                >
                  <span className="block text-[13px] font-semibold">Stripe</span>
                  <span className="block text-[11px]">Card checkout</span>
                </button>
                <button
                  type="button"
                  className="rounded-[10px] border px-4 py-3 text-left transition-colors"
                  style={{
                    borderColor: paymentMethod === 'paypal' ? '#306770' : '#DCDCDC',
                    background: paymentMethod === 'paypal' ? 'rgba(48,103,112,0.08)' : 'white',
                    color: paymentMethod === 'paypal' ? '#306770' : '#787878',
                  }}
                  onClick={() => setPaymentMethod('paypal')}
                >
                  <span className="block text-[13px] font-semibold">PayPal</span>
                  <span className="block text-[11px]">PayPal account</span>
                </button>
              </div>
            </div>

            {tokenCheckoutError && (
              <div className="mb-4 rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}>
                {tokenCheckoutError}
              </div>
            )}

            <button
              className="w-full rounded-[10px] border px-4 py-3 text-[13px] transition-colors"
              style={{ borderColor: '#306770', color: '#306770' }}
              onClick={purchase}
              disabled={tokenCheckoutLoading || tokenQty < 1}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#306770', e.currentTarget.style.color = 'white')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white', e.currentTarget.style.color = '#306770')}
            >
              {tokenCheckoutLoading ? 'Opening Stripe...' : paymentMethod === 'stripe' ? 'Checkout with Stripe' : 'Checkout with PayPal'}
            </button>
          </div>
        </div>
      )}

      {showRecruiterModal && firstCandidate?._id && (
        <RecruiterOutreach
          candidateId={firstCandidate._id}
          currentTokens={currentCredits}
          dailyLimit={recruiterContactsLeft}
          onClose={() => setShowRecruiterModal(false)}
          onTokensChanged={(newBalance) => setCreditBalanceOverride(newBalance)}
          company={selectedCompany}
        />
      )}

      {showCustomRequestModal && (
        <CustomJobRequestModal
          jobTitle={showCustomRequestModal.jobTitle}
          company={showCustomRequestModal.company}
          onClose={() => setShowCustomRequestModal(null)}
          onSubmit={handleCustomRequest}
          currentCredits={currentCredits}
        />
      )}

      {showToast && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-[14px] shadow-2xl border text-[16px] font-semibold" style={{ background: 'white', borderColor: '#306770', color: '#306770', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            Thanks! Your tokens have been added.
          </div>
        </div>
      )}
    </div>
  )
}

export default StatsPanel

const StatCard = ({ number, label, onClick, clickable }: { number: string, label: string, onClick?: () => void, clickable?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col gap-2 text-center"
    style={{ fontFamily: 'Manrope', cursor: clickable ? 'pointer' : 'default', background: 'transparent' }}
  >
    <p className="text-[64px] leading-none text-[#787878] transition-colors duration-1000 ease-out group-hover:text-[#306770]">{number}</p>
    <p className="text-[12px]" style={{ color: '#787878' }}>{label}</p>
  </button>
)

import React, { useEffect, useRef, useState } from 'react'
import { Check, ArrowRight, Users, ChevronDown } from 'lucide-react'
import { submitCustomRequest, updateJobSeeker, getPairedRecruiters } from '../api/jobseeker.ts'
import { createTokenCheckoutSession, redeemPromoCode } from '../api/stripe'

const INTERESTED_KEY = 'wanderworkInterestedJobs'
function loadInterestedOverrides(): Record<number, boolean> {
  try { return JSON.parse(localStorage.getItem(INTERESTED_KEY) || '{}') } catch { return {} }
}
import CustomJobRequestModal, { type CustomJobRequestOptions } from './CustomJobRequestModal'
import RecruiterOutreach from './RecruiterOutreach'

const asText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

const asStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => asText(item).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

const NEW_JOB_WINDOW_DAYS = 30

const parseJobDate = (value: unknown): Date | null => {
  if (!value) return null
  const parsed = new Date(value as any)
  if (!Number.isNaN(parsed.getTime())) return parsed
  if (typeof value === 'string') {
    const withZ = new Date(`${value}Z`)
    if (!Number.isNaN(withZ.getTime())) return withZ
  }
  if (!Number.isNaN(Number(value))) {
    const numeric = new Date(Number(value))
    if (!Number.isNaN(numeric.getTime())) return numeric
  }
  return null
}

const getObjectIdDate = (id: unknown): Date | null => {
  if (typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) {
    return new Date(parseInt(id.substring(0, 8), 16) * 1000)
  }
  return null
}

const getJobAddedDate = (job: any): Date | null => {
  return (
    parseJobDate(job?.createdAt) ||
    parseJobDate(job?.addedAt) ||
    parseJobDate(job?.importedAt) ||
    getObjectIdDate(job?._id || job?.backendId) ||
    parseJobDate(job?.postedAt || job?.rawDate || job?.datePosted || job?.date_posted || job?.preparedAt)
  )
}

const isNewJob = (job: any): boolean => {
  if (job?.hasNewBadge === true) return true
  const added = getJobAddedDate(job)
  if (!added) return false
  const diffDays = (Date.now() - added.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= NEW_JOB_WINDOW_DAYS
}

interface StatsPanelProps {
  jobId: number | null
  onClose: () => void
  data?: any
  jobs?: any[]
  onNewJobsClick?: () => void
  onRecruiterContactsClick?: () => void
  isAuthenticated?: boolean
  onSignUp?: () => void
  autoOpenCoverLetterJobId?: number | null
  onAutoOpenCoverLetterHandled?: () => void
}

const StatsPanel = ({ jobId, data, jobs = [], onNewJobsClick, onRecruiterContactsClick, isAuthenticated = true, onSignUp, autoOpenCoverLetterJobId, onAutoOpenCoverLetterHandled }: StatsPanelProps) => {
  // Calculate stats from backend data or use sensible defaults
  const allJobs = Array.isArray(jobs) && jobs.length ? jobs : (data?.Jobs ?? [])
  const newJobsCount = allJobs.filter(isNewJob).length
  const firstCandidate = Array.isArray(data?.Candidates) ? data!.Candidates[0] : undefined
  const tokensCount = (firstCandidate?.tokenBalance ?? firstCandidate?.tokens ?? 30)
  const recruiterContactsLeft: number = firstCandidate?.recruiterContactsLeft ?? 10
  const targetRoles = asStringList(firstCandidate?.targetRoles)
  const hasUploadedResume = !!(asText(firstCandidate?.resume_text).trim() || firstCandidate?.resumeLink)
  const hasBasicProfile = !!(asText(firstCandidate?.firstName).trim() && targetRoles.length)
  const canOrder = hasUploadedResume && hasBasicProfile
  const [showCustomRequestModal, setShowCustomRequestModal] = useState<{ jobId: string | number; jobTitle: string; company: string; job?: any } | null>(null)
  const [initialCustomRequest, setInitialCustomRequest] = useState<{ resume?: boolean; coverLetter?: boolean } | null>(null)
  const selectedJobForCompany = jobs?.find((job: any) => job.id === jobId) ?? data?.Jobs?.find((job: any) => job.id === jobId)
  const selectedCompany = asText(selectedJobForCompany?.company).trim() || undefined

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
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'paypal' | 'code' | 'other'>('stripe')
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false)
  const [tokenCheckoutLoading, setTokenCheckoutLoading] = useState(false)
  const [tokenCheckoutError, setTokenCheckoutError] = useState<string | null>(null)
  const [paypalInfo, setPaypalInfo] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [customPayment, setCustomPayment] = useState('')
  const [otherSuccess, setOtherSuccess] = useState(false)

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

  const purchase = async () => {
    if (tokenQty < 1 || tokenCheckoutLoading) return
    setTokenCheckoutError(null)
    setCodeError(null)
    setPaypalInfo(null)

    if (paymentMethod === 'code') {
      const email = firstCandidate?.email || data?.Candidates?.[0]?.email || ''
      if (!email) { setCodeError('Could not find your account email. Please log in again.'); return }
      setTokenCheckoutLoading(true)
      try {
        const result = await redeemPromoCode(promoCode.trim(), email, tokenQty)
        // Server confirmed payment — update local state with server-returned balance
        setCurrentTokens(result.tokenBalance)
        setShowTokensModal(false)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 2000)
        setFloatDelta(result.added)
        setFloatKey((k) => k + 1)
        setTimeout(() => setFloatDelta(null), 3200)
      } catch (err: any) {
        setCodeError(err?.message || 'Invalid code. Please check and try again.')
      } finally {
        setTokenCheckoutLoading(false)
      }
      return
    }

    if (paymentMethod === 'paypal') {
      openPayPalCheckout()
      setPaypalInfo('Complete your payment in the PayPal window. Once confirmed, your tokens will be added within seconds.')
      return
    }

    if (paymentMethod === 'other') {
      if (!customPayment.trim()) {
        setTokenCheckoutError('Please describe your preferred payment method.')
        return
      }
      setOtherSuccess(true)
      return
    }

    // Stripe — redirect to hosted checkout; tokens added server-side via webhook on success
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
    if (creditBalanceOverride !== null) setCurrentTokens(creditBalanceOverride)
  }, [creditBalanceOverride])

  useEffect(() => {
    if (!firstCandidate?._id || !selectedCompany) { setHasCompanyRecruiters(false); return }
    let cancelled = false
    getPairedRecruiters(firstCandidate._id, 1, selectedCompany)
      .then(({ recruiters }) => { if (!cancelled) setHasCompanyRecruiters(recruiters.length > 0) })
      .catch(() => { if (!cancelled) setHasCompanyRecruiters(false) })
    return () => { cancelled = true }
  }, [selectedCompany, firstCandidate?._id])

  useEffect(() => {
    if (!autoOpenCoverLetterJobId || autoOpenCoverLetterJobId !== jobId) return
    const selectedJob = jobs?.find((job: any) => job.id === jobId) ||
      data?.Jobs?.find((job: any) => job.id === jobId) ||
      selectedJobForCompany

    if (!selectedJob) return
    if (canOrder) {
      setInitialCustomRequest({ coverLetter: true })
      setShowCustomRequestModal({
        jobId: selectedJob.backendId || selectedJob._id || selectedJob.job_code || selectedJob.id,
        jobTitle: asText(selectedJob.title, 'Job Title'),
        company: asText(selectedJob.company, 'Company'),
        job: selectedJob,
      })
    }
    onAutoOpenCoverLetterHandled?.()
  }, [autoOpenCoverLetterJobId, jobId, jobs, data?.Jobs, selectedJobForCompany, canOrder, onAutoOpenCoverLetterHandled])

  const handleCustomRequest = async (options: CustomJobRequestOptions) => {
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
      coverLetter: options.coverLetter,
      fileFormat: options.fileFormat
    }

    const result = await submitCustomRequest(webhookPayload)
    // Server handles token deduction atomically and returns the new balance
    const newBalance = result?.tokensRemaining ?? Math.max(0, currentCredits - totalCost)
    setCreditBalanceOverride(newBalance)
    return result
  }
  
  return (
    <div className="flex flex-col gap-4 lg:gap-6 xl:gap-8 w-full pl-2 lg:pl-2 pr-0 min-h-full overflow-visible pt-2 lg:pt-3 xl:pt-4" style={{ fontFamily: 'Manrope' }}>
      <style>{`@keyframes tokenFloat { 0% { opacity: 1; transform: translate(-50%, 0); } 85% { opacity: 1; transform: translate(-50%, -36px); } 100% { opacity: 0; transform: translate(-50%, -72px); } }`}</style>
      {/* Stats - Desktop only */}
      <div className="hidden lg:flex gap-4 xl:gap-6 justify-center">
        <StatCard number={newJobsCount.toString()} label="New Jobs" onClick={onNewJobsClick} clickable />
        {!isAuthenticated && <TokenCoinIcon onClick={onSignUp} />}
        {isAuthenticated && <>
          <div className="relative overflow-visible group/tokens">
            <StatCard number={displayTokens.toString()} label="Tokens" onClick={openTokens} clickable />
            <button
              type="button"
              onClick={openTokens}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover/tokens:opacity-100 transition-opacity duration-200"
              style={{ background: '#BFE3D2', color: '#306770' }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>+</span>
            </button>
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
          <div className="relative overflow-visible group/recruiters">
            <StatCard
              number={recruiterContactsLeft.toString()}
              label="Recruiters Left"
              onClick={onRecruiterContactsClick}
              clickable
            />
            <button
              type="button"
              onClick={onRecruiterContactsClick}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover/recruiters:opacity-100 transition-opacity duration-200"
              style={{ background: '#BFE3D2', color: '#306770' }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>+</span>
            </button>
          </div>
        </>}
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
            const lines = text
              .replace(/([.!?])\s*(?=[A-Z0-9])/g, '$1\n')
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
            const grouped: string[] = []
            let buffer: string[] = []
            for (const line of lines) {
              buffer.push(line)
              if (buffer.length >= 2) { grouped.push(buffer.join(' ')); buffer = [] }
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

          const stripMarkdown = (text: string) => {
            return text
              .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1')
              .replace(/(^|\n)\s{0,3}[-*_]{3,}\s*(?=\n|$)/g, '$1')
              .replace(/(^|\n)\s{0,3}(\*\*|__)\s*about\s+[^*\n_:]{2,80}\s*:?\s*\2\s*/gi, '$1')
              .replace(/(^|\n)\s{0,3}(\*|_)\s*about\s+[^*\n_:]{2,80}\s*:?\s*\2\s*/gi, '$1')
              .replace(/(^|\n)\s{0,3}(\*\*|__)\s*(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|company\s+description|company|description)\s*:?\s*\2\s*:?\s*/gi, '$1')
              .replace(/(^|\n)\s{0,3}(\*|_)\s*(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|company\s+description|company|description)\s*:?\s*\2\s*:?\s*/gi, '$1')
              .replace(/(^|\n)\s{0,3}(about\s+us|about\s+the\s+role|about\s+the\s+opportu?nity|company\s+description|company|description)\s*:?\s*/gi, '$1')
              .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
              .replace(/\*\*([^*\n]+)\*\*/g, '$1')
              .replace(/\*([^*\n]+)\*/g, '$1')
              .replace(/___([^_\n]+)___/g, '$1')
              .replace(/__([^_\n]+)__/g, '$1')
              .replace(/_([^_\n]+)_/g, '$1')
              .replace(/\*\*/g, '')
              .trim()
          }

          const cleanDescriptionText = (value: string) =>
            stripMarkdown(stripJunkMeta(stripHtml(value)))

          const fromValue = (value: any): string => {
            if (!value) return ''
            if (typeof value === 'string') return cleanDescriptionText(value)
            if (Array.isArray(value)) return cleanDescriptionText(value.filter(Boolean).join(' '))
            if (typeof value === 'object') {
              const joined = Object.values(value).filter((v) => typeof v === 'string').join(' ')
              return cleanDescriptionText(joined)
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
        
        // Prefer apply_url (direct company listing) over url (aggregator page)
        const _rawApplyUrl: string = (selectedJob as any).apply_url || (selectedJob as any).applyUrl || (selectedJob as any).url || ''
        const AGGREGATOR_HOSTS = ['jobicy.com', 'remoteok.com', 'arbeitnow.com', 'workingnomads.com', 'linkedin.com']
        const isAggregator = (u: string) => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return AGGREGATOR_HOSTS.some(a => h === a || h.endsWith('.' + a)) } catch { return false } }
        const _directUrl = _rawApplyUrl && !isAggregator(_rawApplyUrl) ? _rawApplyUrl : ''
        const _company = typeof (selectedJob as any).company === 'string' ? (selectedJob as any).company : ''
        const _jobTitle = typeof (selectedJob as any).title === 'string' ? (selectedJob as any).title : ''
        const _googleFallback = _company ? `https://www.google.com/search?q=${encodeURIComponent(_company + ' ' + _jobTitle + ' jobs')}` : ''
        const applyUrl: string = _directUrl || _googleFallback

        // For Wellfound specific job URLs, show a fallback to the company jobs page in case the listing expired.
        // Only applies when the URL points at a specific job (has content after /jobs/),
        // not when it's already the company jobs listing page.
        const wellfoundCompanyUrl = (() => {
          if (!applyUrl.includes('wellfound.com/company/')) return null
          const match = applyUrl.match(/wellfound\.com\/company\/([^/]+)\/jobs\/(.+)/)
          return match ? `https://wellfound.com/company/${match[1]}/jobs` : null
        })()

        return (
          <React.Fragment key={(selectedJob as any).id ?? jobId}>
            <div
              className="stats-panel-enter bg-white rounded-[16px] lg:rounded-[20px] p-5 lg:p-6 xl:p-10"
              style={{
                boxShadow: '0 2px 6px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06), 0 8px 20px rgba(0,0,0,0.05)'
              }}
            >

              <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3 lg:pr-4">
                  <h3 className="text-[18px] xl:text-[22px] 2xl:text-[24px] text-black mb-2 line-clamp-2">{asText(selectedJob.title, 'Job Title')}</h3>
                  <p className="text-[18px] xl:text-[22px] 2xl:text-[24px] mb-3 xl:mb-4 line-clamp-2" style={{ color: '#787878' }}>{asText(selectedJob.company, 'Company')}</p>
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
                  <p>{asText(selectedJob.location, 'Remote')}</p>
                </div>
              </div>

              {/* Match Reason */}
              {(() => {
                const extractFallbackSkills = (title: string, desc: string, jobType: string): string[] => {
                  const text = `${title} ${desc}`.toLowerCase();
                  const titleLower = title.toLowerCase();
                  const found: string[] = [];

                  const skillMap: [RegExp, string][] = [
                    [/\bux\b|user experience/, 'UX'],
                    [/\bui\b|user interface/, 'UI'],
                    [/product manager|product management/, 'Product Management'],
                    [/software engineer|software dev/, 'Software Engineering'],
                    [/front.?end/, 'Frontend'],
                    [/back.?end/, 'Backend'],
                    [/full.?stack/, 'Full Stack'],
                    [/data science|data scientist/, 'Data Science'],
                    [/data engineer/, 'Data Engineering'],
                    [/data analyst/, 'Data Analytics'],
                    [/machine learning|\bml\b|deep learning/, 'Machine Learning'],
                    [/\bai\b|artificial intelligence/, 'AI'],
                    [/devops|site reliability/, 'DevOps'],
                    [/cloud|aws|azure|gcp/, 'Cloud'],
                    [/security|cybersecurity/, 'Cybersecurity'],
                    [/mobile|ios|android/, 'Mobile'],
                    [/\bdesign|\bdesigner/, 'Design'],
                    [/marketing/, 'Marketing'],
                    [/finance|financial|accounting/, 'Finance'],
                    [/sales|account executive|account manager/, 'Sales'],
                    [/operations|\bops\b/, 'Operations'],
                    [/recruiter|recruiting|talent acquisition/, 'Recruiting'],
                    [/project manager|program manager/, 'Project Management'],
                    [/\bcontent\b|copywriter/, 'Content'],
                    [/analytics|analyst/, 'Analytics'],
                    [/customer success|customer support/, 'Customer Success'],
                    [/legal|compliance|attorney/, 'Legal'],
                    [/healthcare|medical|clinical/, 'Healthcare'],
                    [/\bhr\b|human resources|people ops/, 'HR'],
                    [/graphic/, 'Graphic Design'],
                    [/video|motion/, 'Video'],
                    [/research|scientist/, 'Research'],
                    [/infrastructure|platform/, 'Infrastructure'],
                    [/blockchain|web3|crypto/, 'Web3'],
                    [/supply chain|logistics/, 'Supply Chain'],
                    [/brand/, 'Branding'],
                  ];

                  for (const [pattern, label] of skillMap) {
                    if (pattern.test(text)) found.push(label);
                    if (found.length === 3) return found;
                  }

                  // Seniority fallbacks from title
                  if (found.length < 3) {
                    if (/\bintern\b/i.test(titleLower)) found.push('Internship');
                    else if (/\bstaff\b|\bprincipal\b/i.test(titleLower)) found.push('Staff Level');
                    else if (/\blead\b/i.test(titleLower)) found.push('Lead');
                    else if (/\bsenior\b|\bsr\b/i.test(titleLower)) found.push('Senior');
                    else if (/\bjunior\b|\bjr\b/i.test(titleLower)) found.push('Junior');
                    else if (/\bdirector\b/i.test(titleLower)) found.push('Director');
                    else if (/\bmanager\b/i.test(titleLower)) found.push('Manager');
                  }

                  // Job type fallback
                  if (found.length < 2) {
                    const jt = String(jobType || '').toLowerCase();
                    if (/contract/i.test(jt)) found.push('Contract');
                    else if (/part.?time/i.test(jt)) found.push('Part-time');
                    else if (/full.?time/i.test(jt) || !jt) found.push('Full-time');
                  }

                  return found.slice(0, 3);
                };

                const selectedSkills = asStringList(selectedJob.skills)
                const matchSkills: string[] = selectedSkills.length > 0
                  ? selectedSkills.slice(0, 3)
                  : extractFallbackSkills(asText(selectedJob.title), asText(selectedJob.shortDescription || selectedJob.description_short), asText(selectedJob.jobType || selectedJob.job_type));
                return (
                  <div>
                    <p className="text-[13px] mb-2" style={{ color: '#787878' }}>Why you were matched</p>
                    <div className="flex flex-wrap gap-2">
                      {matchSkills.map((skill: string, i: number) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-block',
                            background: '#ffffff',
                            color: '#787878',
                            border: '1px solid #d1d5db',
                            borderRadius: '999px',
                            padding: '4px 14px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Description */}
              <p className="text-[16px] leading-relaxed whitespace-pre-line" style={{ color: '#787878' }}>
                {safeDescription}
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col xl:flex-row xl:items-start gap-3">
                  <a
                    className="flex items-center justify-center px-6 py-3 rounded-[10px] text-[12px] bg-white whitespace-nowrap transition-all duration-500 hover:bg-[#306770] hover:border-[#306770] hover:text-white xl:flex-1"
                    style={{
                      border: '1px solid #306770',
                      color: '#306770',
                      minWidth: 0,
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
                  <div className="flex flex-col xl:flex-1 min-w-0" style={{ gap: 4 }}>
                    <button
                      className={`cta-glow w-full min-w-0 flex items-center justify-center gap-2 px-6 py-3 rounded-[10px] text-[12px] text-white whitespace-nowrap transition-all duration-300${canOrder ? ' hover:scale-[1.015]' : ''}`}
                      style={{ background: canOrder ? '#306770' : '#AAAAAA', cursor: canOrder ? 'pointer' : 'not-allowed' }}
                      disabled={!canOrder}
                      onClick={canOrder ? () => {
                        setInitialCustomRequest(null)
                        setShowCustomRequestModal({
                          jobId: selectedJob.backendId || selectedJob._id || selectedJob.job_code || selectedJob.id,
                          jobTitle: asText(selectedJob.title, 'Job Title'),
                          company: asText(selectedJob.company, 'Company'),
                          job: selectedJob
                        })
                      } : undefined}
                    >
                      Get Resume or Cover Letter
                      <span className="arrow-nudge"><ArrowRight size={14} /></span>
                    </button>
                    {!canOrder && (
                      <p style={{ fontSize: 11, color: '#AAAAAA', margin: 0, lineHeight: 1.4 }}>
                        {!hasUploadedResume
                          ? 'Upload a resume in your profile to unlock this.'
                          : 'Add your name and a target role in your profile to unlock this.'}
                      </p>
                    )}
                  </div>
                </div>
                {wellfoundCompanyUrl && (
                  <p className="text-[11px]" style={{ color: '#AAAAAA' }}>
                    If that link is expired,{' '}
                    <a
                      href={wellfoundCompanyUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#306770', textDecoration: 'underline' }}
                    >
                      view all open roles at this company
                    </a>
                    .
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  {isAuthenticated && hasCompanyRecruiters && (
                    <button
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-[12px] whitespace-nowrap flex-shrink-0 transition-all duration-300 hover:scale-105"
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
            <div className="mt-8 w-full px-1 sm:px-3 xl:px-5">
              <ParticleWaveIcon />
            </div>
          </React.Fragment>
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

            <div className="text-[13px] mb-4" style={{ color: '#787878' }}>
              <label className="block mb-2">Payment Method</label>
              {/* Custom payment method dropdown with logos */}
              {(() => {
                const pmOptions: { value: 'stripe' | 'paypal' | 'code' | 'other'; label: string; sub: string | null; icon: React.ReactNode }[] = [
                  {
                    value: 'stripe', label: 'Stripe', sub: 'Card checkout',
                    icon: <span style={{ width: 24, height: 24, borderRadius: 5, background: '#635BFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 800, color: 'white', fontFamily: 'Arial' }}>S</span>,
                  },
                  {
                    value: 'paypal', label: 'PayPal', sub: 'PayPal account',
                    icon: <span style={{ width: 24, height: 24, borderRadius: 5, background: '#003087', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#009CDE', fontFamily: 'Arial', letterSpacing: '-0.5px' }}>PP</span>,
                  },
                  {
                    value: 'code', label: 'Use Code', sub: null,
                    icon: <span style={{ width: 24, height: 24, borderRadius: 5, background: '#F0FAF5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#36BF8F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></span>,
                  },
                ]
                const selected = pmOptions.find(o => o.value === paymentMethod)!
                return (
                  <div style={{ position: 'relative' }}>
                    {showPaymentDropdown && (
                      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPaymentDropdown(false)} />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPaymentDropdown(v => !v)}
                      className="w-full rounded-[10px] border px-3 py-2.5 outline-none flex items-center gap-2.5"
                      style={{ borderColor: '#DCDCDC', color: '#306770', background: 'white', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {selected.icon}
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{selected.label}{selected.sub && <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 5 }}>{selected.sub}</span>}</span>
                      <ChevronDown size={14} style={{ color: '#aaa', transform: showPaymentDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    {showPaymentDropdown && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #DCDCDC', borderRadius: 10, zIndex: 50, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                        {pmOptions.map((opt, i) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setPaymentMethod(opt.value)
                              setShowPaymentDropdown(false)
                              setCodeError(null)
                              setTokenCheckoutError(null)
                              setPaypalInfo(null)
                              setPromoCode('')
                              setCustomPayment('')
                              setOtherSuccess(false)
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                            style={{
                              background: paymentMethod === opt.value ? '#F0FAF5' : 'transparent',
                              color: '#306770', border: 'none', cursor: 'pointer', fontSize: 13,
                              borderTop: i > 0 ? '1px solid #F5F5F5' : 'none',
                            }}
                            onMouseEnter={e => { if (paymentMethod !== opt.value) e.currentTarget.style.background = '#FAFAFA' }}
                            onMouseLeave={e => { if (paymentMethod !== opt.value) e.currentTarget.style.background = 'transparent' }}
                          >
                            {opt.icon}
                            <span style={{ fontWeight: 600 }}>{opt.label}{opt.sub && <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 5 }}>{opt.sub}</span>}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {paymentMethod === 'code' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); setCodeError(null) }}
                  placeholder="Enter promo code"
                  className="w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none"
                  style={{ borderColor: codeError ? '#FCA5A5' : '#DCDCDC', color: '#306770' }}
                />
                {codeError && (
                  <p className="mt-1 text-[12px]" style={{ color: '#B91C1C' }}>{codeError}</p>
                )}
              </div>
            )}

            {paymentMethod === 'other' && !otherSuccess && (
              <div className="mb-4">
                <input
                  type="text"
                  value={customPayment}
                  onChange={(e) => { setCustomPayment(e.target.value); setTokenCheckoutError(null) }}
                  placeholder="Describe your preferred payment method"
                  className="w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none"
                  style={{ borderColor: '#DCDCDC', color: '#306770' }}
                />
              </div>
            )}

            {paymentMethod === 'other' && otherSuccess && (
              <div className="mb-4 rounded-[10px] border px-3 py-2.5 text-[13px]" style={{ borderColor: '#A7F3D0', color: '#065F46', background: '#ECFDF5' }}>
                Got it — we've noted <strong>{customPayment}</strong>. Reach out to support to complete your purchase and we'll get you set up.
              </div>
            )}

            {paypalInfo && (
              <div className="mb-4 rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: '#93C5FD', color: '#1E40AF', background: '#EFF6FF' }}>
                {paypalInfo}
              </div>
            )}

            {tokenCheckoutError && (
              <div className="mb-4 rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}>
                {tokenCheckoutError}
              </div>
            )}

            {!(paymentMethod === 'other' && otherSuccess) && (
              <button
                className="w-full rounded-[10px] py-3 text-[14px] font-semibold transition-all"
                style={{ background: '#306770', color: 'white', border: 'none' }}
                onClick={purchase}
                disabled={tokenCheckoutLoading || tokenQty < 1}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#245460' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#306770' }}
              >
                {tokenCheckoutLoading ? 'Opening checkout…' : 'Get Tokens'}
              </button>
            )}
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
          onClose={() => {
            setShowCustomRequestModal(null)
            setInitialCustomRequest(null)
          }}
          onSubmit={handleCustomRequest}
          currentCredits={currentCredits}
          initialResume={Boolean(initialCustomRequest?.resume)}
          initialCoverLetter={Boolean(initialCustomRequest?.coverLetter)}
          isAuthenticated={isAuthenticated}
          onSignUp={onSignUp}
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

const TokenCoinIcon = ({ onClick }: { onClick?: () => void }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animRef = React.useRef<number>()
  const mouseRef = React.useRef({ x: -999, y: -999, radius: 800 })
  const particlesRef = React.useRef<Array<{
    ox: number; oy: number; x: number; y: number
    vx: number; vy: number; size: number; color: string
  }>>([])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const S = 64
    canvas.width = S; canvas.height = S
    const cx = S / 2, cy = S / 2

    // Offscreen: draw coin circle + "1" in lighter color
    const off = document.createElement('canvas')
    off.width = S; off.height = S
    const oc = off.getContext('2d')!
    // Zen enso: large gap (~80°) at top-right, thick rounded stroke
    const gapStart = -0.1          // gap opens near 12 o'clock, tilts right
    const gapSize = 1.35           // ~77° opening like the reference enso
    oc.strokeStyle = '#306770'
    oc.lineWidth = S * 0.20
    oc.lineCap = 'round'
    oc.beginPath()
    oc.arc(cx, cy, S * 0.29, gapStart + gapSize, gapStart + Math.PI * 2)
    oc.stroke()
    // Subtle inner shadow for depth
    oc.strokeStyle = '#1e4e57'
    oc.lineWidth = S * 0.05
    oc.globalAlpha = 0.35
    oc.beginPath()
    oc.arc(cx, cy, S * 0.22, gapStart + gapSize + 0.1, gapStart + Math.PI * 2 - 0.1)
    oc.stroke()
    oc.globalAlpha = 1

    const px = oc.getImageData(0, 0, S, S).data
    const gap = 3
    const ps: typeof particlesRef.current = []
    for (let y = 0; y < S; y += gap) {
      for (let x = 0; x < S; x += gap) {
        const i = (y * S + x) * 4
        if (px[i + 3] < 64) continue
        const b = 0.65 + Math.random() * 0.35
        const color = `rgb(${Math.floor(48*b)},${Math.floor(103*b)},${Math.floor(112*b)})`
        ps.push({ ox: x, oy: y, x, y, vx: 0, vy: 0, size: Math.floor(Math.random() * 2) + 1, color })
      }
    }
    particlesRef.current = ps

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = (e.clientX - rect.left) * (S / rect.width)
      mouseRef.current.y = (e.clientY - rect.top) * (S / rect.height)
    }
    const onLeave = () => { mouseRef.current.x = -999; mouseRef.current.y = -999 }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    const animate = () => {
      ctx.clearRect(0, 0, S, S)
      const mouse = mouseRef.current
      for (const p of particlesRef.current) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y
        const dist2 = dx * dx + dy * dy
        if (dist2 < mouse.radius) {
          const force = -mouse.radius / dist2 * 5
          const angle = Math.atan2(dy, dx)
          p.vx += force * Math.cos(angle)
          p.vy += force * Math.sin(angle)
        }
        p.x += (p.vx *= 0.9) + (p.ox - p.x) * 0.18
        p.y += (p.vy *= 0.9) + (p.oy - p.y) * 0.18
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <button type="button" onClick={onClick} className="group flex flex-col gap-2 items-center text-center"
      style={{ fontFamily: 'Manrope', cursor: onClick ? 'pointer' : 'default', background: 'transparent' }}>
      <canvas ref={canvasRef}
        style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, cursor: 'crosshair' }} />
      <p className="text-[12px]" style={{ color: '#787878' }}>Start Earning Tokens</p>
    </button>
  )
}

const ParticleWaveIcon = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animRef = React.useRef<number>()
  const mouseRef = React.useRef({ x: -999, y: -999, radius: 1000 })
  const particlesRef = React.useRef<Array<{
    ox: number; oy: number; x: number; y: number
    vx: number; vy: number; size: number; color: string
  }>>([])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = 900
    const H = 78
    canvas.width = W
    canvas.height = H

    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const oc = off.getContext('2d')!

    oc.fillStyle = '#306770'
    oc.beginPath()
    oc.moveTo(28, 58)
    oc.bezierCurveTo(152, 62, 240, 54, 330, 38)
    oc.bezierCurveTo(458, 14, 558, 12, 660, 34)
    oc.bezierCurveTo(742, 52, 786, 65, 826, 46)
    oc.bezierCurveTo(852, 33, 870, 34, 882, 41)
    oc.bezierCurveTo(862, 42, 848, 48, 835, 56)
    oc.bezierCurveTo(791, 78, 706, 73, 598, 60)
    oc.bezierCurveTo(476, 45, 373, 45, 268, 56)
    oc.bezierCurveTo(172, 65, 94, 68, 28, 63)
    oc.closePath()
    oc.fill()

    oc.globalCompositeOperation = 'destination-out'
    oc.strokeStyle = '#000'
    oc.lineCap = 'round'
    oc.lineJoin = 'round'

    oc.lineWidth = 10
    oc.beginPath()
    oc.moveTo(778, 50)
    oc.bezierCurveTo(809, 60, 840, 53, 861, 34)
    oc.bezierCurveTo(876, 20, 864, 15, 840, 25)
    oc.stroke()

    oc.lineWidth = 9
    oc.beginPath()
    oc.moveTo(350, 51)
    oc.bezierCurveTo(464, 38, 560, 40, 661, 55)
    oc.stroke()

    oc.globalCompositeOperation = 'source-over'
    oc.fillStyle = '#306770'
    oc.beginPath()
    oc.moveTo(814, 53)
    oc.bezierCurveTo(840, 57, 862, 51, 882, 41)
    oc.bezierCurveTo(862, 39, 845, 42, 830, 48)
    oc.bezierCurveTo(821, 51, 816, 53, 814, 53)
    oc.closePath()
    oc.fill()

    const px = oc.getImageData(0, 0, W, H).data
    const gap = 4
    const ps: typeof particlesRef.current = []
    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < W; x += gap) {
        const i = (y * W + x) * 4
        if (px[i + 3] < 64) continue
        const b = 0.62 + Math.random() * 0.38
        ps.push({
          ox: x,
          oy: y,
          x,
          y,
          vx: 0,
          vy: 0,
          size: Math.floor(Math.random() * 2) + 1,
          color: `rgb(${Math.floor(48*b)},${Math.floor(103*b)},${Math.floor(112*b)})`,
        })
      }
    }
    particlesRef.current = ps

    const isTouchInteraction = window.matchMedia('(hover: none), (pointer: coarse)').matches
    let resetTimer: ReturnType<typeof window.setTimeout> | null = null

    const resetMouse = () => {
      mouseRef.current.x = -999
      mouseRef.current.y = -999
    }

    const setPointerPosition = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = (e.clientX - rect.left) * (W / rect.width)
      mouseRef.current.y = (e.clientY - rect.top) * (H / rect.height)
    }
    const onMove = (e: PointerEvent) => {
      if (isTouchInteraction || e.pointerType !== 'mouse') return
      setPointerPosition(e)
    }
    const onTap = (e: PointerEvent) => {
      if (!isTouchInteraction) return
      setPointerPosition(e)
      if (resetTimer) window.clearTimeout(resetTimer)
      resetTimer = window.setTimeout(resetMouse, 650)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onTap)
    canvas.addEventListener('pointerleave', resetMouse)

    const animate = () => {
      ctx.clearRect(0, 0, W, H)
      const mouse = mouseRef.current
      for (const p of particlesRef.current) {
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist2 = dx * dx + dy * dy
        if (dist2 > 0 && dist2 < mouse.radius) {
          const force = -mouse.radius / dist2 * 5.5
          const angle = Math.atan2(dy, dx)
          p.vx += force * Math.cos(angle)
          p.vy += force * Math.sin(angle)
        }
        p.x += (p.vx *= 0.9) + (p.ox - p.x) * 0.17
        p.y += (p.vy *= 0.9) + (p.oy - p.y) * 0.17
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (resetTimer) window.clearTimeout(resetTimer)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onTap)
      canvas.removeEventListener('pointerleave', resetMouse)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="group flex h-[78px] w-full items-center justify-center rounded-[18px] transition-all duration-300 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:scale-[1.015]"
      style={{ cursor: 'crosshair' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 78, flexShrink: 0 }}
      />
    </div>
  )
}

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

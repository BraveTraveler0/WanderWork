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

interface StatsPanelProps {
  jobId: number | null
  onClose: () => void
  data?: any
  jobs?: any[]
  onNewJobsClick?: () => void
  onRecruiterContactsClick?: () => void
  isAuthenticated?: boolean
}

const StatsPanel = ({ jobId, data, jobs = [], onNewJobsClick, onRecruiterContactsClick, isAuthenticated = true }: StatsPanelProps) => {
  // Calculate stats from backend data or use sensible defaults
  const allJobs = Array.isArray(jobs) && jobs.length ? jobs : (data?.Jobs ?? [])
  const newJobsCount = allJobs.filter((j: any) => j.hasNewBadge === true).length
  const firstCandidate = Array.isArray(data?.Candidates) ? data!.Candidates[0] : undefined
  const tokensCount = (firstCandidate?.tokenBalance ?? firstCandidate?.tokens ?? 30)
  const recruiterContactsLeft: number = firstCandidate?.recruiterContactsLeft ?? 10
  const hasUploadedResume = !!(firstCandidate?.resume_text?.trim() || firstCandidate?.resumeLink)
  const hasBasicProfile = !!(firstCandidate?.firstName?.trim() && firstCandidate?.targetRoles?.length)
  const canOrder = hasUploadedResume && hasBasicProfile
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
  }
  
  return (
    <div className="flex flex-col gap-4 lg:gap-6 xl:gap-8 w-full pl-2 lg:pl-2 pr-0 min-h-full overflow-visible pt-2 lg:pt-3 xl:pt-4" style={{ fontFamily: 'Manrope' }}>
      <style>{`@keyframes tokenFloat { 0% { opacity: 1; transform: translate(-50%, 0); } 85% { opacity: 1; transform: translate(-50%, -36px); } 100% { opacity: 0; transform: translate(-50%, -72px); } }`}</style>
      {/* Stats - Desktop only */}
      <div className="hidden lg:flex gap-4 xl:gap-6 justify-center">
        <StatCard number={newJobsCount.toString()} label="New Jobs" onClick={onNewJobsClick} clickable />
        <TokenCoinIcon onClick={openTokens} />
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

          const stripDuplicateAboutHeading = (text: string) => {
            return text
              .replace(/^about\s+(.{2,80}?)\s+\1\b\s*/i, '$1 ')
              .trim()
          }

          const stripLeadingPresentationLines = (text: string) => {
            const presentationOnly =
              /^(?:#{1,6}|[-*_]{3,}|(?:\*\*|__|\*|_)?\s*(?:about\s+(?:the\s+role|us|the\s+opportu?nity)|company\s+description|company|description|job\s+details|position|hiring)\s*:?\s*(?:\*\*|__|\*|_)?)$/i
            const lines = text
              .split(/\n+/)
              .map((line) => line.trim())
              .filter(Boolean)
            while (lines.length && presentationOnly.test(lines[0])) {
              lines.shift()
            }
            return lines.join('\n\n').trim()
          }

          const cleanDescriptionText = (value: string) =>
            stripLeadingPresentationLines(stripDuplicateAboutHeading(stripMarkdown(stripJunkMeta(stripHtml(value)))))

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
            const formatted = stripLeadingPresentationLines(addBreaks(desc))
            return isTooShort(formatted) ? fallbackMessage : formatted
          }
          const summary = fromValue((selectedJob as any).summary)
          if (summary) {
            const formatted = stripLeadingPresentationLines(addBreaks(summary))
            return isTooShort(formatted) ? fallbackMessage : formatted
          }
          return fallbackMessage
        })()
        
        const applyUrl = typeof (selectedJob as any).url === 'string' ? (selectedJob as any).url : ''

        // For Wellfound specific job URLs, show a fallback to the company jobs page in case the listing expired.
        // Only applies when the URL points at a specific job (has content after /jobs/),
        // not when it's already the company jobs listing page.
        const wellfoundCompanyUrl = (() => {
          if (!applyUrl.includes('wellfound.com/company/')) return null
          const match = applyUrl.match(/wellfound\.com\/company\/([^/]+)\/jobs\/(.+)/)
          return match ? `https://wellfound.com/company/${match[1]}/jobs` : null
        })()

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

                const matchSkills: string[] = selectedJob.skills?.length > 0
                  ? selectedJob.skills.slice(0, 3)
                  : extractFallbackSkills(selectedJob.title || '', selectedJob.shortDescription || selectedJob.description_short || '', selectedJob.jobType || selectedJob.job_type || '');
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
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    className="w-full sm:w-auto flex items-center justify-center px-5 py-2 rounded-[10px] text-[12px] bg-white whitespace-nowrap flex-shrink-0 transition-all duration-500 hover:bg-[#306770] hover:border-[#306770] hover:text-white"
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} className="w-full sm:flex-1">
                    <button
                      className={`cta-glow w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-[10px] text-[12px] text-white whitespace-nowrap flex-shrink-0 transition-all duration-300${canOrder ? ' hover:scale-105' : ''}`}
                      style={{ background: canOrder ? '#306770' : '#AAAAAA', cursor: canOrder ? 'pointer' : 'not-allowed' }}
                      disabled={!canOrder}
                      onClick={canOrder ? () => setShowCustomRequestModal({
                        jobId: selectedJob.backendId || selectedJob._id || selectedJob.job_code || selectedJob.id,
                        jobTitle: selectedJob.title,
                        company: selectedJob.company,
                        job: selectedJob
                      }) : undefined}
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

const TokenCoinIcon = ({ onClick }: { onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col gap-2 items-center text-center"
    style={{ fontFamily: 'Manrope', cursor: onClick ? 'pointer' : 'default', background: 'transparent' }}
  >
    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F5C842', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(245,200,66,0.35)', transition: 'transform 0.2s', flexShrink: 0 }}
      className="group-hover:scale-105"
    >
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#E0A820', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EDF2F4', opacity: 0.92 }} />
      </div>
    </div>
    <p className="text-[12px]" style={{ color: '#787878' }}>Start Earning Tokens</p>
  </button>
)

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

import { useEffect, useState, useRef } from 'react'
import { X, Check, Zap, ChevronDown, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getPairedRecruiters, sendRecruiterDraft, getRecruiterContactHistory, RecruiterRecord } from '../api/jobseeker.ts'

interface Props {
  candidateId: string
  currentTokens: number
  dailyLimit?: number
  onClose: () => void
  onTokensChanged: (newBalance: number) => void
  company?: string
}

interface SentEntry {
  recruiter: RecruiterRecord
  sentAt: string
}

interface SendNotice {
  kind: 'success' | 'warning' | 'error'
  message: string
}

const DAILY_LIMIT = 10
const TOKENS_PER_EMAIL = 10
const FADE_MS = 500

const SPECIALTY_LABELS: Record<string, string> = {
  tech: 'Tech',
  creative: 'Creative & Design',
  product: 'Product & Project',
  data: 'Data & AI',
  sales: 'Sales & Customer Success',
  operations: 'Operations & HR',
  finance: 'Finance & Accounting',
  business: 'Business',
  healthcare: 'Healthcare',
  legal: 'Legal',
  general: 'General',
}

const SPECIALTY_OPTIONS = [
  'operations',
  'tech',
  'creative',
  'product',
  'data',
  'sales',
  'finance',
  'business',
  'healthcare',
  'legal',
  'general',
]

const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  tech:       { bg: '#EEF4FF', text: '#3B6FD4' },
  creative:   { bg: '#FFF4EE', text: '#C45A1A' },
  product:    { bg: '#F4F0FF', text: '#6546A8' },
  data:       { bg: '#EAF8F8', text: '#237A7A' },
  sales:      { bg: '#FFF7E6', text: '#9A6500' },
  operations: { bg: '#EEF7F1', text: '#287044' },
  finance:    { bg: '#F1F5F9', text: '#41556B' },
  business:   { bg: '#F0FAF4', text: '#2A7A50' },
  healthcare: { bg: '#FFF0F5', text: '#B0386A' },
  legal:      { bg: '#F5F0FF', text: '#6B3AB0' },
  general:    { bg: '#F3F4F6', text: '#555555' },
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

function daysAgoLabel(sentAt: string) {
  const diff = Date.now() - new Date(sentAt).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function RecruiterRow({ r, isSent, isSelected, isDisabled, onClick, fadingOut }: {
  r: RecruiterRecord
  isSent: boolean
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
  fadingOut: boolean
}) {
  const sc = SPECIALTY_COLORS[r.specialty] ?? SPECIALTY_COLORS.general
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="w-full text-left rounded-[14px] border transition-all"
      style={{
        borderColor: isSelected ? '#306770' : '#EFEFEF',
        background: isSelected ? '#F0F8FA' : 'white',
        opacity: (isDisabled && !isSent) || fadingOut ? 0 : 1,
        transform: fadingOut ? 'translateX(24px)' : 'none',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        cursor: isDisabled ? 'default' : 'pointer',
        outline: 'none',
        pointerEvents: fadingOut ? 'none' : undefined,
      }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{
            borderColor: isSelected ? '#306770' : '#DCDCDC',
            background: isSelected ? '#306770' : 'white',
          }}
        >
          {isSelected && <Check size={12} color="white" strokeWidth={3} />}
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0" style={{ background: '#EEF6F7', color: '#306770' }}>
          {initials(r.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-black leading-snug truncate">{r.name}</p>
          <p className="text-[12px] truncate" style={{ color: '#787878' }}>{[r.jobTitle, r.company].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>
            {SPECIALTY_LABELS[r.specialty] ?? r.specialty}
          </span>
        </div>
      </div>
    </button>
  )
}

function SentRow({ r, sentAt }: { r: RecruiterRecord; sentAt: string }) {
  return (
    <div
      className="w-full text-left rounded-[14px] border"
      style={{ borderColor: '#E8F8F2', background: '#FAFAFA' }}
    >
      <div className="flex items-center gap-4 px-5 py-3">
        <div className="w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#C5EEE0', background: '#C5EEE0' }}>
          <Check size={12} color="white" strokeWidth={3} />
        </div>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0" style={{ background: '#F4F4F4', color: '#BBBBBB' }}>
          {initials(r.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold leading-snug truncate" style={{ color: '#BBBBBB' }}>{r.name}</p>
          <p className="text-[12px] truncate" style={{ color: '#CCCCCC' }}>{[r.jobTitle, r.company].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F0F0F0', color: '#CCCCCC' }}>
            {SPECIALTY_LABELS[r.specialty] ?? r.specialty}
          </span>
          <span className="text-[11px]" style={{ color: '#BBBBBB' }}>{daysAgoLabel(sentAt)}</span>
        </div>
      </div>
    </div>
  )
}

export default function RecruiterOutreach({ candidateId, currentTokens, dailyLimit, onClose, onTokensChanged, company }: Props) {
  const effectiveLimit = dailyLimit ?? DAILY_LIMIT
  const [loading, setLoading] = useState(true)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [recruiters, setRecruiters] = useState<RecruiterRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fadingOutIds, setFadingOutIds] = useState<Set<string>>(new Set())
  const [sentList, setSentList] = useState<SentEntry[]>([])
  const [showSent, setShowSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittingCount, setSubmittingCount] = useState(0)
  const [tokens, setTokens] = useState(currentTokens)
  const [contactsLeft, setContactsLeft] = useState(effectiveLimit)
  const [notice, setNotice] = useState<SendNotice | null>(null)
  const submittingRef = useRef(false)
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Load paired recruiters + contact history on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRecruiters([])

    Promise.all([
      getPairedRecruiters(candidateId, 50, company, selectedSpecialty),
      getRecruiterContactHistory(candidateId).catch(() => []),
    ]).then(([{ specialties, recruiters }, contacts]) => {
      if (cancelled) return
      setSpecialties(specialties ?? [])
      // Deduplicate by email client-side as a safety net
      const seenEmails = new Set<string>()
      const unique = (recruiters as RecruiterRecord[]).filter(r => {
        const key = r.email?.toLowerCase().trim()
        if (!key || seenEmails.has(key)) return false
        seenEmails.add(key)
        return true
      })
      setRecruiters(unique)

      // Build draft list from all contact history. Old email_sent records are preserved for history.
      const past: SentEntry[] = (contacts as any[])
        .filter((c) => ['draft_sent', 'email_sent'].includes(c.status) && c.sentAt)
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
        .map((c) => ({
          recruiter: c.recruiterId as RecruiterRecord,
          sentAt: c.sentAt,
        }))
        .filter((e) => e.recruiter?._id)
      setSentList(past)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setNotice({ kind: 'error', message: 'Unable to load recruiters right now. Please try again.' })
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [candidateId, company, selectedSpecialty])

  const handleSpecialtyChange = (specialty: string) => {
    setSelectedIds(new Set())
    setNotice(null)
    setLoading(true)
    setSelectedSpecialty(specialty)
  }

  // Clean up timers on unmount
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout) }, [])

  const sentIds = new Set(sentList.map((e) => e.recruiter._id))
  const visibleRecruiters = recruiters.filter((r) => !sentIds.has(r._id))
  const remaining = Math.max(contactsLeft - selectedIds.size, 0)
  const totalCost = selectedIds.size * TOKENS_PER_EMAIL
  const canAfford = tokens >= totalCost

  const toggleSelect = (id: string) => {
    if (submittingRef.current || sentIds.has(id) || fadingOutIds.has(id)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (remaining > 0) { next.add(id) }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || !canAfford || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmittingCount(selectedIds.size)
    setNotice(null)

    const ids = [...selectedIds]
    let lastBalance = tokens
    let lastContactsLeft = contactsLeft
    const results = await Promise.allSettled(ids.map((id) => sendRecruiterDraft(candidateId, id)))

    const now = new Date().toISOString()
    const succeeded: string[] = []
    const failureMessages: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        succeeded.push(ids[i])
        const value = (r as PromiseFulfilledResult<{ tokensRemaining: number; contactsRemaining?: number }>).value
        lastBalance = Math.min(lastBalance, value.tokensRemaining)
        if (typeof value.contactsRemaining === 'number') {
          lastContactsLeft = Math.min(lastContactsLeft, value.contactsRemaining)
        }
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason || '')
        if (message) failureMessages.push(message)
      }
    })

    // Start fade-out animation for succeeded recruiters
    setFadingOutIds(new Set(succeeded))
    setSelectedIds((prev) => { const next = new Set(prev); succeeded.forEach((id) => next.delete(id)); return next })

    // After animation completes, move to sent list and remove from main list
    const timer = setTimeout(() => {
      const newEntries: SentEntry[] = succeeded
        .map((id) => {
          const rec = recruiters.find((r) => r._id === id)
          return rec ? { recruiter: rec, sentAt: now } : null
        })
        .filter(Boolean) as SentEntry[]

      setSentList((prev) => [...newEntries, ...prev])
      setRecruiters((prev) => prev.filter((recruiter) => !succeeded.includes(recruiter._id)))
      setFadingOutIds(new Set())
      setShowSent(false)
    }, FADE_MS + 100)

    fadeTimers.current.set('submit', timer)
    setTokens(lastBalance)
    setContactsLeft(lastContactsLeft)
    onTokensChanged(lastBalance)
    submittingRef.current = false
    setSubmitting(false)
    setSubmittingCount(0)

    if (succeeded.length > 0 && succeeded.length < ids.length) {
      setNotice({ kind: 'warning', message: `${succeeded.length} of ${ids.length} drafts were sent to your inbox. The sent recruiters were removed; try the remaining recruiter${ids.length - succeeded.length === 1 ? '' : 's'} again.` })
    } else if (succeeded.length === 0) {
      setNotice({ kind: 'error', message: failureMessages[0] || 'No drafts were sent. Please try again.' })
    } else {
      setNotice({ kind: 'success', message: `${succeeded.length} draft${succeeded.length === 1 ? '' : 's'} sent to your inbox. The recruiter${succeeded.length === 1 ? ' has' : 's have'} been removed from this list.` })
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={() => { if (!submitting) onClose() }}>
      <div
        className="bg-white rounded-[20px] w-full max-w-[580px] shadow-[0_30px_90px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
        style={{ fontFamily: 'Manrope', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header */}
        <div style={{ background: 'linear-gradient(135deg, #112e33 0%, #1e5560 55%, #306770 100%)', padding: '22px 24px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -20, left: 50, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          {/* Title row */}
          <div className="flex items-center justify-between" style={{ marginBottom: 10, position: 'relative' }}>
            <div className="flex items-center gap-2.5">
              <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 8, padding: '5px 6px', display: 'flex' }}>
                <Mail size={15} color="#fff" />
              </div>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', fontFamily: 'Manrope, sans-serif' }}>Recruiter Email Drafts</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap size={13} color="#9ecfd6" fill="#9ecfd6" />
                <span style={{ color: '#9ecfd6', fontSize: 12, fontWeight: 700 }}>{tokens} tokens</span>
              </div>
              <button
                aria-label="Close"
                onClick={() => { if (!submitting) onClose() }}
                disabled={submitting}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: submitting ? 'wait' : 'pointer', color: 'rgba(255,255,255,0.7)', flexShrink: 0, opacity: submitting ? 0.5 : 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Specialty tags + tagline */}
          <div className="flex items-center gap-2 flex-wrap" style={{ position: 'relative' }}>
            {specialties.map((s) => (
              <span key={s} style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', color: '#9ecfd6', letterSpacing: '0.4px' }}>
                {SPECIALTY_LABELS[s] ?? s}
              </span>
            ))}
            <span style={{ color: 'rgba(180,215,220,0.75)', fontSize: 11 }}>
              {selectedSpecialty ? 'selected category' : 'matched to your profile'}
            </span>
          </div>
        </div>

        {/* Intro */}
        <div className="px-7 pt-6 pb-4 flex-shrink-0">
          {!company && (
            <div className="mb-4">
              <label htmlFor="recruiter-specialty" className="block text-[12px] font-semibold mb-1.5" style={{ color: '#333' }}>
                Recruiter category
              </label>
              <div className="relative">
                <select
                  id="recruiter-specialty"
                  value={selectedSpecialty}
                  onChange={(e) => handleSpecialtyChange(e.target.value)}
                  disabled={submitting}
                  className="w-full h-11 appearance-none rounded-[8px] border border-[#D9E2E4] bg-white pl-3.5 pr-10 text-[13px] font-medium text-[#26383B] outline-none focus:border-[#306770]"
                >
                  <option value="">Best match for my profile</option>
                  {SPECIALTY_OPTIONS.map((specialty) => (
                    <option key={specialty} value={specialty}>{SPECIALTY_LABELS[specialty]}</option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#306770' }}
                />
              </div>
            </div>
          )}
          <p className="text-[13px] leading-[1.65]" style={{ color: '#555' }}>
            Select recruiters below and we will send personalized draft emails to your inbox. Nothing is sent to recruiters from WanderWork.
          </p>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1.5">
              <Zap size={13} style={{ color: '#306770' }} />
              <span className="text-[12px] font-medium" style={{ color: '#306770' }}>{TOKENS_PER_EMAIL} tokens per draft</span>
            </div>
            <div className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ background: remaining === 0 ? '#FFF0F0' : '#EEF6F7', color: remaining === 0 ? '#C0392B' : '#306770' }}>
              {remaining} of {effectiveLimit} remaining today
            </div>
          </div>
        </div>

        {/* Lists */}
        <div className="overflow-y-auto flex-1 px-7 pb-4 custom-scrollbar">
          {loading && <div className="py-12 text-center text-[14px]" style={{ color: '#787878' }}>Finding recruiters matched to your specialty...</div>}

          {!loading && visibleRecruiters.length === 0 && sentList.length === 0 && (
            <div className="py-12 text-center text-[14px]" style={{ color: '#787878' }}>No new recruiters for drafts right now. Check back soon - we add new leads daily.</div>
          )}

          {/* Recruiters without a prepared draft */}
          {!loading && visibleRecruiters.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {visibleRecruiters.map((r) => (
                <RecruiterRow
                  key={r._id}
                  r={r}
                  isSent={false}
                  isSelected={selectedIds.has(r._id)}
                  isDisabled={!selectedIds.has(r._id) && remaining === 0}
                  fadingOut={fadingOutIds.has(r._id)}
                  onClick={() => toggleSelect(r._id)}
                />
              ))}
            </div>
          )}

          {/* Previously prepared drafts */}
          {!loading && sentList.length > 0 && (
            <div className="mt-5">
              <button
                onClick={() => setShowSent((v) => !v)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <span className="text-[12px] font-semibold" style={{ color: '#AAAAAA' }}>
                  Drafts Sent to Inbox ({sentList.length})
                </span>
                <ChevronDown
                  size={14}
                  style={{ color: '#AAAAAA', transform: showSent ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
                <span className="text-[11px]" style={{ color: '#CCCCCC' }}>saved in your history</span>
              </button>
              {showSent && (
                <div className="flex flex-col gap-2">
                  {sentList.map((e) => (
                    <SentRow key={e.recruiter._id} r={e.recruiter} sentAt={e.sentAt} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t flex-shrink-0" style={{ borderColor: '#F0F0F0', background: 'white' }}>
          {submitting && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-[10px] px-4 py-3 mb-3"
              style={{ background: '#EEF6F7', color: '#255560' }}
            >
              <Loader2 size={18} className="animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold">Preparing {submittingCount} draft{submittingCount === 1 ? '' : 's'} now...</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#52767C' }}>Keep this window open. We’ll confirm when everything reaches your inbox.</p>
              </div>
            </div>
          )}
          {!submitting && notice && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-2.5 rounded-[10px] px-4 py-3 mb-3"
              style={{
                background: notice.kind === 'success' ? '#EAF8F1' : notice.kind === 'warning' ? '#FFF7E6' : '#FFF0F0',
                color: notice.kind === 'success' ? '#287044' : notice.kind === 'warning' ? '#8A5A00' : '#C0392B',
              }}
            >
              {notice.kind === 'success'
                ? <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5" />
                : <AlertCircle size={17} className="flex-shrink-0 mt-0.5" />}
              <p className="text-[12px] font-medium leading-relaxed">{notice.message}</p>
            </div>
          )}
          {selectedIds.size > 0 && !canAfford && (
            <p className="text-center text-[12px] mb-3" style={{ color: '#C0392B' }}>
              Not enough tokens. You need {totalCost} but have {tokens}.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || !canAfford || submitting}
            className="w-full py-3.5 rounded-[12px] text-[14px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: selectedIds.size === 0 ? '#AAAAAA' : '#306770' }}
            onMouseEnter={(e) => { if (selectedIds.size > 0 && canAfford && !submitting) e.currentTarget.style.background = '#255560' }}
            onMouseLeave={(e) => { if (selectedIds.size > 0 && canAfford && !submitting) e.currentTarget.style.background = '#306770' }}
          >
            {submitting
              ? `Preparing ${submittingCount} Draft${submittingCount === 1 ? '' : 's'}...`
              : selectedIds.size === 0
              ? 'Select recruiters for drafts'
              : `Send ${selectedIds.size} Draft${selectedIds.size !== 1 ? 's' : ''} to My Inbox - ${totalCost} tokens`}
          </button>
        </div>
      </div>
    </div>
  )
}

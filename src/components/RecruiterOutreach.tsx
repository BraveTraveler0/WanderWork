import { useEffect, useState, useRef } from 'react'
import { X, Check, Zap, ChevronDown } from 'lucide-react'
import { getPairedRecruiters, sendRecruiterEmail, getRecruiterContactHistory, RecruiterRecord } from '../api/jobseeker.ts'

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

const DAILY_LIMIT = 10
const TOKENS_PER_EMAIL = 10
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const FADE_MS = 500

const SPECIALTY_LABELS: Record<string, string> = {
  tech: 'Tech',
  creative: 'Creative & Design',
  business: 'Business',
  healthcare: 'Healthcare',
  legal: 'Legal',
  general: 'General',
}

const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  tech:       { bg: '#EEF4FF', text: '#3B6FD4' },
  creative:   { bg: '#FFF4EE', text: '#C45A1A' },
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
  const [recruiters, setRecruiters] = useState<RecruiterRecord[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fadingOutIds, setFadingOutIds] = useState<Set<string>>(new Set())
  const [sentList, setSentList] = useState<SentEntry[]>([])
  const [showSent, setShowSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tokens, setTokens] = useState(currentTokens)
  const [errorMsg, setErrorMsg] = useState('')
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Load paired recruiters + contact history on mount
  useEffect(() => {
    let cancelled = false
    const cutoff = Date.now() - NINETY_DAYS_MS

    Promise.all([
      getPairedRecruiters(candidateId, 50, company),
      getRecruiterContactHistory(candidateId).catch(() => []),
    ]).then(([{ specialties, recruiters }, contacts]) => {
      if (cancelled) return
      setSpecialties(specialties ?? [])
      setRecruiters(recruiters)

      // Build sent list from all contact history (email_sent only, no time cutoff)
      const past: SentEntry[] = (contacts as any[])
        .filter((c) => c.status === 'email_sent' && c.sentAt)
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
        .map((c) => ({
          recruiter: c.recruiterId as RecruiterRecord,
          sentAt: c.sentAt,
        }))
        .filter((e) => e.recruiter?._id)
      setSentList(past)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [candidateId, company])

  // Clean up timers on unmount
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout) }, [])

  const sentIds = new Set(sentList.map((e) => e.recruiter._id))
  const visibleRecruiters = recruiters.filter((r) => !sentIds.has(r._id))
  const remaining = effectiveLimit - selectedIds.size
  const totalCost = selectedIds.size * TOKENS_PER_EMAIL
  const canAfford = tokens >= totalCost

  const toggleSelect = (id: string) => {
    if (sentIds.has(id) || fadingOutIds.has(id)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (remaining > 0) { next.add(id) }
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || !canAfford || submitting) return
    setSubmitting(true)
    setErrorMsg('')

    const ids = [...selectedIds]
    let lastBalance = tokens
    const results = await Promise.allSettled(ids.map((id) => sendRecruiterEmail(candidateId, id)))

    const now = new Date().toISOString()
    const succeeded: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        succeeded.push(ids[i])
        lastBalance = (r as PromiseFulfilledResult<{ tokensRemaining: number }>).value.tokensRemaining
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
      setFadingOutIds(new Set())
      setShowSent(true)
    }, FADE_MS + 100)

    fadeTimers.current.set('submit', timer)
    setTokens(lastBalance)
    onTokensChanged(lastBalance)
    setSubmitting(false)

    if (succeeded.length > 0 && succeeded.length < ids.length) {
      setErrorMsg(`${succeeded.length} of ${ids.length} emails sent. Some failed — try again.`)
    } else if (succeeded.length === 0) {
      setErrorMsg('Failed to send emails. Check your token balance and try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="bg-white rounded-[20px] w-full max-w-[580px] shadow-[0_30px_90px_rgba(0,0,0,0.18)] flex flex-col"
        style={{ fontFamily: 'Manrope', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b flex-shrink-0" style={{ borderColor: '#F0F0F0' }}>
          <div>
            <h2 className="text-[18px] font-semibold text-black mb-1">Contact Recruiters</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {specialties.map((s) => {
                const sc = SPECIALTY_COLORS[s] ?? SPECIALTY_COLORS.general
                return (
                  <span key={s} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text }}>
                    {SPECIALTY_LABELS[s] ?? s}
                  </span>
                )
              })}
              <span className="text-[12px]" style={{ color: '#787878' }}>matched to your profile</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Zap size={14} style={{ color: '#306770' }} />
              <span className="text-[13px] font-semibold" style={{ color: '#306770' }}>{tokens} tokens</span>
            </div>
            <button aria-label="Close" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" style={{ color: '#787878' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Intro */}
        <div className="px-7 pt-5 pb-4 flex-shrink-0">
          <p className="text-[13px] leading-[1.65]" style={{ color: '#555' }}>
            Select recruiters below and send them a personalized introduction — one of the fastest ways to get in front of hiring teams.
          </p>
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1.5">
              <Zap size={13} style={{ color: '#306770' }} />
              <span className="text-[12px] font-medium" style={{ color: '#306770' }}>{TOKENS_PER_EMAIL} tokens per email</span>
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
            <div className="py-12 text-center text-[14px]" style={{ color: '#787878' }}>No new recruiters to contact right now. Check back soon — we add new leads daily.</div>
          )}

          {/* Unsent recruiters */}
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

          {/* Previously contacted — collapsible */}
          {!loading && sentList.length > 0 && (
            <div className="mt-5">
              <button
                onClick={() => setShowSent((v) => !v)}
                className="flex items-center gap-2 w-full text-left mb-3"
              >
                <span className="text-[12px] font-semibold" style={{ color: '#AAAAAA' }}>
                  Previously Contacted ({sentList.length})
                </span>
                <ChevronDown
                  size={14}
                  style={{ color: '#AAAAAA', transform: showSent ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
                <span className="text-[11px]" style={{ color: '#CCCCCC' }}>· removed after 90 days</span>
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

          {errorMsg && <p className="mt-4 text-center text-[12px]" style={{ color: '#C0392B' }}>{errorMsg}</p>}
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t flex-shrink-0" style={{ borderColor: '#F0F0F0', background: 'white' }}>
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
              ? 'Sending emails...'
              : selectedIds.size === 0
              ? 'Select recruiters to contact'
              : `Send ${selectedIds.size} Email${selectedIds.size !== 1 ? 's' : ''} · ${totalCost} tokens`}
          </button>
        </div>
      </div>
    </div>
  )
}

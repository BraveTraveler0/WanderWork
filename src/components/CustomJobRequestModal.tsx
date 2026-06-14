import { useState } from 'react'
import { X, FileText, Mail, Users, Check } from 'lucide-react'

export type CustomDocumentFormat = 'pdf' | 'doc'

export interface CustomJobRequestOptions {
  resume: boolean
  coverLetter: boolean
  fileFormat: CustomDocumentFormat
}

interface CustomJobRequestModalProps {
  jobTitle: string
  company: string
  onClose: () => void
  onSubmit: (options: CustomJobRequestOptions) => Promise<any> | any
  currentCredits: number
  initialResume?: boolean
  initialCoverLetter?: boolean
  isAuthenticated?: boolean
  onSignUp?: () => void
  hasRecruiter?: boolean
  onOpenRecruiter?: () => void
}

export default function CustomJobRequestModal({
  jobTitle,
  company,
  onClose,
  onSubmit,
  currentCredits,
  initialResume = false,
  initialCoverLetter = false,
  isAuthenticated = true,
  onSignUp,
  hasRecruiter = false,
  onOpenRecruiter,
}: CustomJobRequestModalProps) {
  const [selectedResume, setSelectedResume] = useState(initialResume)
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(initialCoverLetter)
  const [selectedRecruiter, setSelectedRecruiter] = useState(false)
  const [fileFormat, setFileFormat] = useState<CustomDocumentFormat>('pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const docCost = (selectedResume ? 1 : 0) + (selectedCoverLetter ? 1 : 0)
  const hasDocs = selectedResume || selectedCoverLetter
  const hasSelection = hasDocs || selectedRecruiter
  const canAfford = currentCredits >= docCost

  const handleSubmit = () => {
    if (!hasSelection) return
    if (hasDocs && !canAfford) return

    // If recruiter selected (with or without docs), open recruiter flow after docs
    if (hasDocs) {
      setSubmitting(true)
      setError(null)
      setSuccess(null)
      Promise.resolve(onSubmit({ resume: selectedResume, coverLetter: selectedCoverLetter, fileFormat }))
        .then((result) => {
          const deliveredTo = result?.emailDelivery?.sent ? result?.emailDelivery?.to : ''
          setSuccess(deliveredTo
            ? `Materials sent to ${deliveredTo}.`
            : 'Materials saved to Messages.'
          )
          setTimeout(() => {
            onClose()
            if (selectedRecruiter) onOpenRecruiter?.()
          }, 900)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to submit request')
        })
        .finally(() => setSubmitting(false))
    } else if (selectedRecruiter) {
      onClose()
      onOpenRecruiter?.()
    }
  }

  const OptionRow = ({
    selected,
    onToggle,
    icon,
    label,
    description,
    cost,
    disabled = false,
  }: {
    selected: boolean
    onToggle: () => void
    icon: React.ReactNode
    label: string
    description: string
    cost: string
    disabled?: boolean
  }) => (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="w-full text-left rounded-[14px] border transition-all"
      style={{
        borderColor: selected ? '#306770' : '#EFEFEF',
        background: selected ? '#F0F8FA' : 'white',
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none',
      }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="w-5 h-5 rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150"
          style={{
            borderColor: selected ? '#306770' : '#DCDCDC',
            background: selected ? '#306770' : 'white',
          }}
        >
          {selected && <Check size={12} color="white" strokeWidth={3} />}
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: selected ? '#E6F4F6' : '#F4F4F4' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-black leading-snug">{label}</p>
          <p className="text-[12px] leading-snug mt-0.5" style={{ color: '#787878' }}>{description}</p>
        </div>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{
            background: selected ? '#36BF8F20' : '#F3F4F6',
            color: selected ? '#36BF8F' : '#9CA3AF',
          }}
        >
          {cost}
        </span>
      </div>
    </button>
  )

  const submitLabel = () => {
    if (submitting) return 'Submitting...'
    if (!hasSelection) return 'Select an Option'
    if (hasDocs && !canAfford) return 'Not Enough Credits'
    if (selectedRecruiter && !hasDocs) return 'Find Recruiters'
    if (selectedRecruiter && hasDocs) return 'Submit + Find Recruiters'
    return 'Submit Request'
  }

  const canSubmit = hasSelection && (!hasDocs || canAfford) && !submitting

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] w-full max-w-[480px] max-h-[calc(100vh-32px)] overflow-y-auto shadow-[0_30px_90px_rgba(0,0,0,0.16)] relative"
        style={{ fontFamily: 'Manrope' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex-1 pr-3">
            <h2 className="text-[20px] font-semibold text-black leading-tight mb-1">
              Application Materials
            </h2>
            <p className="text-[13px]" style={{ color: '#787878' }}>
              {jobTitle} at {company}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: '#F0F8FA' }}
            >
              <span className="text-[11px] font-medium" style={{ color: '#306770' }}>Credits</span>
              <span className="text-[13px] font-semibold" style={{ color: '#306770' }}>{currentCredits}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              style={{ background: '#F5F5F5' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#E5E5E5' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F5F5' }}
            >
              <X size={16} style={{ color: '#787878' }} />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6">
          {error && (
            <div className="mb-4 rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-[10px] border px-3 py-2 text-[12px]" style={{ borderColor: '#86EFAC', color: '#166534', background: '#DCFCE7' }}>
              {success}
            </div>
          )}

          {/* Document options */}
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#9CA3AF' }}>
            AI Documents
          </p>
          <div className="flex flex-col gap-2 mb-4">
            <OptionRow
              selected={selectedResume}
              onToggle={() => setSelectedResume((v) => !v)}
              icon={<FileText size={16} style={{ color: selectedResume ? '#306770' : '#9CA3AF' }} />}
              label="Custom Resume"
              description="AI-optimized for this specific role"
              cost="1 Credit"
            />
            <OptionRow
              selected={selectedCoverLetter}
              onToggle={() => setSelectedCoverLetter((v) => !v)}
              icon={<Mail size={16} style={{ color: selectedCoverLetter ? '#306770' : '#9CA3AF' }} />}
              label="Cover Letter"
              description="Personalized to highlight your fit"
              cost="1 Credit"
            />
          </div>

          {/* Recruiter option — only when recruiter contact is available */}
          {hasRecruiter && (
            <>
              <div className="flex items-center gap-3 mb-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                  Recruiter Outreach
                </p>
                <div className="flex-1 h-px" style={{ background: '#EFEFEF' }} />
              </div>
              <div className="mb-4">
                <OptionRow
                  selected={selectedRecruiter}
                  onToggle={() => setSelectedRecruiter((v) => !v)}
                  icon={<Users size={16} style={{ color: selectedRecruiter ? '#306770' : '#9CA3AF' }} />}
                  label="Contact Recruiters"
                  description={`Email matched recruiters at ${company}`}
                  cost="10 Tokens"
                />
              </div>
            </>
          )}

          {/* File format — only when docs are selected */}
          {hasDocs && (
            <div
              className="rounded-[14px] border p-4 mb-4"
              style={{ borderColor: '#EFEFEF', background: '#FAFAFA' }}
            >
              <p className="text-[12px] font-semibold mb-2.5 text-black">Extra file format</p>
              <div className="grid grid-cols-2 gap-2">
                {(['pdf', 'doc'] as const).map((fmt) => {
                  const checked = fileFormat === fmt
                  return (
                    <label
                      key={fmt}
                      className="flex items-center gap-3 rounded-[10px] border px-4 py-2.5 cursor-pointer transition-all"
                      style={{
                        borderColor: checked ? '#306770' : '#E5E7EB',
                        background: checked ? '#F0F8FA' : 'white',
                      }}
                    >
                      <input
                        type="radio"
                        name="custom-document-format"
                        value={fmt}
                        checked={checked}
                        onChange={() => setFileFormat(fmt)}
                        className="sr-only"
                      />
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: checked ? '#306770' : '#C8CED6',
                          background: checked ? '#306770' : 'white',
                        }}
                      >
                        {checked && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                      </div>
                      <span className="text-[13px] font-semibold text-black">{fmt.toUpperCase()}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] mt-2" style={{ color: '#9CA3AF' }}>
                RTF is always included.
              </p>
            </div>
          )}

          {/* Cost row */}
          {hasDocs && (
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[13px]" style={{ color: '#787878' }}>Document cost</span>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold" style={{ color: '#306770' }}>
                  {docCost} {docCost === 1 ? 'Credit' : 'Credits'}
                </span>
                {!canAfford && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    Insufficient
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Delivery note */}
          {hasDocs && (
            <p className="text-[12px] text-center mb-4" style={{ color: '#9CA3AF' }}>
              Saved to Messages and emailed in RTF + {fileFormat.toUpperCase()}.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-[12px] text-[14px] font-medium transition-colors"
              style={{ border: '1px solid #E5E7EB', color: '#787878', background: 'white' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
            >
              Cancel
            </button>
            {!isAuthenticated ? (
              <button
                onClick={() => { onClose(); onSignUp?.() }}
                className="flex-1 px-4 py-3 rounded-[12px] text-[14px] text-white font-medium"
                style={{ background: '#306770' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#255860' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#306770' }}
              >
                Sign Up
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 px-4 py-3 rounded-[12px] text-[14px] text-white font-medium disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                style={{
                  background: canSubmit ? '#306770' : '#D1D5DB',
                }}
                onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = '#255860' }}
                onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = '#306770' }}
              >
                {submitting && (
                  <span
                    className="animate-spin flex-shrink-0"
                    style={{
                      width: 14, height: 14,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.35)',
                      borderTopColor: '#fff',
                      display: 'inline-block',
                    }}
                  />
                )}
                {submitLabel()}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

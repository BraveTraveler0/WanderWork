import { useState } from 'react'
import { X, FileText, Mail, Users } from 'lucide-react'

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
}

export default function CustomJobRequestModal({
  jobTitle,
  company,
  onClose,
  onSubmit,
  currentCredits,
  initialResume = false,
  initialCoverLetter = false
}: CustomJobRequestModalProps) {
  const [selectedResume, setSelectedResume] = useState(initialResume)
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(initialCoverLetter)
  const [fileFormat, setFileFormat] = useState<CustomDocumentFormat>('pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const totalCost = (selectedResume ? 1 : 0) + (selectedCoverLetter ? 1 : 0)
  const canAfford = currentCredits >= totalCost
  const hasSelection = selectedResume || selectedCoverLetter

  const handleSubmit = () => {
    if (!hasSelection || !canAfford) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    Promise.resolve(onSubmit({ resume: selectedResume, coverLetter: selectedCoverLetter, fileFormat }))
      .then((result) => {
        const deliveredTo = result?.emailDelivery?.sent ? result?.emailDelivery?.to : ''
        setSuccess(deliveredTo
          ? `Request submitted successfully. We emailed your materials to ${deliveredTo}.`
          : 'Request submitted successfully. Your materials were saved to Messages.'
        )
        setTimeout(() => {
          onClose()
        }, 1200)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to submit request')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] w-full max-w-[520px] max-h-[calc(100vh-32px)] overflow-y-auto shadow-[0_30px_90px_rgba(0,0,0,0.16)] p-6 sm:p-8 relative"
        style={{ fontFamily: 'Manrope' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 pr-4">
            <h2 className="text-[20px] sm:text-[24px] font-semibold text-black mb-2">
              Customize Your Application
            </h2>
            <p className="text-[13px]" style={{ color: '#787878' }}>
              {jobTitle} at {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#F5F5F5' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#E5E5E5' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F5F5' }}
          >
            <X size={20} style={{ color: '#787878' }} />
          </button>
        </div>

        {/* Credits Display */}
        <div
          className="flex items-center justify-between p-4 rounded-[12px] mb-6"
          style={{ background: '#F8F9FA', border: '1px solid #E5E7EB' }}
        >
          <span className="text-[13px]" style={{ color: '#787878' }}>
            Available Credits
          </span>
          <span className="text-[18px] font-semibold" style={{ color: '#306770' }}>
            {currentCredits}
          </span>
        </div>

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

        {/* Options */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Resume Option */}
          <button
            onClick={() => setSelectedResume(!selectedResume)}
            className="flex items-start gap-4 p-4 rounded-[12px] border-2 transition-all cursor-pointer"
            style={{
              borderColor: selectedResume ? '#306770' : '#E5E7EB',
              background: selectedResume ? '#30677005' : 'white'
            }}
          >
            <div className="flex-shrink-0 mt-1">
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: selectedResume ? '#306770' : '#D1D5DB',
                  background: selectedResume ? '#306770' : 'white'
                }}
              >
                {selectedResume && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={18} style={{ color: '#306770' }} />
                <span className="text-[15px] font-semibold text-black">
                  Custom Resume
                </span>
                <span
                  className="ml-auto px-2 py-0.5 rounded-[6px] text-[11px] font-medium"
                  style={{ background: '#36BF8F20', color: '#36BF8F' }}
                >
                  1 Credit
                </span>
              </div>
              <p className="text-[12px]" style={{ color: '#787878' }}>
                AI-optimized resume tailored to this specific job posting
              </p>
            </div>
          </button>

          {/* Cover Letter Option */}
          <button
            onClick={() => setSelectedCoverLetter(!selectedCoverLetter)}
            className="flex items-start gap-4 p-4 rounded-[12px] border-2 transition-all cursor-pointer"
            style={{
              borderColor: selectedCoverLetter ? '#306770' : '#E5E7EB',
              background: selectedCoverLetter ? '#30677005' : 'white'
            }}
          >
            <div className="flex-shrink-0 mt-1">
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: selectedCoverLetter ? '#306770' : '#D1D5DB',
                  background: selectedCoverLetter ? '#306770' : 'white'
                }}
              >
                {selectedCoverLetter && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Mail size={18} style={{ color: '#306770' }} />
                <span className="text-[15px] font-semibold text-black">
                  Custom Cover Letter
                </span>
                <span
                  className="ml-auto px-2 py-0.5 rounded-[6px] text-[11px] font-medium"
                  style={{ background: '#36BF8F20', color: '#36BF8F' }}
                >
                  1 Credit
                </span>
              </div>
              <p className="text-[12px]" style={{ color: '#787878' }}>
                Personalized cover letter highlighting your relevant experience
              </p>
            </div>
          </button>

          {/* Contact & Email (Coming Soon) */}
          <div
            className="flex items-start gap-4 p-4 rounded-[12px] border-2 opacity-50 cursor-not-allowed"
            style={{
              borderColor: '#E5E7EB',
              background: '#F9FAFB'
            }}
          >
            <div className="flex-shrink-0 mt-1">
              <div
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: '#D1D5DB', background: 'white' }}
              />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Users size={18} style={{ color: '#9CA3AF' }} />
                <span className="text-[15px] font-semibold" style={{ color: '#9CA3AF' }}>
                  Find Contact & Send Email
                </span>
                <span
                  className="ml-auto px-2 py-0.5 rounded-[6px] text-[11px] font-medium"
                  style={{ background: '#F3F4F6', color: '#9CA3AF' }}
                >
                  1 Credit
                </span>
              </div>
              <p className="text-[12px]" style={{ color: '#9CA3AF' }}>
                Coming soon: Direct outreach to hiring managers
              </p>
            </div>
          </div>
        </div>

        {/* Format Choice */}
        <div
          className="mb-6 rounded-[12px] border p-4 transition-all"
          style={{
            borderColor: hasSelection ? '#D7E4E7' : '#E5E7EB',
            background: hasSelection ? '#F8FBFC' : '#F9FAFB',
            opacity: hasSelection ? 1 : 0.55,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[13px] font-semibold text-black">Extra file format</p>
              <p className="text-[11px]" style={{ color: '#787878' }}>
                RTF is always included. Choose one extra format.
              </p>
            </div>
            {!hasSelection && (
              <span className="text-[11px] font-medium" style={{ color: '#9CA3AF' }}>
                Select a material first
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'pdf', label: 'PDF' },
              { value: 'doc', label: 'DOC' },
            ] as const).map((option) => {
              const checked = fileFormat === option.value
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-[10px] border px-3 py-2 transition-all"
                  style={{
                    borderColor: hasSelection && checked ? '#306770' : '#D1D5DB',
                    background: hasSelection && checked ? '#FFFFFF' : '#F3F4F6',
                    color: hasSelection ? '#1A1A2E' : '#9CA3AF',
                    cursor: hasSelection ? 'pointer' : 'not-allowed',
                  }}
                >
                  <input
                    type="radio"
                    name="custom-document-format"
                    value={option.value}
                    checked={checked}
                    disabled={!hasSelection}
                    onChange={() => setFileFormat(option.value)}
                    className="sr-only"
                  />
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: hasSelection && checked ? '#306770' : '#C8CED6',
                      background: hasSelection && checked ? '#306770' : '#FFFFFF',
                    }}
                  >
                    {checked && hasSelection && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-[13px] font-semibold">{option.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Cost Summary */}
        {hasSelection && (
          <div
            className="flex items-center justify-between p-3 rounded-[10px] mb-6"
            style={{ background: '#F8F9FA' }}
          >
            <span className="text-[13px] font-medium" style={{ color: '#787878' }}>
              Total Cost
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[16px] font-semibold" style={{ color: '#306770' }}>
                {totalCost} {totalCost === 1 ? 'Credit' : 'Credits'}
              </span>
              {!canAfford && (
                <span className="text-[11px] font-medium px-2 py-1 rounded-[6px]" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  Insufficient Credits
                </span>
              )}
            </div>
          </div>
        )}

        {/* Note — above the submit button */}
        <p className="text-[13px] text-center mb-3 font-medium" style={{ color: '#306770' }}>
          Your materials will be saved to your Messaging tab and sent to your email in RTF plus {fileFormat.toUpperCase()}.
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-[12px] text-[14px] border-2 transition-colors font-medium"
            style={{ borderColor: '#E5E7EB', color: '#787878', background: 'white' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasSelection || !canAfford || submitting}
            className="flex-1 px-4 py-3 rounded-[12px] text-[14px] text-white transition-all font-medium disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: hasSelection && canAfford ? '#306770' : '#D1D5DB',
              opacity: hasSelection && canAfford ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (hasSelection && canAfford && !submitting) {
                e.currentTarget.style.background = '#255860'
              }
            }}
            onMouseLeave={(e) => {
              if (hasSelection && canAfford) {
                e.currentTarget.style.background = '#306770'
              }
            }}
          >
            {submitting && (
              <span
                className="animate-spin"
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: '#ffffff',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
            )}
            {submitting ? 'Submitting...' : !hasSelection ? 'Select an Option' : !canAfford ? 'Not Enough Credits' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

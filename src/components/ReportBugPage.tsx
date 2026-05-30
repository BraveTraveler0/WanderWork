import { useState } from 'react'
import { ArrowLeft, Bug, Send, CheckCircle } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://wanderwork-backend-server.onrender.com'

interface ReportBugPageProps {
  onBack: () => void
  userEmail?: string
}

export default function ReportBugPage({ onBack, userEmail }: ReportBugPageProps) {
  const [bug, setBug] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bug.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/users/bugreport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail || '', bug: bug.trim() }),
      })
      if (!res.ok) {
        let serverMsg = `Server error ${res.status}`
        try { const j = await res.json(); if (j?.message) serverMsg = j.message } catch {}
        console.error('[BugReport] failed:', res.status, serverMsg)
        throw new Error(serverMsg)
      }
      setSubmitted(true)
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      console.error('[BugReport] catch:', msg)
      setError(`We had trouble sending your report. (${msg})`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145.48deg, #F9FAFB 0%, #F0F2F5 100%)', fontFamily: 'Manrope, sans-serif' }}>
      <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-10">

        <button
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'none', border: '1px solid #DCDCDC', cursor: 'pointer', color: '#306770', fontSize: 13, fontWeight: 600, marginBottom: 28 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EEF4F5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <ArrowLeft size={15} /> Dashboard
        </button>

        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: '40px 40px',
            boxShadow: '0px 4px 24px rgba(48,103,112,0.08)',
            border: '1px solid #E4EEF0',
          }}
        >
          {submitted ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '24px 0' }}>
              <CheckCircle size={52} color="#36BF8F" strokeWidth={1.5} />
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#306770', margin: 0 }}>Got it, thank you!</h2>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, maxWidth: 420, margin: 0 }}>
                We really appreciate you taking the time to let us know. Your report has been sent to our team and we will look into it as soon as possible. Check your messages for a confirmation.
              </p>
              <button
                onClick={onBack}
                style={{ marginTop: 8, padding: '10px 28px', borderRadius: 10, border: 'none', background: '#306770', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#255860')}
                onMouseLeave={e => (e.currentTarget.style.background = '#306770')}
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEF6F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bug size={20} color="#306770" />
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#306770', margin: 0 }}>Report a Bug</h1>
              </div>

              <p style={{ fontSize: 14, color: '#787878', lineHeight: 1.7, marginBottom: 28, marginTop: 4 }}>
                WanderWork is still in beta, so we are actively working through everything and we genuinely appreciate your patience. We are happy to fix whatever issues come up as quickly as possible. Our team is small, but we take every report seriously and will get back to you within 24 to 48 hours.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#306770', marginBottom: 8 }}>
                    What happened?
                  </label>
                  <textarea
                    value={bug}
                    onChange={e => setBug(e.target.value)}
                    placeholder="Describe what you were doing, what you expected to happen, and what actually happened instead. The more detail the better."
                    required
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: '1.5px solid #DCDCDC',
                      fontSize: 14,
                      fontFamily: 'Manrope, sans-serif',
                      color: '#1A1A2E',
                      resize: 'vertical',
                      outline: 'none',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#306770')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#DCDCDC')}
                  />
                </div>

                {error && (
                  <p style={{ fontSize: 13, color: '#E05252', background: '#FFF5F5', padding: '10px 14px', borderRadius: 8, margin: 0 }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !bug.trim()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '13px 28px',
                    borderRadius: 12,
                    border: 'none',
                    background: loading || !bug.trim() ? '#C8DEDE' : '#306770',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'Manrope',
                    cursor: loading || !bug.trim() ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                    alignSelf: 'flex-start',
                  }}
                  onMouseEnter={e => { if (!loading && bug.trim()) e.currentTarget.style.background = '#255860' }}
                  onMouseLeave={e => { if (!loading && bug.trim()) e.currentTarget.style.background = '#306770' }}
                >
                  <Send size={15} />
                  {loading ? 'Sending...' : 'Send Report'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

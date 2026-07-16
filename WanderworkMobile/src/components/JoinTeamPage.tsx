import { useState } from 'react'
import { ArrowLeft, Users, Send, CheckCircle } from 'lucide-react'
import { API_BASE_URL } from '../api/config'

const API_BASE = API_BASE_URL

interface JoinTeamPageProps {
  onBack: () => void
}

const ROLES = ['Recruiter', 'Helpdesk / Support', 'Marketer']

export default function JoinTeamPage({ onBack }: JoinTeamPageProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim() && email.trim() && role

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/users/jointeam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role, message: message.trim() }),
      })
      if (!res.ok) {
        let msg = `Server error ${res.status}`
        try { const j = await res.json(); if (j?.message) msg = j.message } catch {}
        throw new Error(msg)
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(`Something went wrong. (${err?.message || 'Unknown error'})`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen safe-area-top" style={{ background: 'linear-gradient(145.48deg, #F9FAFB 0%, #F0F2F5 100%)', fontFamily: 'Manrope, sans-serif' }}>
      <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-10">

        <button
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'none', border: '1px solid #DCDCDC', cursor: 'pointer', color: '#306770', fontSize: 13, fontWeight: 600, marginBottom: 28 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EEF4F5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <ArrowLeft size={15} /> Dashboard
        </button>

        <div style={{ background: '#fff', borderRadius: 20, padding: '40px 40px', boxShadow: '0px 4px 24px rgba(48,103,112,0.08)', border: '1px solid #E4EEF0' }}>
          {submitted ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '24px 0' }}>
              <CheckCircle size={52} color="#36BF8F" strokeWidth={1.5} />
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#306770', margin: 0 }}>We'll be in touch!</h2>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, maxWidth: 420, margin: 0 }}>
                Thanks for your interest in joining WanderWork. We read every application personally and will reach out if there's a fit. Welcome to the journey.
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
                  <Users size={20} color="#306770" />
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#306770', margin: 0 }}>Join Our Team</h1>
              </div>

              <p style={{ fontSize: 14, color: '#787878', lineHeight: 1.7, marginBottom: 28, marginTop: 4 }}>
                WanderWork is a small startup growing fast. We are building a long-term team of people who believe in what we are doing. Right now we are not paying, but that is changing soon and we want people who are in it from the beginning. If that sounds like you, we would love to hear from you.
              </p>

              <div style={{ background: '#F0F7F8', borderRadius: 12, padding: '14px 18px', marginBottom: 28, fontSize: 13, color: '#306770', lineHeight: 1.6 }}>
                <strong>Currently looking for:</strong> Recruiters, Helpdesk / Support, and Marketers.
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#306770', marginBottom: 8 }}>Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #DCDCDC', fontSize: 14, fontFamily: 'Manrope', color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#306770')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#DCDCDC')}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#306770', marginBottom: 8 }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #DCDCDC', fontSize: 14, fontFamily: 'Manrope', color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => (e.currentTarget.style.borderColor = '#306770')}
                      onBlur={e => (e.currentTarget.style.borderColor = '#DCDCDC')}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#306770', marginBottom: 10 }}>Which role interests you?</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {ROLES.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 10,
                          border: `1.5px solid ${role === r ? '#306770' : '#DCDCDC'}`,
                          background: role === r ? '#EEF6F7' : 'white',
                          color: role === r ? '#306770' : '#787878',
                          fontSize: 13,
                          fontWeight: role === r ? 700 : 500,
                          fontFamily: 'Manrope',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#306770', marginBottom: 8 }}>Why do you want to join? <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span></label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Tell us a bit about yourself and why WanderWork excites you."
                    rows={5}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #DCDCDC', fontSize: 14, fontFamily: 'Manrope', color: '#1A1A2E', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#306770')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#DCDCDC')}
                  />
                </div>

                {error && (
                  <p style={{ fontSize: 13, color: '#E05252', background: '#FFF5F5', padding: '10px 14px', borderRadius: 8, margin: 0 }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '13px 28px', borderRadius: 12, border: 'none',
                    background: loading || !canSubmit ? '#C8DEDE' : '#306770',
                    color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope',
                    cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s', alignSelf: 'flex-start',
                  }}
                  onMouseEnter={e => { if (!loading && canSubmit) e.currentTarget.style.background = '#255860' }}
                  onMouseLeave={e => { if (!loading && canSubmit) e.currentTarget.style.background = '#306770' }}
                >
                  <Send size={15} />
                  {loading ? 'Sending...' : 'Send Application'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

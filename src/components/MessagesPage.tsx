import { useEffect, useState } from 'react'
import { ArrowLeft, Search, FileText, Mail } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://application-server-cwqu.onrender.com'

interface Application {
  _id: string
  jobTitle: string
  company: string
  preparedAt: string
  resume: any
  coverLetter: string
  status: string
}

const SEEN_KEY = 'ww_seen_applications'

function getSeenIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}

function markAllSeen(ids: string[]) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids))
}

export function getUnseenCount(applications: Application[]): number {
  const seen = getSeenIds()
  return applications.filter(a => !seen.has(a._id)).length
}

const MessagesPage = ({
  onBack,
  email,
  onGoToProfile,
  inline,
}: {
  onBack: () => void
  email: string
  onGoToProfile?: () => void
  inline?: boolean
}) => {
  const [applications, setApplications] = useState<Application[]>([])
  const [selected, setSelected] = useState<Application | null>(null)
  const [tab, setTab] = useState<'coverLetter' | 'resume'>('coverLetter')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!email) return
    setLoading(true)
    fetch(`${API_BASE}/jobseeker/application?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then((data: Application[]) => {
        const seenBefore = getSeenIds()
        setNewIds(new Set(data.filter(a => !seenBefore.has(a._id)).map(a => a._id)))
        setApplications(data)
        if (data.length) setSelected(data[0])
        markAllSeen(data.map(a => a._id))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [email])

  const filtered = applications.filter(a =>
    `${a.jobTitle} ${a.company}`.toLowerCase().includes(search.toLowerCase())
  )

  const resumeText = typeof selected?.resume === 'string'
    ? selected.resume
    : selected?.resume?.text || selected?.resume?.content || selected?.resume?.resume_text || JSON.stringify(selected?.resume || '', null, 2)

  const outerStyle = inline
    ? { display: 'flex', flexDirection: 'column' as const, flex: 1, minHeight: 0, fontFamily: 'Manrope' }
    : { minHeight: '100vh', background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)', fontFamily: 'Manrope' }

  const contentHeight = inline ? { flex: 1, minHeight: 0 } : { height: 'calc(100vh - 90px)' }

  return (
    <div style={outerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: inline ? '16px 0 0' : '24px 32px 0', marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'none', border: '1px solid #DCDCDC', cursor: 'pointer', color: '#306770', fontSize: 13, fontWeight: 600 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EEF4F5')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <ArrowLeft size={15} /> Dashboard
        </button>
        <h1 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 22, color: '#306770', margin: 0 }}>Messages</h1>
      </div>

      <div style={{ display: 'flex', gap: 20, padding: inline ? '0 0 16px' : '0 32px 40px', ...contentHeight }}>
        {/* Left: application list */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search messages..."
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid #DCDCDC', fontSize: 13, fontFamily: 'Manrope', outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#1A1A2E' }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && (
              <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Loading...</p>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 40, padding: '0 12px', gap: 10 }}>
                <p style={{ color: '#306770', fontSize: 13, fontWeight: 700, margin: 0 }}>No documents yet.</p>
                <p style={{ color: '#787878', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                  Complete your profile and upload a resume to get matched to jobs and receive AI-generated cover letters.
                </p>
                {onGoToProfile && (
                  <button
                    onClick={onGoToProfile}
                    style={{ marginTop: 4, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#306770', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#255860')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#306770')}
                  >
                    Go to Profile
                  </button>
                )}
              </div>
            )}
            {filtered.map(app => {
              const isNew = newIds.has(app._id)
              return (
                <button
                  key={app._id}
                  onClick={() => { setSelected(app); setTab('coverLetter') }}
                  style={{
                    position: 'relative', textAlign: 'left', padding: '14px 16px', borderRadius: 12,
                    border: selected?._id === app._id ? '1.5px solid #63B08D' : '1.5px solid #E4E4E4',
                    background: selected?._id === app._id ? '#F0FAF5' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {isNew && (
                    <span style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#36BF8F', display: 'inline-block' }} />
                  )}
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#306770', margin: '0 0 2px', paddingRight: isNew ? 16 : 0 }}>{app.jobTitle || 'Untitled Role'}</p>
                  <p style={{ fontSize: 12, color: '#787878', margin: '0 0 6px' }}>{app.company}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {app.coverLetter && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#306770', background: '#EEF4F5', borderRadius: 6, padding: '2px 7px' }}>
                        <Mail size={10} /> Cover Letter
                      </span>
                    )}
                    {app.resume && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#36BF8F', background: '#F0FAF5', borderRadius: 6, padding: '2px 7px' }}>
                        <FileText size={10} /> Resume
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>
                    {app.preparedAt ? new Date(app.preparedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: document viewer */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 18, border: '1px solid #E4E4E4', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 40px', textAlign: 'center' }}>
              <p style={{ color: '#306770', fontSize: 15, fontWeight: 700, margin: 0 }}>No documents here yet.</p>
              <p style={{ color: '#787878', fontSize: 13, lineHeight: 1.7, margin: 0 }}>Order a resume or cover letter and it will be stored here for you to view any time.</p>
            </div>
          ) : (
            <>
              {/* Doc header */}
              <div style={{ padding: '20px 28px 0', borderBottom: '1px solid #F0F0F0' }}>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#306770', margin: '0 0 2px' }}>{selected.jobTitle} at {selected.company}</p>
                <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 14px' }}>
                  {selected.preparedAt ? new Date(selected.preparedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                </p>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0 }}>
                  {(['coverLetter', 'resume'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      style={{
                        padding: '8px 20px', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope',
                        border: 'none', background: 'none', cursor: 'pointer',
                        borderBottom: tab === t ? '2px solid #306770' : '2px solid transparent',
                        color: tab === t ? '#306770' : '#787878',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t === 'coverLetter' ? 'Cover Letter' : 'Resume'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Doc content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                {tab === 'coverLetter' ? (
                  selected.coverLetter
                    ? <p style={{ fontSize: 14, lineHeight: 1.8, color: '#1A1A2E', whiteSpace: 'pre-wrap' }}>{selected.coverLetter}</p>
                    : <p style={{ color: '#aaa', fontSize: 14 }}>No cover letter for this application.</p>
                ) : (
                  resumeText
                    ? <p style={{ fontSize: 14, lineHeight: 1.8, color: '#1A1A2E', whiteSpace: 'pre-wrap' }}>{resumeText}</p>
                    : <p style={{ color: '#aaa', fontSize: 14 }}>No resume for this application.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MessagesPage

import { useState, useRef } from 'react'
import { ArrowLeft, MapPin, Link2, Briefcase, GraduationCap, Wrench, User, Upload, Plus, Minus, X } from 'lucide-react'
import type { Candidate } from '../api/jobseeker.ts'
import { uploadCandidateResume, updateCandidateSkills } from '../api/jobseeker.ts'
import { API_BASE_URL } from '../api/config'

const API_BASE = API_BASE_URL

interface ExperienceEntry {
  title: string
  company: string
  type?: string
  dates?: string
  location?: string
  description?: string
}

interface EducationEntry {
  school: string
  degree?: string
  years?: string
  description?: string
}

function parseExperience(text: string): ExperienceEntry[] {
  if (!text || typeof text !== 'string' || !text.trim()) return []
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  const dateRe = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return null
    const entry: ExperienceEntry = { title: lines[0], company: '' }
    const rest = lines.slice(1)
    for (const line of rest) {
      if (!entry.company && !dateRe.test(line.slice(0, 6))) {
        const parts = line.split(/\s*(?:\u00b7|\u00c2\u00b7|\|| - )\s*/).map((p) => p.trim())
        entry.company = parts[0]
        if (parts[1]) entry.type = parts[1]
        continue
      }
      if (!entry.dates && dateRe.test(line)) {
        entry.dates = line
        continue
      }
      entry.description = entry.description ? `${entry.description}\n${line}` : line
    }
    return entry
  }).filter(Boolean) as ExperienceEntry[]
}

function parseEducation(text: string): EducationEntry[] {
  if (!text || typeof text !== 'string' || !text.trim()) return []
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  const yearRe = /\b\d{4}\b/
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return null
    const entry: EducationEntry = { school: lines[0] }
    const rest = lines.slice(1)
    for (const line of rest) {
      if (!entry.years && yearRe.test(line) && line.length < 30) {
        entry.years = line
        continue
      }
      if (!entry.degree) {
        entry.degree = line
        continue
      }
      entry.description = entry.description ? `${entry.description}\n${line}` : line
    }
    return entry
  }).filter(Boolean) as EducationEntry[]
}

function extractSummary(resumeText: string): string {
  if (!resumeText || typeof resumeText !== 'string') return ''
  const lines = resumeText.split(/\r?\n/)
  const summaryHeadings = /^(summary|professional summary|objective|profile|about me?|overview)\s*[:\-]?\s*$/i
  const sectionHeadings = /^(experience|work|employment|education|skills|technical|projects|certifications|references|awards)\s*[:\-]?\s*$/i
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (summaryHeadings.test(lines[i].trim())) { start = i + 1; break }
  }
  if (start < 0) return ''
  const out: string[] = []
  for (let i = start; i < lines.length; i++) {
    if (out.length > 0 && sectionHeadings.test(lines[i].trim())) break
    out.push(lines[i])
  }
  return out.join('\n').trim()
}

function toTextArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.flatMap((item) => toTextArray(item)).map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === 'object') {
    const item = value as any
    const text = item.title || item.name || item.value || item.label || item.urlAddress || ''
    return text ? [String(text).trim()] : []
  }
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

function getLocationText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const loc = Array.isArray(value) ? value[0] : value
  if (!loc || typeof loc !== 'object') return ''
  const location = loc as any
  return [
    location.locationName,
    [location.city, location.state].filter(Boolean).join(', '),
    location.country,
  ].filter(Boolean)[0] || ''
}

function getProfileLinks(candidate: any) {
  const links = Array.isArray(candidate.urls) ? candidate.urls : []
  const normalized = links
    .map((link: any) => ({
      urlName: link?.urlName || link?.name || link?.label || 'Link',
      urlAddress: link?.urlAddress || link?.url || link?.href || '',
    }))
    .filter((link: any) => link.urlAddress)

  const directLinks = [
    ['LinkedIn', candidate.linkedin || candidate.linkedinUrl || candidate.linkedInUrl],
    ['Portfolio', candidate.portfolio || candidate.portfolioUrl],
    ['GitHub', candidate.github || candidate.githubUrl],
    ['Calendly', candidate.calendly || candidate.calendlyUrl],
  ]
    .filter(([, url]) => url)
    .map(([urlName, urlAddress]) => ({ urlName, urlAddress }))

  return [...normalized, ...directLinks]
}

function getResumeUrl(candidate: any): string {
  if (typeof candidate.resumeLink === 'string') return candidate.resumeLink
  if (typeof candidate.resume === 'string') return candidate.resume
  return candidate.resume?.url || candidate.resume?.urlAddress || ''
}

function InitialAvatar({ name, size = 72 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#EEF6F7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: size * 0.36,
        fontWeight: 600,
        color: '#306770',
        fontFamily: 'Manrope',
        letterSpacing: 0,
      }}
    >
      {initials}
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #EBEBEB',
        borderRadius: 18,
        padding: '28px 32px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ color: '#63B08D' }}>{icon}</div>
        <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 18, color: '#306770', margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '24px 0',
        textAlign: 'center',
        color: '#AAAAAA',
        fontSize: 13,
        fontStyle: 'italic',
        borderTop: '1px dashed #E8E8E8',
      }}
    >
      {message}
    </div>
  )
}

export default function ProfilePage({ candidate, onBack, onCandidateUpdate, onSaved }: { candidate: Candidate | null | undefined; onBack?: () => void; onCandidateUpdate?: (patch: any) => void; onSaved?: () => void }) {
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [populatedFields, setPopulatedFields] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [localOverride, setLocalOverride] = useState<any>(null)
  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const [skillsHovered, setSkillsHovered] = useState<string | null>(null)
  const [skillsSearch, setSkillsSearch] = useState('')
  const skillsInputRef = useRef<HTMLInputElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)

  // Merge server candidate with local override so sections update instantly after upload
  const candidateData = { ...(candidate ?? {}), ...(localOverride ?? {}) } as any

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const email = candidateData.email
    if (!file || !email) return
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadCandidateResume(email, file)
      const c = result?.candidate
      if (c) {
        setLocalOverride(c)
        onCandidateUpdate?.(c)

        const base = (candidate ?? {}) as any
        const added: string[] = []
        if (c.skills?.length && !base.skills?.length) added.push('Skills')
        if (c.targetRoles?.length && !base.targetRoles?.length) added.push('Target Role')
        if (c.work_experience && !base.work_experience) added.push('Experience')
        if (c.education && !base.education) added.push('Education')
        if ((c.resume_text || c.summary) && !base.resume_text && !base.summary) added.push('About')
        if (c.phone && !base.phone) added.push('Phone')
        if (c.firstName && !base.firstName) added.push('Name')
        if (c.location?.length && !base.location?.length) added.push('Location')

        if (added.length) {
          setPopulatedFields(added)
          setTimeout(() => setPopulatedFields([]), 6000)
        } else if (result?.extracted?.textExtracted === false) {
          setUploadError('Resume saved, but text could not be read. Try a .docx version for better results.')
          setTimeout(() => setUploadError(null), 8000)
        } else if (result?.extracted?.fieldsPopulated === false) {
          setUploadError('Resume saved. Profile fields could not be auto-filled this time. Try again in a moment.')
          setTimeout(() => setUploadError(null), 8000)
        } else {
          setPopulatedFields(['Resume uploaded'])
          setTimeout(() => setPopulatedFields([]), 4000)
        }
        onSaved?.()
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please try again.')
      setTimeout(() => setUploadError(null), 6000)
    } finally {
      setUploading(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  const firstName = candidateData.firstName || candidateData.first_name || ''
  const lastName = candidateData.lastName || candidateData.last_name || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || candidateData.name || 'Wanderwork Member'
  const targetRoles = toTextArray(candidateData.targetRoles || candidateData.target_roles || candidateData.targetRole)
  const headline = targetRoles[0] || candidateData.title || 'Remote job seeker'
  const locationStr = getLocationText(candidateData.location)

  const allSkills = [...new Set([...toTextArray(candidateData.skills), ...toTextArray(candidateData.skills_2)])]

  const summary = candidateData.summary || candidateData.bio || extractSummary(candidateData.resume_text || '')
  const experiences = parseExperience(candidateData.work_experience || candidateData.experience || '')
  const educations = parseEducation(candidateData.education || '')

  const links = getProfileLinks(candidateData)

  const summaryLimit = 300
  const summaryTrimmed = summary.length > summaryLimit && !summaryExpanded
    ? summary.slice(0, summaryLimit) + '...'
    : summary

  const hasResume = !!(getResumeUrl(candidateData) || candidateData.resume_text)
  const isProfileSparse =
    !hasResume &&
    targetRoles.length === 0 &&
    allSkills.length === 0 &&
    !summary &&
    experiences.length === 0 &&
    educations.length === 0

  return (
    <div className="safe-area-top" style={{ minHeight: '100vh', background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* Header nav */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0 0' }}>
          <h1
            style={{
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 22,
              color: '#306770',
              letterSpacing: '3px',
              cursor: onBack ? 'pointer' : 'default',
            }}
            onClick={onBack}
          >
            WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
          </h1>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                background: 'none',
                border: '1px solid #DCDCDC',
                cursor: 'pointer',
                color: '#306770',
                fontSize: 13,
                fontFamily: 'Manrope',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#306770'
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderColor = '#306770'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = '#306770'
                e.currentTarget.style.borderColor = '#DCDCDC'
              }}
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
          )}
        </header>

        <div style={{ height: 32 }} />

        {isProfileSparse && (
          <div
            style={{
              background: '#EEF6F7',
              border: '1px solid #C8DEDE',
              borderRadius: 16,
              padding: '18px 20px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: '0 0 4px', fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#306770' }}>
                Complete your profile
              </p>
              <p style={{ margin: 0, fontFamily: 'Manrope', fontSize: 13, lineHeight: 1.6, color: '#4B6A73' }}>
                Fill in your info or upload a new resume to build out your profile and get closer to that dream remote job.
              </p>
            </div>
            <button
              onClick={() => resumeInputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #306770',
                background: '#306770',
                color: '#FFFFFF',
                fontFamily: 'Manrope',
                fontSize: 13,
                fontWeight: 700,
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.65 : 1,
              }}
            >
              {uploading ? (
                <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #FFFFFF', borderTopColor: 'transparent', display: 'inline-block' }} />
              ) : (
                <Upload size={14} />
              )}
              Upload Resume
            </button>
          </div>
        )}

        {/* Hero card */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #EBEBEB',
            borderRadius: 22,
            padding: '36px 32px 28px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>

            {/* Left column: avatar only */}
            <div style={{ flexShrink: 0 }}>
              {candidateData.profileImage ? (
                <img
                  src={candidateData.profileImage}
                  alt={fullName}
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <InitialAvatar name={fullName} size={80} />
              )}
            </div>

            {/* Right column: name, title, location, LinkedIn, resume */}
            <div style={{ flex: 1, minWidth: 200 }}>
              {/* Name row with LinkedIn aligned right */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 26, color: '#1A1A1A', margin: '0 0 4px' }}>
                  {fullName || 'Your Name'}
                </h2>
                {(() => {
                  const directUrl = candidateData.linkedin || candidateData.linkedinUrl || candidateData.linkedInUrl
                  const urlsArray: any[] = Array.isArray(candidateData.urls) ? candidateData.urls : []
                  const urlsLinkedIn = urlsArray.find((u: any) => u?.urlName === 'LinkedIn' || u?.urlAddress?.includes('linkedin.com'))?.urlAddress
                  const liUrl = directUrl || urlsLinkedIn
                  const isConnected = liUrl && liUrl !== 'LinkedinURL.com' && liUrl.includes('linkedin')
                  return (
                    <a
                      href={`${API_BASE}/oauth/linkedin`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid #C8DDE0',
                        background: 'transparent',
                        color: isConnected ? '#36BF8F' : '#306770',
                        fontSize: 13,
                        fontFamily: 'Manrope',
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF4F5' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      title={isConnected ? 'Re-sync LinkedIn profile' : 'Connect LinkedIn to import your profile'}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      {isConnected ? 'LinkedIn Connected' : 'Connect LinkedIn'}
                    </a>
                  )
                })()}
              </div>
              {headline && (
                <p style={{ fontSize: 15, color: '#306770', fontWeight: 600, margin: '0 0 8px', fontFamily: 'Manrope' }}>
                  {headline}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                {locationStr && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#787878' }}>
                    <MapPin size={13} />
                    {locationStr}
                  </span>
                )}
                {links.map((link: any) => (
                  <a
                    key={link.urlName}
                    href={link.urlAddress}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#306770', textDecoration: 'none', fontWeight: 600 }}
                  >
                    <Link2 size={12} />
                    {link.urlName}
                  </a>
                ))}
              </div>

              {/* Resume upload */}
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={handleResumeUpload}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => resumeInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: '1px dashed #63B08D',
                    background: populatedFields.length ? 'rgba(99,176,141,0.12)' : 'rgba(99,176,141,0.06)',
                    color: populatedFields.length ? '#36BF8F' : '#306770',
                    fontSize: 13,
                    fontFamily: 'Manrope',
                    fontWeight: 600,
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {uploading
                    ? <span className="animate-spin" style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #306770', borderTopColor: 'transparent', display: 'inline-block' }} />
                    : <Upload size={14} />}
                  {populatedFields.length ? `✓ Updated: ${populatedFields.join(', ')}` : hasResume ? 'Replace Resume' : 'Upload Resume'}
                </button>
                {hasResume && (() => {
                  const resumeUrl = getResumeUrl(candidateData)
                  return resumeUrl ? (
                    <a
                      href={resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '9px 14px',
                        borderRadius: 10,
                        border: '1px solid #DCDCDC',
                        background: 'white',
                        color: '#306770',
                        fontSize: 13,
                        fontFamily: 'Manrope',
                        fontWeight: 600,
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      View
                    </a>
                  ) : null
                })()}
              </div>
              {uploadError && (
                <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626', fontFamily: 'Manrope' }}>{uploadError}</p>
              )}
              {!hasResume && (
                <p style={{ marginTop: 6, fontSize: 12, color: '#AAAAAA', fontFamily: 'Manrope' }}>
                  Your experience, education, and skills will auto-fill after upload.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* About */}
        <Section icon={<User size={18} />} title="About">
          {summary ? (
            <>
            <p
              style={{
                fontSize: 14,
                color: '#444',
                lineHeight: 1.75,
                whiteSpace: 'pre-line',
                margin: 0,
              }}
            >
              {summaryTrimmed}
            </p>
            {summary.length > summaryLimit && (
              <button
                onClick={() => setSummaryExpanded((v) => !v)}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#306770',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'Manrope',
                  padding: 0,
                }}
              >
                {summaryExpanded ? 'show less' : '...see more'}
              </button>
            )}
            </>
          ) : (
            <EmptyState message="No summary yet - upload your resume to auto-fill." />
          )}
        </Section>

        {/* Experience */}
        <Section icon={<Briefcase size={18} />} title="Experience">
          {experiences.length === 0 ? (
            <EmptyState message="No experience entries yet - upload your resume to auto-fill." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {experiences.map((exp, i) => (
                <div
                  key={i}
                  style={{
                    paddingBottom: 24,
                    marginBottom: i < experiences.length - 1 ? 24 : 0,
                    borderBottom: i < experiences.length - 1 ? '1px solid #F0F0F0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #E8F5EE 0%, #D4EDE3 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Briefcase size={18} color="#63B08D" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#1A1A1A', marginBottom: 2 }}>
                        {exp.title}
                      </div>
                      {(exp.company || exp.type) && (
                        <div style={{ fontSize: 13, color: '#444', marginBottom: 2 }}>
                          {[exp.company, exp.type].filter(Boolean).join(' - ')}
                        </div>
                      )}
                      {exp.dates && (
                        <div style={{ fontSize: 12, color: '#909090', marginBottom: exp.description ? 8 : 0 }}>
                          {exp.dates}
                        </div>
                      )}
                      {exp.description && (
                        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Education */}
        <Section icon={<GraduationCap size={18} />} title="Education">
          {educations.length === 0 ? (
            <EmptyState message="No education entries yet - upload your resume to auto-fill." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {educations.map((edu, i) => (
                <div
                  key={i}
                  style={{
                    paddingBottom: 24,
                    marginBottom: i < educations.length - 1 ? 24 : 0,
                    borderBottom: i < educations.length - 1 ? '1px solid #F0F0F0' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #EEF0FF 0%, #DFE3FF 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <GraduationCap size={18} color="#6366F1" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#1A1A1A', marginBottom: 2 }}>
                        {edu.school}
                      </div>
                      {edu.degree && (
                        <div style={{ fontSize: 13, color: '#444', marginBottom: 2 }}>
                          {edu.degree}
                        </div>
                      )}
                      {edu.years && (
                        <div style={{ fontSize: 12, color: '#909090', marginBottom: edu.description ? 8 : 0 }}>
                          {edu.years}
                        </div>
                      )}
                      {edu.description && (
                        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-line' }}>
                          {edu.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Skills */}
        {(() => {
          const COLLAPSED_COUNT = 10
          const displayed = skillsExpanded ? allSkills : allSkills.slice(0, COLLAPSED_COUNT)
          const hasMore = allSkills.length > COLLAPSED_COUNT

          const saveSkills = async (updated: string[]) => {
            setLocalOverride((prev: any) => ({ ...(prev ?? {}), skills: updated, skills_2: [] }))
            onCandidateUpdate?.({ skills: updated })
            if (candidateData._id) {
              try {
                await updateCandidateSkills(candidateData._id, updated)
                onSaved?.()
              } catch (e) { console.warn('Failed to save skills', e) }
            }
          }

          const handleDelete = (skill: string) => saveSkills(allSkills.filter(s => s !== skill))

          const handleAdd = () => {
            const trimmed = skillsSearch.trim()
            if (!trimmed || allSkills.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
              setSkillsSearch('')
              return
            }
            saveSkills([...allSkills, trimmed])
            setSkillsSearch('')
            skillsInputRef.current?.focus()
          }

          return (
            <Section icon={<Wrench size={18} />} title="Skills">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {displayed.map(skill => (
                  <div
                    key={skill}
                    onMouseEnter={() => setSkillsHovered(skill)}
                    onMouseLeave={() => setSkillsHovered(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 14px',
                      borderRadius: 99,
                      background: skillsHovered === skill ? 'white' : 'rgba(99,176,141,0.10)',
                      border: skillsHovered === skill ? '1.5px solid #36BF8F' : '1.5px solid rgba(99,176,141,0.35)',
                      fontSize: 13,
                      color: '#306770',
                      fontFamily: 'Manrope',
                      fontWeight: 600,
                      cursor: 'default',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {skill}
                    {skillsHovered === skill && (
                      <button
                        onClick={() => handleDelete(skill)}
                        style={{ display: 'flex', alignItems: 'center', color: '#AAAAAA', lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E53E3E' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#AAAAAA' }}
                        title={`Remove ${skill}`}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!skillsExpanded && hasMore && (
                  <button
                    onClick={() => setSkillsExpanded(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 99,
                      background: 'white', border: '1.5px solid #DCDCDC', fontSize: 13, color: '#787878',
                      fontFamily: 'Manrope', fontWeight: 600, cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#306770'; e.currentTarget.style.color = '#306770' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#DCDCDC'; e.currentTarget.style.color = '#787878' }}
                  >
                    +{allSkills.length - COLLAPSED_COUNT} more
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  ref={skillsInputRef}
                  type="text"
                  placeholder="Add a skill..."
                  value={skillsSearch}
                  onChange={e => setSkillsSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                  style={{
                    flex: 1, padding: '7px 14px', borderRadius: 99,
                    border: '1.5px solid #DCDCDC', fontSize: 13, color: '#1A1A2E',
                    fontFamily: 'Manrope', background: 'white', outline: 'none',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#306770' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#DCDCDC' }}
                />
                <button
                  onClick={handleAdd}
                  disabled={!skillsSearch.trim()}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#36BF8F', color: 'white',
                    border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0, opacity: skillsSearch.trim() ? 1 : 0.35,
                    transition: 'opacity 0.15s',
                  }}
                  title="Add skill"
                >
                  <Plus size={14} />
                </button>
                {hasMore && (
                  <button
                    onClick={() => setSkillsExpanded(e => !e)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#EEF6F7', color: '#306770',
                      border: '1px solid rgba(48,103,112,0.22)', display: 'inline-flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                    }}
                    title={skillsExpanded ? 'Collapse' : 'Show all'}
                  >
                    {skillsExpanded ? <Minus size={14} /> : <Plus size={14} />}
                  </button>
                )}
              </div>
              {allSkills.length === 0 && (
                <p style={{ marginTop: 8, fontSize: 12, color: '#AAAAAA', fontFamily: 'Manrope', fontStyle: 'italic' }}>
                  No skills yet. Add one above or upload your resume.
                </p>
              )}
            </Section>
          )
        })()}

      </div>
    </div>
  )
}

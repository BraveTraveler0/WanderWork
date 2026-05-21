import { useState } from 'react'
import { ArrowLeft, MapPin, Link2, Briefcase, GraduationCap, Wrench, User } from 'lucide-react'
import type { Candidate } from '../api/jobseeker'

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
  if (!text?.trim()) return []
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  const dateRe = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})/i
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return null
    const entry: ExperienceEntry = { title: lines[0], company: '' }
    const rest = lines.slice(1)
    for (const line of rest) {
      if (!entry.company && !dateRe.test(line.slice(0, 6))) {
        const parts = line.split('·').map((p) => p.trim())
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
  if (!text?.trim()) return []
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
  if (!resumeText) return ''
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
        background: 'linear-gradient(135deg, #306770 0%, #63B08D 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: size * 0.36,
        fontWeight: 700,
        color: '#fff',
        fontFamily: 'Manrope',
        letterSpacing: 1,
      }}
    >
      {initials || <User size={size * 0.45} color="#fff" />}
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

export default function ProfilePage({ candidate, onBack }: { candidate: Candidate; onBack?: () => void }) {
  const [summaryExpanded, setSummaryExpanded] = useState(false)

  const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ')
  const headline = candidate.targetRoles?.[0] || ''
  const locationStr = (() => {
    const loc = candidate.location?.[0]
    if (!loc) return ''
    return [loc.city, loc.state].filter(Boolean).join(', ')
  })()

  const allSkills = [...new Set([...(candidate.skills || []), ...(candidate.skills_2 || [])])]

  const summary = extractSummary(candidate.resume_text || '')
  const experiences = parseExperience(candidate.work_experience || '')
  const educations = parseEducation(candidate.education || '')

  const links = (candidate.urls || []).filter((u: any) => u?.urlAddress)

  const summaryLimit = 300
  const summaryTrimmed = summary.length > summaryLimit && !summaryExpanded
    ? summary.slice(0, summaryLimit) + '...'
    : summary

  const hasResume = !!(candidate.resumeLink || candidate.resume_text)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)' }}>
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
            {candidate.profileImage ? (
              <img
                src={candidate.profileImage}
                alt={fullName}
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <InitialAvatar name={fullName} size={80} />
            )}

            <div style={{ flex: 1, minWidth: 200 }}>
              <h2 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 26, color: '#1A1A1A', margin: '0 0 4px' }}>
                {fullName || 'Your Name'}
              </h2>
              {headline && (
                <p style={{ fontSize: 15, color: '#306770', fontWeight: 600, margin: '0 0 8px', fontFamily: 'Manrope' }}>
                  {headline}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
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
            </div>
          </div>

          {!hasResume && (
            <div
              style={{
                marginTop: 20,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(99,176,141,0.08)',
                border: '1px dashed #63B08D',
                fontSize: 13,
                color: '#306770',
                fontFamily: 'Manrope',
              }}
            >
              Upload your resume in Settings → your work experience, education, and skills will auto-fill here.
            </div>
          )}
        </div>

        {/* About */}
        {summary && (
          <Section icon={<User size={18} />} title="About">
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
          </Section>
        )}

        {/* Experience */}
        <Section icon={<Briefcase size={18} />} title="Experience">
          {experiences.length === 0 ? (
            <EmptyState message="No experience entries yet — upload your resume to auto-fill." />
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
                          {[exp.company, exp.type].filter(Boolean).join(' · ')}
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
            <EmptyState message="No education entries yet — upload your resume to auto-fill." />
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
        <Section icon={<Wrench size={18} />} title="Skills">
          {allSkills.length === 0 ? (
            <EmptyState message="No skills yet — upload your resume or add them in Settings." />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allSkills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 99,
                    background: 'rgba(99,176,141,0.10)',
                    border: '1px solid rgba(99,176,141,0.25)',
                    fontSize: 13,
                    color: '#306770',
                    fontFamily: 'Manrope',
                    fontWeight: 600,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}

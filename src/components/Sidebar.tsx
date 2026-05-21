import { ChevronDown, Eye, Pencil, X, Check, Upload } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { updateCandidateSkills, updateJobSeeker, uploadCandidateResume } from '../api/jobseeker.ts'

const Sidebar = ({ data, onProfileImageChange, onCandidateUpdate }: { data?: any, onProfileImageChange?: (image: string | null) => void, onCandidateUpdate?: (patch: any) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const candidate = data?.Candidates?.[0]

  const getDocumentName = (doc: any, fallback = 'Resume.docx') => {
    if (!doc) return fallback
    if (typeof doc === 'string') {
      try {
        if (/^https?:\/\//i.test(doc)) {
          return decodeURIComponent(new URL(doc).pathname.split('/').pop() || fallback)
        }
      } catch {}
      return doc
    }
    return doc.originalname || doc.filename || doc.name || fallback
  }

  const getDocumentUrl = (doc: any) => {
    if (!doc) return ''
    if (typeof doc === 'string' && /^https?:\/\//i.test(doc)) return doc
    return doc.url || doc.link || doc.href || ''
  }
  
  const [profile, setProfile] = useState<any>(() => {
    const rawCandidate = data?.Candidates?.[0]
    return rawCandidate ? {
      name: `${rawCandidate.firstName || ''} ${rawCandidate.lastName || ''}`.trim() || 'User',
      title: rawCandidate.targetRoles?.[0] || 'Full Stack Developer',
      location: rawCandidate.location?.[0]?.city || rawCandidate.location?.[0]?.locationName || 'Location',
      email: rawCandidate.email || 'email@example.com',
      phone: rawCandidate.phone || '+1-000-000-0000',
      skills: Array.isArray(rawCandidate.skills) ? rawCandidate.skills.join(', ') : 'Skills',
      linkedin: rawCandidate.urls?.find((u: any) => u.urlName === 'LinkedIn')?.urlAddress || 'LinkedinURL.com',
      portfolio: rawCandidate.urls?.find((u: any) => u.urlName === 'Portfolio')?.urlAddress || 'LinkedinURL.com',
      github: rawCandidate.urls?.find((u: any) => u.urlName === 'GitHub')?.urlAddress || 'GithubURL.com',
      calendly: rawCandidate.urls?.find((u: any) => u.urlName === 'Calendly')?.urlAddress || 'CalendlyURL.com',
      resume: rawCandidate.resume || rawCandidate.resumeLink || null
    } : {
      name: 'User',
      title: 'Job Seeker',
      location: 'Location',
      email: 'email@example.com',
      phone: '+1-000-000-0000',
      skills: 'Skills',
      linkedin: 'LinkedinURL.com',
      portfolio: 'LinkedinURL.com',
      github: 'GithubURL.com',
      calendly: 'CalendlyURL.com',
      resume: null
    }
  })

  const [editForm, setEditForm] = useState<any>(profile)

  // Sync with incoming candidate data when it changes
  useEffect(() => {
    const rawCandidate = data?.Candidates?.[0]
    if (rawCandidate) {
      const newProfile = {
        name: `${rawCandidate.firstName || ''} ${rawCandidate.lastName || ''}`.trim() || 'User',
        title: rawCandidate.targetRoles?.[0] || 'Full Stack Developer',
        location: rawCandidate.location?.[0]?.city || rawCandidate.location?.[0]?.locationName || 'Location',
        email: rawCandidate.email || 'email@example.com',
        phone: rawCandidate.phone || '+1-000-000-0000',
        skills: Array.isArray(rawCandidate.skills) ? rawCandidate.skills.join(', ') : 'Skills',
        linkedin: rawCandidate.urls?.find((u: any) => u.urlName === 'LinkedIn')?.urlAddress || 'LinkedinURL.com',
        portfolio: rawCandidate.urls?.find((u: any) => u.urlName === 'Portfolio')?.urlAddress || 'LinkedinURL.com',
        github: rawCandidate.urls?.find((u: any) => u.urlName === 'GitHub')?.urlAddress || 'GithubURL.com',
        calendly: rawCandidate.urls?.find((u: any) => u.urlName === 'Calendly')?.urlAddress || 'CalendlyURL.com',
        resume: rawCandidate.resume || rawCandidate.resumeLink || null
      }
      setProfile(newProfile)
      setEditForm(newProfile)
    }
  }, [data?.Candidates])

  // Sync editForm with profile whenever profile changes
  useEffect(() => {
    setEditForm(profile)
  }, [profile])

  const handleEdit = (field: string) => {
    setEditForm(profile)
    setEditingField(field)
  }

  const buildUrlsPatch = (label: string, value: string) => {
    const urls = Array.isArray(candidate?.urls) ? [...candidate.urls] : []
    const index = urls.findIndex((item: any) => item?.urlName === label)
    if (index >= 0) {
      urls[index] = { ...urls[index], urlAddress: value }
    } else {
      urls.push({ urlName: label, urlAddress: value })
    }
    return urls
  }

  const buildCandidatePatch = (field: string, value: string) => {
    const trimmed = String(value ?? '').trim()
    switch (field) {
      case 'name': {
        const parts = trimmed.split(/\s+/).filter(Boolean)
        return {
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || ''
        }
      }
      case 'title':
        return { targetRoles: trimmed ? [trimmed] : [] }
      case 'location':
        return { location: [{ locationName: trimmed, city: trimmed }] }
      case 'email':
        return { email: trimmed }
      case 'phone':
        return { phone: trimmed }
      case 'skills': {
        const skills = trimmed
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean)
        return { skills }
      }
      case 'linkedin':
        return { urls: buildUrlsPatch('LinkedIn', trimmed) }
      case 'portfolio':
        return { urls: buildUrlsPatch('Portfolio', trimmed) }
      case 'github':
        return { urls: buildUrlsPatch('GitHub', trimmed) }
      case 'calendly':
        return { urls: buildUrlsPatch('Calendly', trimmed) }
      case 'resume':
        return { resumeLink: trimmed }
      default:
        return {}
    }
  }

  const handleSave = async (field: string) => {
    const nextProfile = { ...profile, [field]: editForm[field] }
    setProfile(nextProfile)
    localStorage.setItem('wanderworkProfile', JSON.stringify(nextProfile))
    setEditingField(null)
    const patch = buildCandidatePatch(field, editForm[field])
    if (candidate?._id && Object.keys(patch).length > 0) {
      try {
        if (field === 'skills') {
          await updateCandidateSkills(candidate._id, patch.skills || [])
        } else {
          await updateJobSeeker({
            Candidates: [{ _id: candidate._id, ...patch }]
          })
        }
      } catch (e) {
        console.warn('Failed to update candidate profile', e)
      }
    }
    if (Object.keys(patch).length > 0) {
      onCandidateUpdate?.(patch)
    }
  }

  const handleCancel = (field: string) => {
    setEditForm({ ...editForm, [field]: profile[field] })
    setEditingField(null)
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditForm({ ...editForm, [field]: value })
  }

  const resumeInputRef = useRef<HTMLInputElement>(null)
  const [resumeUploading, setResumeUploading] = useState(false)

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile.email) return
    setResumeUploading(true)
    try {
      const result = await uploadCandidateResume(profile.email, file)
      const uploadedResume = result?.candidate?.resume || result?.candidate?.resumeLink || {
        filename: file.name,
        originalname: file.name,
      }
      const newProfile = { ...profile, resume: uploadedResume }
      setProfile(newProfile)
      localStorage.setItem('wanderworkProfile', JSON.stringify(newProfile))
      onCandidateUpdate?.(result?.candidate || { resume: uploadedResume, resumeLink: getDocumentUrl(uploadedResume) })
    } catch (err) {
      console.warn('Resume upload failed', err)
    } finally {
      setResumeUploading(false)
      if (resumeInputRef.current) resumeInputRef.current.value = ''
    }
  }

  const openResume = () => {
    const resumeDoc = profile.resume || candidate?.resume || candidate?.resumeLink
    const url = getDocumentUrl(resumeDoc)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const [profileImage, setProfileImage] = useState<string | null>(() => {
    const saved = localStorage.getItem('wanderworkProfileImage')
    return candidate?.profileImage || saved || null
  })

  useEffect(() => {
    if (candidate?.profileImage) {
      setProfileImage(candidate.profileImage)
      localStorage.setItem('wanderworkProfileImage', candidate.profileImage)
    }
  }, [candidate?.profileImage])

  useEffect(() => {
    if (onProfileImageChange) {
      onProfileImageChange(profileImage)
    }
  }, [profileImage, onProfileImageChange])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const imageData = event.target?.result as string
        setProfileImage(imageData)
        localStorage.setItem('wanderworkProfileImage', imageData)
        onProfileImageChange?.(imageData)
        onCandidateUpdate?.({ profileImage: imageData })
        if (candidate?._id) {
          try {
            await updateJobSeeker({
              Candidates: [{ _id: candidate._id, profileImage: imageData }]
            })
          } catch (err) {
            console.warn('Failed to update candidate profile image', err)
          }
        }
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full xl:w-[266px] shrink-0 hidden xl:flex xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overflow-x-hidden custom-scrollbar xl:pr-2">
      {/* User Panel */}
      <div 
        className="bg-white rounded-[20px] p-6 sm:p-8 flex flex-col items-center gap-4"
        style={{ 
          boxShadow: '0px 4px 4px 0px rgba(0, 0, 0, 0.1)',
          fontFamily: 'Manrope'
        }}
      >
        <div className="w-full">
          {editingField === 'name' ? (
            <div>
              <EditField label="Name" value={editForm.name} onChange={(v) => handleFieldChange('name', v)} />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSave('name')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[12px] text-white transition-all"
                  style={{ background: '#36BF8F' }}
                >
                  <Check size={16} /> Save
                </button>
                <button
                  onClick={() => handleCancel('name')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[12px] transition-all"
                  style={{ background: '#DCDCDC', color: '#787878' }}
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="group lg:cursor-default w-full flex items-center justify-between"
            >
              <div className="text-center flex-1">
                <p className="text-[20px] text-black font-normal">{profile.name}</p>
              </div>
              <Pencil
                size={12}
                style={{ color: '#8a8a8a' }}
                className="cursor-pointer hidden lg:block opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); handleEdit('name') }}
              />
              <ChevronDown 
                size={20} 
                className="lg:hidden" 
                style={{ color: '#306770', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
              />
            </button>
          )}
        </div>

        <div className="w-[94px] h-[94px] rounded-full bg-gray-300 cursor-pointer hover:opacity-80 transition-opacity relative overflow-hidden">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            title="Click to upload profile photo"
          />
          {profileImage && (
            <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Always show on lg, conditionally on smaller screens */}
        <div className={`w-full ${isExpanded || 'hidden' || 'lg:flex'} lg:flex flex-col gap-4`}>
          <FieldRow
            label="Title"
            value={profile.title}
            editValue={editForm.title}
            editing={editingField === 'title'}
            onEdit={() => handleEdit('title')}
            onChange={(v) => handleFieldChange('title', v)}
            onSave={() => handleSave('title')}
            onCancel={() => handleCancel('title')}
          />
          
          {/* Inline single-field editing */}
          <FieldRow
            label="Location"
            value={profile.location}
            editValue={editForm.location}
            editing={editingField === 'location'}
            onEdit={() => handleEdit('location')}
            onChange={(v) => handleFieldChange('location', v)}
            onSave={() => handleSave('location')}
            onCancel={() => handleCancel('location')}
          />
          <FieldRow
            label="Email"
            value={profile.email}
            editValue={editForm.email}
            editing={editingField === 'email'}
            onEdit={() => handleEdit('email')}
            onChange={(v) => handleFieldChange('email', v)}
            onSave={() => handleSave('email')}
            onCancel={() => handleCancel('email')}
            wide
          />
          <FieldRow
            label="Phone"
            value={profile.phone}
            editValue={editForm.phone}
            editing={editingField === 'phone'}
            onEdit={() => handleEdit('phone')}
            onChange={(v) => handleFieldChange('phone', v)}
            onSave={() => handleSave('phone')}
            onCancel={() => handleCancel('phone')}
          />
          <FieldRow
            label="Skills"
            value={profile.skills}
            editValue={editForm.skills}
            editing={editingField === 'skills'}
            onEdit={() => handleEdit('skills')}
            onChange={(v) => handleFieldChange('skills', v)}
            onSave={() => handleSave('skills')}
            onCancel={() => handleCancel('skills')}
            multiline
          />
          <FieldRow
            label="Linkedin URL"
            value={profile.linkedin}
            editValue={editForm.linkedin}
            editing={editingField === 'linkedin'}
            onEdit={() => handleEdit('linkedin')}
            onChange={(v) => handleFieldChange('linkedin', v)}
            onSave={() => handleSave('linkedin')}
            onCancel={() => handleCancel('linkedin')}
          />
          <FieldRow
            label="Portfolio"
            value={profile.portfolio}
            editValue={editForm.portfolio}
            editing={editingField === 'portfolio'}
            onEdit={() => handleEdit('portfolio')}
            onChange={(v) => handleFieldChange('portfolio', v)}
            onSave={() => handleSave('portfolio')}
            onCancel={() => handleCancel('portfolio')}
          />
          <FieldRow
            label="Github"
            value={profile.github}
            editValue={editForm.github}
            editing={editingField === 'github'}
            onEdit={() => handleEdit('github')}
            onChange={(v) => handleFieldChange('github', v)}
            onSave={() => handleSave('github')}
            onCancel={() => handleCancel('github')}
          />
          <FieldRow
            label="Calendly URL"
            value={profile.calendly}
            editValue={editForm.calendly}
            editing={editingField === 'calendly'}
            onEdit={() => handleEdit('calendly')}
            onChange={(v) => handleFieldChange('calendly', v)}
            onSave={() => handleSave('calendly')}
            onCancel={() => handleCancel('calendly')}
          />
          
          {/* Resume Field — file upload */}
          <div className="w-full lg:w-[210px] group/resume" style={{ fontFamily: 'Manrope', color: '#787878' }}>
            <p className="text-[12px] mb-1">Resume</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openResume}
                disabled={!getDocumentUrl(profile.resume || candidate?.resume || candidate?.resumeLink)}
                className="text-[16px] flex-1 truncate text-left disabled:cursor-default"
                title={getDocumentName(profile.resume || candidate?.resume || candidate?.resumeLink, 'No file uploaded')}
                style={{ color: '#787878' }}
              >
                {profile.resume || candidate?.resume || candidate?.resumeLink
                  ? getDocumentName(profile.resume || candidate?.resume || candidate?.resumeLink)
                  : 'No file uploaded'}
              </button>
              <button
                onClick={openResume}
                disabled={!getDocumentUrl(profile.resume || candidate?.resume || candidate?.resumeLink)}
                title="View uploaded resume"
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 opacity-0 group-hover/resume:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: '#EEF4F5', color: '#306770', border: '1px solid #C8DDE0' }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = '#D4E8EC' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#EEF4F5' }}
              >
                <Eye size={13} />
              </button>
              <button
                onClick={() => resumeInputRef.current?.click()}
                disabled={resumeUploading}
                title="Upload resume"
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 opacity-0 group-hover/resume:opacity-100"
                style={{ background: '#EEF4F5', color: '#306770', border: '1px solid #C8DDE0' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#D4E8EC' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#EEF4F5' }}
              >
                {resumeUploading
                  ? <span className="w-3 h-3 rounded-full border-2 border-[#306770] border-t-transparent animate-spin" />
                  : <Upload size={13} />}
              </button>
            </div>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.rtf,.txt"
              className="hidden"
              onChange={handleResumeFileChange}
            />
          </div>
          
          {/* Edit Button for expanded view on mobile */}
          <button
            onClick={() => handleEdit('location')}
            className="lg:hidden mt-4 w-full px-4 py-2 rounded-[10px] text-[12px] bg-white transition-all duration-500 hover:bg-[#306770] hover:text-white"
            style={{ 
              border: '1px solid #306770',
              color: '#306770',
              fontFamily: 'Manrope'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#306770'
            }}
          >
            Edit Profile
          </button>
        </div>

        {/* Compact view on mobile */}
        <div className="lg:hidden text-center text-[16px] w-full" style={{ color: '#787878' }}>
          <p>{profile.location}</p>
          <p>{profile.email}</p>
          <p>{profile.phone}</p>
          <button
            onClick={() => {
              setEditForm(profile)
              setEditingField('profile')
            }}
            className="mt-4 w-full px-4 py-2 rounded-[10px] text-[12px] bg-white transition-all duration-500 hover:bg-[#306770] hover:text-white"
            style={{ 
              border: '1px solid #306770',
              color: '#306770',
              fontFamily: 'Manrope'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#306770'
            }}
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Stats - Horizontal on mobile only */}
      <div 
        className="lg:hidden flex flex-row gap-4 justify-around items-center"
        style={{
          fontFamily: 'Manrope'
        }}
      >
        <StatCard number="1129" label="New Jobs This Week" />
        <StatCard number="30" label="Tokens" />
        <StatCard number="18" label="Premium Days Left" />
      </div>
    </div>
  )
}

const FieldRow = ({ label, value, editValue, editing, onEdit, onChange, onSave, onCancel, wide, multiline, hasArrow }: {
  label: string
  value: string
  editValue?: string
  editing: boolean
  onEdit: () => void
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  wide?: boolean
  multiline?: boolean
  hasArrow?: boolean
}) => {
  if (editing) {
    return (
      <div className="w-full lg:w-[210px]">
        <EditField label={label} value={editValue ?? value} onChange={onChange} multiline={multiline} />
        <div className="flex gap-2 mt-2">
          <button 
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[12px] text-white transition-all"
            style={{ background: '#36BF8F' }}
          >
            <Check size={16} /> Save
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[12px] transition-all"
            style={{ background: '#DCDCDC', color: '#787878' }}
          >
            <X size={16} /> Cancel
          </button>
        </div>
      </div>
    )
  }
  return <InfoField label={label} value={value} wide={wide} multiline={multiline} hasArrow={hasArrow} onEdit={onEdit} />
}

const InfoField = ({ label, value, wide, hasArrow, onEdit }: { label: string, value: string, wide?: boolean, multiline?: boolean, hasArrow?: boolean, onEdit: () => void }) => {
  return (
    <div 
      className="group w-full lg:w-[210px] relative cursor-pointer lg:cursor-default transition-all" 
      style={{ fontFamily: 'Manrope', color: '#787878' }}
      onClick={() => {
        // On mobile, click anywhere to edit
        if (window.innerWidth < 1024) {
          onEdit()
        }
      }}
    >
      <p className="text-[12px] mb-1" style={{ color: '#787878' }}>{label}</p>
      <div className="flex items-center justify-between">
        <p className={`text-[13px] ${wide ? 'lg:w-[230px]' : ''}`} style={{ color: '#1A1A2E' }}>{value}</p>
        <div className="flex items-center gap-2">
          {hasArrow && <ChevronDown size={16} style={{ color: '#306770' }} />}
          {!hasArrow && (
            <Pencil
              size={12}
              style={{ color: '#8a8a8a' }}
              className="cursor-pointer hidden lg:block opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const EditField = ({ label, value, multiline, onChange }: { label: string, value: string, wide?: boolean, multiline?: boolean, onChange: (value: string) => void }) => {
  return (
    <div className="w-full">
      <p className="text-[12px] mb-2" style={{ color: '#787878' }}>{label}</p>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-[8px] border text-[16px] resize-none"
          style={{ borderColor: '#DCDCDC', fontFamily: 'Manrope', color: '#787878' }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-[8px] border text-[16px]"
          style={{ borderColor: '#DCDCDC', fontFamily: 'Manrope', color: '#787878' }}
        />
      )}
    </div>
  )
}

const StatCard = ({ number, label }: { number: string, label: string }) => (
  <div className="flex flex-col gap-1 text-center min-w-fit">
    <p className="text-[40px] sm:text-[48px] text-black leading-none">{number}</p>
    <p className="text-[10px] sm:text-[11px] whitespace-nowrap" style={{ color: '#787878' }}>{label}</p>
  </div>
)

export default Sidebar

import type { ReactNode } from 'react'
import { Briefcase, MessageCircle, User, Users, Menu } from 'lucide-react'

export type BottomNavPage = 'dashboard' | 'messages' | 'profile'

interface BottomNavProps {
  active: BottomNavPage | 'more' | null
  unseenCount: number
  onNavigate: (page: BottomNavPage) => void
  onOpenRecruiters: () => void
  onOpenMore: () => void
  /** Not logged in: Messages/Profile/Recruiters prompt sign-in instead of navigating. */
  isGuest?: boolean
  onRequireAuth?: () => void
}

function NavButton({
  active,
  label,
  onClick,
  icon,
  badge,
}: {
  active: boolean
  label: string
  onClick: () => void
  icon: ReactNode
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-1 flex-1 py-1.5 transition-colors duration-200"
      style={{ color: active ? '#306770' : '#AAAAAA' }}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-0 right-[calc(50%-20px)] w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-bold text-white"
          style={{ background: '#36BF8F', fontFamily: 'Manrope' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <span className="text-[10px] font-medium" style={{ fontFamily: 'Manrope' }}>{label}</span>
    </button>
  )
}

/** Fixed bottom tab bar for the primary "main task" destinations — the
 * standard iOS/Android navigation pattern, shown only on phone-width
 * viewports (the desktop/tablet layout keeps the sidebar as primary nav). */
export default function BottomNav({ active, unseenCount, onNavigate, onOpenRecruiters, onOpenMore, isGuest, onRequireAuth }: BottomNavProps) {
  const guarded = (action: () => void) => {
    if (isGuest && onRequireAuth) return onRequireAuth()
    action()
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch safe-area-bottom safe-area-x"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderTop: '1px solid #EDEDED',
      }}
    >
      <NavButton active={active === 'dashboard'} label="Jobs" onClick={() => onNavigate('dashboard')} icon={<Briefcase size={20} />} />
      <NavButton active={active === 'profile'} label="Profile" onClick={() => guarded(() => onNavigate('profile'))} icon={<User size={20} />} />
      <NavButton active={active === 'messages'} label="Messages" onClick={() => guarded(() => onNavigate('messages'))} icon={<MessageCircle size={20} />} badge={unseenCount} />
      <NavButton active={false} label="Recruiters" onClick={() => guarded(onOpenRecruiters)} icon={<Users size={20} />} />
      <NavButton active={active === 'more'} label="More" onClick={onOpenMore} icon={<Menu size={20} />} />
    </nav>
  )
}

import { useEffect, useRef, useState } from 'react'
import JobSeekerLanding from './JobSeekerLanding'
import MobileLanding from './MobileLanding'

const DESIGN_WIDTH = 1461
const DESKTOP_BREAKPOINT = 1024

interface LandingPageProps {
  onSignIn: () => void
  onSignUp: () => void
}

function LandingNavbar({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 40px',
        background: visible ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.72)',
        backdropFilter: visible ? 'blur(12px)' : 'none',
        boxShadow: visible ? '0 1px 20px rgba(0,0,0,0.08)' : 'none',
        transition: 'background 0.3s, box-shadow 0.3s, backdrop-filter 0.3s',
        pointerEvents: 'auto',
        opacity: 1,
      }}
    >
      <p
        style={{
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
          fontSize: '28px',
          letterSpacing: '4px',
          color: '#306770',
          lineHeight: 1,
          margin: 0,
        }}
      >
        WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
      </p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={onSignIn}
          style={{
            background: 'transparent',
            color: '#306770',
            border: '2px solid #306770',
            borderRadius: '12px',
            padding: '8px 24px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'Manrope, sans-serif',
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#306770'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#306770'
          }}
        >
          Sign In
        </button>
        <button
          onClick={onSignUp}
          style={{
            background: '#306770',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'Manrope, sans-serif',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(48,103,112,0.35)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#245460')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#306770')}
        >
          Sign Up Free
        </button>
      </div>
    </header>
  )
}

export default function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < DESKTOP_BREAKPOINT)
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState(0)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setIsMobile(w < DESKTOP_BREAKPOINT)
      setScale(Math.min(1, w / DESIGN_WIDTH))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContentHeight(el.scrollHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [isMobile])

  if (isMobile) {
    return <MobileLanding onSignIn={onSignIn} onSignUp={onSignUp} />
  }

  const isScaled = scale < 1
  const outerHeight = contentHeight > 0 ? Math.round(contentHeight * scale) : undefined

  return (
    <>
      <LandingNavbar onSignIn={onSignIn} onSignUp={onSignUp} />
      <div
        style={{
          overflowX: 'hidden',
          width: '100%',
          height: outerHeight ? `${outerHeight}px` : '100vh',
          position: 'relative',
        }}
      >
        <div
          ref={innerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: isScaled ? 'top center' : 'top left',
            width: `${DESIGN_WIDTH}px`,
            marginLeft: isScaled ? `calc(50vw - ${DESIGN_WIDTH / 2}px)` : 0,
          }}
        >
          <JobSeekerLanding scale={scale} onSignIn={onSignIn} />
        </div>
      </div>
    </>
  )
}

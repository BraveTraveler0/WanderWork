import { useRef, useEffect, useState } from 'react'

const TEAL = '#306770'
const FONT = 'Manrope, sans-serif'
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'https://wanderwork-backend-server.onrender.com'

class Particle {
  originX: number; originY: number
  x: number; y: number
  size: number; color: string
  ctx: CanvasRenderingContext2D
  vx = 0; vy = 0
  ease = 0.15; friction = 0.92
  dx = 0; dy = 0
  distance = 0; force = 0; angle = 0

  constructor(x: number, y: number, color: string, ctx: CanvasRenderingContext2D) {
    this.originX = this.x = Math.floor(x)
    this.originY = this.y = Math.floor(y)
    this.size = Math.floor(Math.random() * 3) + 1
    this.color = color
    this.ctx = ctx
  }

  update(mouse: { x: number; y: number; radius: number }) {
    this.dx = mouse.x - this.x
    this.dy = mouse.y - this.y
    this.distance = this.dx * this.dx + this.dy * this.dy
    if (this.distance < mouse.radius) {
      this.force = -mouse.radius / this.distance * 6
      this.angle = Math.atan2(this.dy, this.dx)
      this.vx += this.force * Math.cos(this.angle)
      this.vy += this.force * Math.sin(this.angle)
    }
    this.x += (this.vx *= this.friction) + (this.originX - this.x) * this.ease
    this.y += (this.vy *= this.friction) + (this.originY - this.y) * this.ease
    this.ctx.fillStyle = this.color
    this.ctx.fillRect(this.x, this.y, this.size, this.size)
  }
}

const TAGLINES = ['Escape the Rat Race.', 'Find Financial Freedom.', 'Wander the world.']
const TYPE_SPEED = 55
const DELETE_SPEED = 35
const PAUSE_MS = 1400

export default function ParticleProfile({ onSignUp, onSignIn }: { onSignUp?: () => void; onSignIn?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>()
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999, radius: 3000 })

  const [tagline, setTagline] = useState('')
  const [tagIdx, setTagIdx] = useState(0)
  const [typing, setTyping] = useState(true)

  useEffect(() => {
    const full = TAGLINES[tagIdx]
    let timeout: ReturnType<typeof setTimeout>
    if (typing) {
      if (tagline.length < full.length) {
        timeout = setTimeout(() => setTagline(full.slice(0, tagline.length + 1)), TYPE_SPEED)
      } else {
        timeout = setTimeout(() => setTyping(false), PAUSE_MS)
      }
    } else {
      if (tagline.length > 0) {
        timeout = setTimeout(() => setTagline(tagline.slice(0, -1)), DELETE_SPEED)
      } else {
        setTagIdx((i) => (i + 1) % TAGLINES.length)
        setTyping(true)
      }
    }
    return () => clearTimeout(timeout)
  }, [tagline, tagIdx, typing])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    function init() {
      const W = wrap!.offsetWidth
      const H = wrap!.offsetHeight
      if (W === 0 || H === 0) return

      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      if (animRef.current) cancelAnimationFrame(animRef.current)
      particlesRef.current = []

      canvas!.width = W
      canvas!.height = H

    // Load SVG silhouette as image for precise shape
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 100 130">
      <circle cx="50" cy="28" r="22" fill="black"/>
      <path d="M0 108 C0 34, 100 34, 100 108 Z" fill="black"/>
    </svg>`
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const off = document.createElement('canvas')
      off.width = W; off.height = H
      const oc = off.getContext('2d')!
      oc.drawImage(img, 0, 0, W, H)
      URL.revokeObjectURL(url)

      const pixels = oc.getImageData(0, 0, W, H).data
    const gap = 5
    const ps: Particle[] = []

    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < W; x += gap) {
        if (pixels[(y * W + x) * 4 + 3] > 128) {
          const b = 0.65 + Math.random() * 0.35
          ps.push(new Particle(x, y, `rgb(${Math.floor(48*b)},${Math.floor(103*b)},${Math.floor(112*b)})`, ctx))
        }
      }
    }
    particlesRef.current = ps

    const onMove = (e: MouseEvent) => {
      const r = canvas!.getBoundingClientRect()
      mouseRef.current.x = e.clientX - r.left
      mouseRef.current.y = e.clientY - r.top
    }
    const onLeave = () => { mouseRef.current.x = -9999; mouseRef.current.y = -9999 }
    canvas!.addEventListener('mousemove', onMove)
    canvas!.addEventListener('mouseleave', onLeave)

    if (animRef.current) cancelAnimationFrame(animRef.current)
    const animate = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particlesRef.current) p.update(mouseRef.current)
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    }
    img.src = url
    }

    const ro = new ResizeObserver(() => init())
    ro.observe(wrap)
    init()

    return () => {
      ro.disconnect()
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px', background: 'linear-gradient(145deg,#f9fafb,#eef4f5)', fontFamily: FONT }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#b0bec5', textTransform: 'uppercase', margin: 0 }}>
        This Could Be You
      </p>

      <div ref={wrapRef} style={{ width: '100%', flex: '1 1 0', minHeight: 0, maxHeight: 'calc(100% - 200px)', cursor: 'crosshair' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ textAlign: 'center', width: '100%' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 18px', lineHeight: 1.5 }}>
          Sign up to find fresh remote jobs,<br />from all over the world.
        </p>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px', minHeight: 22, letterSpacing: 0.2 }}>
          {tagline}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => { window.location.href = `${API_BASE}/oauth/linkedin` }}
          style={{ width: '100%', background: 'white', color: '#333', border: '1px solid #d1d5db', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077B5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          Continue with LinkedIn
        </button>
        <button
          onClick={onSignUp}
          style={{ width: '100%', background: TEAL, color: 'white', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#245460'; e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(48,103,112,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.background = TEAL; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
        >
          Sign Up Free
        </button>
        <button
          onClick={onSignIn}
          style={{ width: '100%', background: 'transparent', color: TEAL, border: `2px solid ${TEAL}`, borderRadius: 12, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, transition: 'background 0.2s, color 0.2s, transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = TEAL; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(48,103,112,0.25)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TEAL; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
        >
          Sign In
        </button>
        </div>
      </div>
    </div>
  )
}

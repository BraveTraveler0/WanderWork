import { useRef, useEffect, useState } from 'react'

const TEAL = '#306770'
const FONT = 'Manrope, sans-serif'

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
      <!-- Head: wide at cranium/forehead, rounded chin, no sharp points -->
      <path d="M50 3
        C 70 3, 76 13, 74 25
        C 72 36, 65 43, 59 49
        C 56 52, 53 54, 50 54
        C 47 54, 44 52, 41 49
        C 35 43, 28 36, 26 25
        C 24 13, 30 3, 50 3 Z" fill="black"/>
      <!-- Ears: small, at cheekbone level -->
      <ellipse cx="74.5" cy="27" rx="3" ry="5" fill="black"/>
      <ellipse cx="25.5" cy="27" rx="3" ry="5" fill="black"/>
      <!-- Neck: broad and flows naturally from chin -->
      <path d="M42 51 Q42 62 42 65 L58 65 Q58 62 58 51 Z" fill="black"/>
      <!-- Shoulders: smooth S-curve, moderate width -->
      <path d="M50 64
        C 46 64, 29 69, 14 83
        L 11 130 L 89 130 L 86 83
        C 71 69, 54 64, 50 64 Z" fill="black"/>
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
        <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 8px', lineHeight: 1.5 }}>
          Sign up to find fresh remote jobs,<br />from all over the world.
        </p>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px', minHeight: 22, letterSpacing: 0.2 }}>
          {tagline}
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  )
}

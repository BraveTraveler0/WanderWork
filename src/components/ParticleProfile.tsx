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

    // Draw silhouette to offscreen canvas then extract pixel positions
    const off = document.createElement('canvas')
    off.width = W; off.height = H
    const oc = off.getContext('2d')!
    oc.fillStyle = 'black'

    const cx = W / 2
    const headR = W * 0.21
    const headY = H * 0.20

    oc.beginPath()
    oc.ellipse(cx, headY, headR * 0.88, headR, 0, 0, Math.PI * 2)
    oc.fill()

    oc.beginPath()
    oc.ellipse(cx - headR * 0.84, headY + headR * 0.05, headR * 0.13, headR * 0.2, 0, 0, Math.PI * 2)
    oc.fill()
    oc.beginPath()
    oc.ellipse(cx + headR * 0.84, headY + headR * 0.05, headR * 0.13, headR * 0.2, 0, 0, Math.PI * 2)
    oc.fill()

    const neckW = headR * 0.38
    const neckTop = headY + headR * 0.82
    const neckBot = headY + headR * 1.45
    oc.beginPath()
    oc.rect(cx - neckW, neckTop, neckW * 2, neckBot - neckTop)
    oc.fill()

    const bw = W * 0.46
    const bTop = neckBot - headR * 0.1
    oc.beginPath()
    oc.moveTo(cx - bw * 0.3, bTop)
    oc.bezierCurveTo(cx - bw * 0.3, bTop, cx - bw * 0.55, bTop + H * 0.04, cx - bw, bTop + H * 0.12)
    oc.bezierCurveTo(cx - bw * 1.02, bTop + H * 0.15, cx - bw * 0.98, H * 0.82, cx - bw * 0.85, H * 0.82)
    oc.lineTo(cx + bw * 0.85, H * 0.82)
    oc.bezierCurveTo(cx + bw * 0.98, H * 0.82, cx + bw * 1.02, bTop + H * 0.15, cx + bw, bTop + H * 0.12)
    oc.bezierCurveTo(cx + bw * 0.55, bTop + H * 0.04, cx + bw * 0.3, bTop, cx + bw * 0.3, bTop)
    oc.closePath()
    oc.fill()

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

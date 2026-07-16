// @ts-nocheck
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import imgMountainMan from "figma:asset/c8a0a7b242b87c734d608cc38bf5905fcecbaab2.png"
import imgResume from "figma:asset/2890a7a8c8afb2cc555fd4678906a4a8fb182a00.png"
import imgRedCard from "figma:asset/3a56fc983239f488827221e78f490233bde36cce.png"
import imgAi from "figma:asset/f9cf20d34e838e53101a46e264f45e47b19f2e3f.png"
import imgFreelanceBeach from "figma:asset/bd1dfdd1f7541a99c130874e76da6fe27ad072ff.png"
import imgBeachComputer from "figma:asset/17f56f62fc64ae1bb34eb9d3cd457cef5c9b04c3.png"
import imgInfo from "figma:asset/b77769ec45f67a7fc46c76c3b542ca2b919fc9b1.png"

const FONT = 'Manrope, sans-serif'
const TEAL = '#306770'
const YELLOW = '#fade3e'
const GREY = '#787878'

const FAQS = [
  {
    q: 'Where do jobs come from?',
    a: 'We scan job boards, company career pages, and hiring platforms daily. Every listing is filtered for remote roles that match your skills and target titles. No manual searching required.',
  },
  {
    q: 'Is it free to start?',
    a: 'Yes. Sign up and start receiving daily remote job matches at no cost. Premium unlocks higher token limits, unlimited AI document generation, and expanded recruiter outreach.',
  },
  {
    q: 'How does outreach work?',
    a: 'Our AI drafts personalized emails to recruiters on your behalf. You review each message before it sends so you stay in control. We handle the legwork so you collect the replies.',
  },
  {
    q: 'Why are recruiters a superpower?',
    a: 'Recruiters find jobs for you. That\'s literally their job. Connect with ones in your field and let them bring the opportunities straight to you, instead of spending hours searching yourself.',
  },
  {
    q: 'Will my resume beat ATS?',
    a: 'Yes. Our AI reads each job description and rewrites your resume with the exact keywords ATS systems screen for. Over 90% of companies filter applicants through ATS before a human ever sees the application.',
  },
  {
    q: 'What jobs do you source?',
    a: 'We focus exclusively on remote and location-flexible roles across tech, design, marketing, ops, finance, and more. Every listing is verified to be genuinely remote. No bait-and-switch.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Tammy W.',
    role: 'Marketing Director',
    rating: 4.6,
    quote: '"The AI matched me with roles I actually wanted. Landed 3 interviews in my first week."',
    initials: 'TW',
    color: '#8b5e3c',
  },
  {
    name: 'James L.',
    role: 'Software Engineer',
    rating: 4.8,
    quote: '"I finally stopped guessing what recruiters want. Recruiter replies started coming in within days."',
    initials: 'JL',
    color: TEAL,
  },
  {
    name: 'David K.',
    role: 'Product Designer',
    rating: 5.0,
    quote: '"From application to offer in 3 weeks. The ATS resume optimization is a game-changer."',
    initials: 'DK',
    color: '#4a7fa5',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          gap: '12px',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', fontFamily: FONT }}>{q}</span>
        <span style={{ flexShrink: 0, color: TEAL, fontSize: 18, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>
          &#8964;
        </span>
      </button>
      {open && (
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.7', paddingBottom: '16px', fontFamily: FONT }}>
          {a}
        </p>
      )}
    </div>
  )
}

function FAQItemGlass({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      animate={{ backgroundColor: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)' }}
      transition={{ duration: 0.25 }}
      style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)', overflow: 'hidden' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', gap: 12, textAlign: 'left' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: 'white', fontFamily: FONT }}>{q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ flexShrink: 0, color: 'rgba(255,255,255,0.7)', fontSize: 18, display: 'inline-block' }}
        >
          &#8964;
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, padding: '0 18px 16px', fontFamily: FONT, margin: 0 }}>
          {a}
        </p>
      </motion.div>
    </motion.div>
  )
}

export default function MobileLanding({ onSignIn, onSignUp }: { onSignIn?: () => void; onSignUp?: () => void }) {
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 390)

  useEffect(() => {
    const updateLayout = () => {
      setViewportWidth(window.innerWidth)
      setIsTablet(window.innerWidth >= 768)
    }
    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  const testimonialTint = viewportWidth >= 1024
    ? 0.38
    : viewportWidth >= 768
      ? 0.58
      : viewportWidth >= 560
        ? 0.76
        : 0.94

  return (
    <div style={{ fontFamily: FONT, background: '#FAFAFA', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(220,224,230,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontWeight: 700, fontSize: '20px', letterSpacing: '3px', color: TEAL, margin: 0 }}>
            WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
          </p>
          <span style={{ fontSize: 9, fontWeight: 500, color: '#AAAAAA', background: 'transparent', border: '1px solid #DCDCDC', borderRadius: 5, padding: '1px 6px', letterSpacing: 0.5 }}>BETA</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onSignIn} style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '10px', color: TEAL, background: 'transparent', border: `2px solid ${TEAL}`, cursor: 'pointer', fontFamily: FONT }}>
            Sign In
          </button>
          <button onClick={onSignUp} style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '10px', color: 'white', background: TEAL, border: 'none', cursor: 'pointer', fontFamily: FONT }}>
            Sign Up
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', padding: isTablet ? '28px 28px 128px' : 0 }}>
        {/* Mountain image */}
        <motion.div
          whileHover={isTablet ? { scale: 1.006 } : undefined}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            height: isTablet ? '520px' : '300px',
            overflow: 'hidden',
            position: 'relative',
            maxWidth: isTablet ? 940 : undefined,
            margin: isTablet ? '0 auto' : undefined,
            borderRadius: isTablet ? 26 : 0,
            background: isTablet ? '#eef5f7' : undefined,
            boxShadow: isTablet ? '0 28px 80px rgba(37, 45, 51, 0.16)' : undefined,
          }}
        >
          <img
            src={imgMountainMan}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: isTablet ? 'contain' : 'cover',
              objectPosition: isTablet ? 'center center' : 'center top',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: isTablet
                ? 'linear-gradient(to right, rgba(250,250,250,0) 0%, rgba(250,250,250,0.18) 56%, rgba(250,250,250,0.78) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 30%, #FAFAFA 100%)',
            }}
          />

          {/* "Escape the 9-5 Rat Race" glass card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            style={{
              position: 'absolute',
              bottom: isTablet ? 28 : 20,
              left: isTablet ? 'clamp(22px, 5vw, 52px)' : 16,
              right: isTablet ? 'auto' : 16,
              width: isTablet ? 'min(38%, 340px)' : undefined,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
              borderRadius: 16, padding: '14px 18px',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: isTablet ? 'pointer' : 'default',
              willChange: isTablet ? 'transform' : undefined,
            }}
          >
            <p style={{ color: 'white', fontSize: 17, fontWeight: 600, margin: 0 }}>Escape the 9-5 Rat Race</p>
            <span style={{ color: YELLOW, fontSize: 20 }}>★</span>
          </motion.div>
        </motion.div>

        {/* Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          style={{
            padding: isTablet ? '28px 30px 30px' : '24px 24px 8px',
            textAlign: isTablet ? 'left' : 'center',
            position: isTablet ? 'absolute' : 'relative',
            top: isTablet ? 78 : undefined,
            right: isTablet ? 'clamp(44px, 7vw, 92px)' : undefined,
            width: isTablet ? 'min(43%, 420px)' : undefined,
            borderRadius: isTablet ? 24 : undefined,
            background: isTablet ? 'rgba(255,255,255,0.92)' : undefined,
            backdropFilter: isTablet ? 'blur(14px)' : undefined,
            boxShadow: isTablet ? '0 24px 70px rgba(0,0,0,0.14)' : undefined,
            border: isTablet ? '1px solid rgba(255,255,255,0.7)' : undefined,
          }}
        >
          {/* Star rating */}
          <div style={{ display: 'flex', justifyContent: isTablet ? 'flex-start' : 'center', alignItems: 'center', gap: 4, marginBottom: isTablet ? 14 : 18 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} style={{ color: YELLOW, fontSize: 18 }}>★</span>
            ))}
            <span style={{ color: GREY, fontSize: 13, marginLeft: 6, fontFamily: FONT }}>Average Rating 4.94</span>
          </div>

          <h1 style={{ fontSize: isTablet ? 'clamp(42px, 5.2vw, 52px)' : 'clamp(34px, 9vw, 46px)', fontWeight: 400, lineHeight: isTablet ? 1.22 : 1.28, color: '#000', marginBottom: isTablet ? 18 : 18, fontFamily: FONT }}>
            Wander the world<br />while you work.
          </h1>
          <p style={{ fontSize: isTablet ? 14 : 15, color: GREY, lineHeight: 1.65, marginBottom: isTablet ? 22 : 28, maxWidth: 480, marginLeft: isTablet ? 0 : 'auto', marginRight: isTablet ? 0 : 'auto', fontFamily: FONT }}>
            Let us write your resume, craft your cover letter, and connect you with top recruiters. We match you with the best (and most fresh) remote jobs from all over the world, or connect you straight to recruiters in your field. Stop sending out thousands of applications and let the work come to you.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', flexDirection: isTablet ? 'row' : 'column', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <motion.button
              onClick={onSignUp}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ background: TEAL, color: 'white', fontWeight: 700, fontSize: isTablet ? 14 : 16, padding: isTablet ? '13px 18px' : '15px 24px', borderRadius: 15, border: 'none', cursor: 'pointer', width: '100%', maxWidth: isTablet ? undefined : 340, boxShadow: '0 7px 13px rgba(33,33,33,0.25)', fontFamily: FONT }}
            >
              Find Remote Work!
            </motion.button>
            <motion.button
              onClick={onSignUp}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ background: YELLOW, color: '#111', fontWeight: 700, fontSize: isTablet ? 14 : 16, padding: isTablet ? '13px 18px' : '15px 24px', borderRadius: 15, border: 'none', cursor: 'pointer', width: '100%', maxWidth: isTablet ? undefined : 340, fontFamily: FONT }}
            >
              Go Premium
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: '20px 24px 44px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div>
            <p style={{ fontSize: 34, fontWeight: 700, color: '#111', lineHeight: 1, margin: 0, fontFamily: FONT }}>92%</p>
            <p style={{ fontSize: 13, color: GREY, marginTop: 6, fontFamily: FONT }}>More Interviews</p>
          </div>
          <div>
            <p style={{ fontSize: 34, fontWeight: 700, color: '#111', lineHeight: 1, margin: 0, fontFamily: FONT }}>321</p>
            <p style={{ fontSize: 13, color: GREY, marginTop: 6, fontFamily: FONT }}>Jobs added daily</p>
          </div>
          <div>
            <p style={{ fontSize: 34, fontWeight: 700, color: '#111', lineHeight: 1, margin: 0, fontFamily: FONT }}>FREE</p>
            <p style={{ fontSize: 13, color: GREY, marginTop: 6, fontFamily: FONT }}>Get started $0</p>
          </div>
        </div>
      </section>

      {/* ── How it Works — feature cards ── */}
      <section style={{ padding: '0 20px 52px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#111', marginBottom: 24, fontFamily: FONT }}>How it Works</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { img: imgResume, text: 'Upload your resume once. No more endless edits.' },
            { img: imgRedCard, text: 'We find remote jobs from around the world and send you the jobs that match your skills automatically.' },
            { img: imgAi, text: 'AI scans job boards + rewrites your resume and cover letter with the right keywords.' },
          ].map(({ img, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.99 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              style={{ background: 'white', borderRadius: 20, padding: '28px 24px', boxShadow: '0 8px 29px rgba(0,0,0,0.09)', cursor: 'pointer', willChange: 'transform' }}
            >
              <div style={{ background: '#dfe3e6', borderRadius: 10, padding: 10, display: 'inline-flex', marginBottom: 18 }}>
                <img src={img} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#111', lineHeight: 1.5, margin: 0, fontFamily: FONT }}>{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── "Frustrated by silence?" dark section ── */}
      <section style={{ background: '#111', padding: '48px 24px', position: 'relative', overflow: 'hidden' }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '112%',
            objectFit: 'cover',
            objectPosition: 'top center',
            opacity: 0.45,
            pointerEvents: 'none',
          }}
        >
          <source src="/late-night-focus.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.82), rgba(0,0,0,0.56))', pointerEvents: 'none' }} />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <h2 style={{ fontSize: 'clamp(24px, 6vw, 34px)', fontWeight: 700, color: 'white', lineHeight: 1.3, marginBottom: 18, fontFamily: FONT }}>
            Frustrated by silence after applying?
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 28, fontFamily: FONT }}>
            Let recruiters come to you. Get their direct contact info and AI-crafted outreach emails, ready to send in seconds. No cold applying required.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.12)', display: 'inline-block' }}>
            <p style={{ color: 'white', fontSize: 16, margin: 0, fontFamily: FONT }}>
              Job search cut from <strong>hours a day → minutes a day.</strong>
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── "Stop wasting hours" section ── */}
      <section style={{ padding: '52px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 style={{ fontSize: 'clamp(22px, 6vw, 32px)', fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 28, fontFamily: FONT }}>
            Stop wasting hours a week applying to jobs. Apply in{' '}
            <span style={{ color: '#373c24' }}>seconds.</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 36 }}>
            {[
              'Beat the bots with keyword-optimized applications.',
              'Skip the search. New roles sent to your inbox and dashboard.',
              'Get seen. AI-tuned resumes pass Applicant Tracking System (ATS) screens.',
            ].map((text) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: TEAL, flexShrink: 0, marginTop: 7 }} />
                <p style={{ fontSize: 16, color: GREY, lineHeight: 1.65, margin: 0, fontFamily: FONT }}>{text}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onSignUp}
              style={{ background: TEAL, color: 'white', fontWeight: 600, fontSize: 15, padding: '14px 20px', borderRadius: 15, border: 'none', cursor: 'pointer', flex: 1, fontFamily: FONT }}
            >
              Get My Daily Matches
            </button>
            <button
              style={{ background: '#dfe3e6', color: '#111', fontWeight: 600, fontSize: 15, padding: '14px 20px', borderRadius: 15, border: 'none', cursor: 'pointer', flex: 1, fontFamily: FONT }}
            >
              Learn More
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Beach FAQ section ── */}
      <section style={{ position: 'relative', overflow: 'hidden', margin: '0 20px', borderRadius: 24 }}>
        {/* Background image */}
        <img
          src={imgFreelanceBeach}
          alt=""
          style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: '112%', objectFit: 'cover', objectPosition: 'top center' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.72) 100%)' }} />

        {/* FAQ content overlaid on image */}
        <div style={{ position: 'relative', zIndex: 1, padding: '40px 20px 44px' }}>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: 'clamp(24px, 6vw, 34px)', fontWeight: 800, color: 'white', marginBottom: 24, fontFamily: FONT, textAlign: 'center' }}
          >
            FAQ
          </motion.h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQS.map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <FAQItemGlass q={faq.q} a={faq.a} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: isTablet ? '72px 28px 92px' : '56px 20px 76px', background: TEAL, position: 'relative', overflow: 'hidden', marginTop: 32 }}>
        {isTablet && (
          <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}>
            <source src="/ResumeRain.mp4" type="video/mp4" />
          </video>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(48, 103, 112, ${testimonialTint})`,
            pointerEvents: 'none',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          style={{ position: 'relative', zIndex: 1, maxWidth: isTablet ? 1180 : undefined, margin: isTablet ? '0 auto' : undefined }}
        >
          <h2 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 700, color: 'white', marginBottom: 28, fontFamily: FONT }}>
            People are finding jobs.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.99 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                style={{ background: 'white', borderRadius: 20, padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer', willChange: 'transform' }}
              >
                <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.7, marginBottom: 20, fontStyle: 'italic', fontFamily: FONT }}>
                  {t.quote}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {t.initials}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2, fontFamily: FONT }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4, fontFamily: FONT }}>{t.role}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: YELLOW, fontSize: 14 }}>★</span>
                      <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: FONT }}>{t.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>


      {/* ── CTA — beach computer image ── */}
      <section style={{ padding: isTablet ? '36px 0 64px' : '28px 0 52px' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div style={{ position: 'relative', height: isTablet ? 360 : 300, overflow: 'hidden', margin: '0 20px', borderRadius: 20 }}>
            <img src={imgBeachComputer} alt="" style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: '108%', objectFit: 'cover', objectPosition: 'top center' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)', borderRadius: 20 }} />
          </div>
          <div style={{ margin: '0 20px', marginTop: isTablet ? -42 : -34, position: 'relative', zIndex: 1, perspective: 800 }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-4px)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
              <h3 style={{ fontSize: 'clamp(22px, 5.5vw, 30px)', fontWeight: 800, color: '#111', lineHeight: 1.25, marginBottom: 14, fontFamily: FONT }}>
                Find the hottest remote jobs all over the world.
              </h3>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.65, marginBottom: 24, fontFamily: FONT }}>
                We surface remote roles from across the web and deliver the ones that match, straight to your dashboard.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <motion.button
                  onClick={onSignUp}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  style={{ background: TEAL, color: 'white', fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 15, border: 'none', cursor: 'pointer', boxShadow: '0 7px 13px rgba(33,33,33,0.25)', fontFamily: FONT }}
                >
                  Get Started for Free!
                </motion.button>
                <motion.button
                  onClick={onSignUp}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  style={{ background: YELLOW, color: '#111', fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 15, border: 'none', cursor: 'pointer', fontFamily: FONT }}
                >
                  Go Premium
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.8)' }}>
        <p style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '3px', color: TEAL, marginBottom: 16, fontFamily: FONT }}>
          WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
          <a href="#" style={{ fontSize: 13, color: TEAL, textDecoration: 'none', fontFamily: FONT }}>Privacy Policy</a>
          <a href="#" style={{ fontSize: 13, color: TEAL, textDecoration: 'none', fontFamily: FONT }}>Terms of Service</a>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: FONT }}>© 2026 Wander/Work, Inc.</p>
      </footer>
    </div>
  )
}

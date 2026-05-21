import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FEATURES = [
  {
    emoji: '\u{1F50D}',
    title: 'AI-Powered Job Search',
    desc: 'We scan thousands of job boards daily and surface remote roles that match your skills — no searching required.',
  },
  {
    emoji: '\u{1F4AC}',
    title: 'Daily Inbox Delivery',
    desc: 'Get a curated list of matching jobs delivered to your dashboard every morning. Never miss a good fit again.',
  },
  {
    emoji: '\u{1F4DD}',
    title: 'ATS-Optimized Resumes',
    desc: 'Our AI rewrites your resume for each application, injecting the exact keywords ATS systems scan for.',
  },
  {
    emoji: '\u{2709}\u{FE0F}',
    title: 'Recruiter Outreach',
    desc: 'AI drafts personalized emails to recruiters on your behalf. You review each one before it sends.',
  },
]

const FAQS = [
  {
    q: 'Where do jobs come from?',
    a: 'We scan job boards, company career pages, and hiring platforms daily. Every listing is filtered for remote roles that match your profile — no manual searching required.',
  },
  {
    q: 'Is it free to start?',
    a: 'Yes — sign up and start receiving daily remote job matches at no cost. Premium unlocks higher token limits, unlimited AI document generation, and expanded recruiter outreach.',
  },
  {
    q: 'How does outreach work?',
    a: 'Our AI drafts personalized emails to recruiters on your behalf. You review each message before it sends so you stay in control. We handle the legwork — you collect the replies.',
  },
  {
    q: 'What are tokens?',
    a: 'Tokens are credits that power our AI tools — resume tailoring, cover letter generation, and recruiter emails each use a small amount. Free accounts get a monthly allowance; Premium plans include far more.',
  },
  {
    q: 'Will my resume beat ATS?',
    a: 'Yes. Our AI reads each job description and rewrites your resume with the exact keywords ATS systems screen for. Over 90% of companies filter applicants through ATS before a human ever sees the application.',
  },
  {
    q: 'What jobs do you source?',
    a: 'We focus exclusively on remote and location-flexible roles across tech, design, marketing, ops, finance, and more. Every listing is verified to be genuinely remote — no bait-and-switch.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Tammy W.',
    role: 'Marketing Director',
    rating: 4.6,
    quote: 'The AI matched me with roles I actually wanted. Landed 3 interviews in my first week.',
    initials: 'TW',
    color: '#8b5e3c',
  },
  {
    name: 'James L.',
    role: 'Software Engineer',
    rating: 4.8,
    quote: 'Recruiter replies started coming in within days. Such a timesaver.',
    initials: 'JL',
    color: '#306770',
  },
  {
    name: 'David K.',
    role: 'Product Designer',
    rating: 5.0,
    quote: 'From application to offer in 3 weeks. The ATS optimization is a game-changer.',
    initials: 'DK',
    color: '#4a7fa5',
  },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: '#FCE03D', fontSize: '15px' }}>&#9733;</span>
      <span style={{ fontSize: '13px', color: '#9ca3af' }}>{rating.toFixed(1)}</span>
    </div>
  )
}

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
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', fontFamily: 'Manrope, sans-serif' }}>{q}</span>
        <ChevronDown
          size={18}
          style={{
            flexShrink: 0,
            color: '#306770',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      {open && (
        <p
          style={{
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.7',
            paddingBottom: '16px',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          {a}
        </p>
      )}
    </div>
  )
}

export default function MobileLanding({ onSignIn, onSignUp }: { onSignIn?: () => void; onSignUp?: () => void }) {
  return (
    <div style={{ fontFamily: 'Manrope, sans-serif', background: '#FAFAFA', minHeight: '100vh' }}>
      {/* Sticky Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(220,224,230,0.8)',
        }}
      >
        <p style={{ fontWeight: 700, fontSize: '20px', letterSpacing: '3px', color: '#306770', margin: 0 }}>
          WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onSignIn}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: '10px',
              color: '#306770',
              border: '1.5px solid #306770',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            Sign In
          </button>
          <button
            onClick={onSignUp}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: '10px',
              color: 'white',
              background: '#306770',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          padding: '56px 24px 64px',
          textAlign: 'center',
          background: 'linear-gradient(160deg, #ffffff 0%, #edf3f4 100%)',
        }}
      >
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#306770',
            opacity: 0.65,
            marginBottom: '16px',
          }}
        >
          Remote Job Discovery
        </p>
        <h1
          style={{
            fontSize: 'clamp(30px, 7vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.2,
            color: '#111827',
            marginBottom: '20px',
          }}
        >
          Daily remote jobs,{' '}
          <span style={{ color: '#306770' }}>matched to you.</span>
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 3vw, 18px)',
            color: '#6b7280',
            lineHeight: 1.7,
            marginBottom: '32px',
            maxWidth: '500px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          We surface remote roles from across the web and deliver the ones that match — straight to your dashboard. Free to start.
        </p>
        <button
          onClick={onSignUp}
          style={{
            display: 'inline-block',
            fontWeight: 700,
            color: 'white',
            fontSize: '16px',
            padding: '16px 32px',
            borderRadius: '15px',
            background: '#306770',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(48,103,112,0.35)',
            marginBottom: '12px',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          Start Receiving Matches
        </button>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>No credit card required</p>
      </section>

      {/* Features */}
      <section style={{ padding: '52px 20px' }}>
        <h2
          style={{
            fontSize: 'clamp(22px, 5vw, 30px)',
            fontWeight: 800,
            textAlign: 'center',
            color: '#111827',
            marginBottom: '32px',
          }}
        >
          How it works
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            maxWidth: '680px',
            margin: '0 auto',
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: '30px', marginBottom: '12px' }}>{f.emoji}</div>
              <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#111827', marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '52px 20px', background: '#edf3f4' }}>
        <h2
          style={{
            fontSize: 'clamp(22px, 5vw, 30px)',
            fontWeight: 800,
            textAlign: 'center',
            color: '#111827',
            marginBottom: '32px',
          }}
        >
          People are finding jobs
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            maxWidth: '720px',
            margin: '0 auto',
          }}
        >
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  color: '#4b5563',
                  lineHeight: 1.7,
                  marginBottom: '20px',
                  fontStyle: 'italic',
                }}
              >
                "{t.quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: t.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>{t.name}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>{t.role}</p>
                  <StarRating rating={t.rating} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '52px 20px' }}>
        <h2
          style={{
            fontSize: 'clamp(22px, 5vw, 30px)',
            fontWeight: 800,
            textAlign: 'center',
            color: '#111827',
            marginBottom: '32px',
          }}
        >
          FAQ's
        </h2>
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            background: 'white',
            borderRadius: '20px',
            padding: '8px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          background: 'linear-gradient(160deg, #306770 0%, #1d4f57 100%)',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(24px, 6vw, 34px)',
            fontWeight: 800,
            color: 'white',
            marginBottom: '16px',
          }}
        >
          Ready to find your next role?
        </h2>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', marginBottom: '32px', lineHeight: 1.6 }}>
          Join thousands of remote job seekers who get matched daily.
        </p>
        <button
          onClick={onSignUp}
          style={{
            display: 'inline-block',
            fontWeight: 700,
            color: '#306770',
            fontSize: '16px',
            padding: '16px 32px',
            borderRadius: '15px',
            background: '#fade3e',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          Get Started Free
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px', textAlign: 'center', background: '#1d4f57' }}>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', letterSpacing: '2px', marginBottom: '12px' }}>
          WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '12px' }}>
          <button style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Privacy
          </button>
          <button style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Terms
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>© 2026 Wander/Work, Inc.</p>
      </footer>
    </div>
  )
}

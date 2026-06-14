import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Check, ChevronDown, X } from 'lucide-react'
import { createCheckoutSession, createTokenCheckoutSession, type Plan as StripePlan } from '../api/stripe'

const LS_URLS: Record<string, string> = {
  tokens: import.meta.env.VITE_LS_TOKENS_URL || '',
  pro: import.meta.env.VITE_LS_PRO_URL || '',
  premium: import.meta.env.VITE_LS_PREMIUM_URL || '',
}

const PADDLE_URLS: Record<string, string> = {
  tokens: import.meta.env.VITE_PADDLE_TOKENS_URL || '',
  pro: import.meta.env.VITE_PADDLE_PRO_URL || '',
  premium: import.meta.env.VITE_PADDLE_PREMIUM_URL || '',
}

function PaymentModal({ planKey, onClose, onStripe }: {
  planKey: string
  onClose: () => void
  onStripe: () => void
}) {
  const options = [
    {
      key: 'stripe',
      label: 'Credit / Debit Card',
      sub: 'Powered by Stripe',
      available: true,
      onClick: () => { onClose(); onStripe() },
    },
    {
      key: 'lemonsqueezy',
      label: 'Lemon Squeezy',
      sub: 'Cards, PayPal, and more',
      available: !!LS_URLS[planKey],
      onClick: () => { onClose(); window.open(LS_URLS[planKey], '_blank') },
    },
    {
      key: 'paddle',
      label: 'Paddle',
      sub: 'Cards and local payment methods',
      available: !!PADDLE_URLS[planKey],
      onClick: () => { onClose(); window.open(PADDLE_URLS[planKey], '_blank') },
    },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, padding: '32px 28px',
          width: 360, boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}
        >
          <X size={18} />
        </button>
        <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 18, color: '#306770', marginBottom: 6 }}>
          Choose payment method
        </h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Select how you'd like to complete your purchase.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={opt.available ? opt.onClick : undefined}
              disabled={!opt.available}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '14px 18px', borderRadius: 12, border: '1.5px solid #E4E4E4',
                background: opt.available ? '#fff' : '#F9F9F9',
                cursor: opt.available ? 'pointer' : 'not-allowed',
                opacity: opt.available ? 1 : 0.45,
                transition: 'border-color 0.2s, background 0.2s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (opt.available) (e.currentTarget as HTMLButtonElement).style.borderColor = '#63B08D' }}
              onMouseLeave={(e) => { if (opt.available) (e.currentTarget as HTMLButtonElement).style.borderColor = '#E4E4E4' }}
            >
              <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#306770' }}>{opt.label}</span>
              <span style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {opt.available ? opt.sub : 'Not configured yet'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

interface Plan {
  name: string
  price: number
  period: string
  description: string
  features: string[]
  cta: string
  popular?: boolean
  badge?: string
  highlight?: string
  stripePlan?: StripePlan
}

const faqs = [
  {
    q: 'Can I change my plan anytime?',
    a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle.'
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a 7-day free trial for Premium. No credit card required to start.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards, PayPal, and bank transfers for annual plans.'
  },
  {
    q: 'Do you offer annual plans?',
    a: 'Yes! Annual plans come with 2 months free (17% discount). Contact support for custom pricing.'
  }
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        obs.disconnect()
      }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

const PREMIUM_GRADIENT = 'linear-gradient(135deg, #112e33 0%, #1e5560 55%, #306770 100%)'

function PlanCard({ plan, index, pageVisible, onCheckout, loading }: {
  plan: Plan
  index: number
  pageVisible: boolean
  onCheckout: () => void
  loading: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const isPaid = Boolean(plan.stripePlan)
  const delay = 200 + index * 120

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: pageVisible ? 1 : 0,
        transform: pageVisible
          ? hovered ? 'translateY(-8px) scale(1.01)' : isPaid ? 'translateY(-4px)' : 'translateY(0)'
          : 'translateY(32px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)`,
        background: '#FFFFFF',
        border: isPaid ? 'none' : '1.5px solid #E4E4E4',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: hovered
          ? '0 32px 72px rgba(17,46,51,0.22)'
          : isPaid
          ? '0 20px 56px rgba(17,46,51,0.16)'
          : '0 12px 40px rgba(0,0,0,0.07)',
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column' as const,
        cursor: 'default',
      }}
    >
      {isPaid ? (
        /* Paid plan — dark gradient header */
        <>
          <div style={{ background: PREMIUM_GRADIENT, padding: '28px 28px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ position: 'absolute', bottom: -12, left: 24, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            {plan.badge && (
              <div style={{ background: 'rgba(255,255,255,0.13)', color: '#9ecfd6', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.6px', marginBottom: 14, width: 'fit-content', position: 'relative' }}>
                {plan.badge}
              </div>
            )}
            <h2 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 24, color: '#fff', marginBottom: 4, position: 'relative', letterSpacing: '-0.3px' }}>
              {plan.name}
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(180,215,220,0.85)', marginBottom: 18, position: 'relative', lineHeight: 1.5 }}>
              {plan.description}
            </p>
            <div style={{ marginBottom: 20, position: 'relative' }}>
              <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 44, color: '#fff', lineHeight: 1 }}>${plan.price}</span>
              <span style={{ fontSize: 13, color: 'rgba(180,215,220,0.7)', marginLeft: 5 }}>{plan.period}</span>
            </div>
            <button
              onClick={onCheckout}
              disabled={loading}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 11,
                fontWeight: 700, fontSize: 14, fontFamily: 'Manrope',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.22)',
                letterSpacing: '0.2px',
                position: 'relative',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
            >
              {loading ? 'Redirecting...' : plan.cta}
            </button>
          </div>
          <div style={{ padding: '20px 28px 28px', flex: 1 }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {plan.features.map((feature) => (
                <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#4B6A73' }}>
                  <Check size={15} style={{ color: '#63B08D', flexShrink: 0, marginTop: 1 }} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        /* Free plan — plain white card */
        <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h2 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 26, color: '#306770', marginBottom: 6 }}>
            {plan.name}
          </h2>
          <p style={{ fontSize: 13, color: '#7A7A7A', marginBottom: 24, minHeight: 20 }}>
            {plan.description}
          </p>
          <div style={{ marginBottom: 28 }}>
            <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 50, color: '#306770', lineHeight: 1 }}>${plan.price}</span>
            <span style={{ fontSize: 13, color: '#7A7A7A', marginLeft: 4 }}>{plan.period}</span>
          </div>
          <button
            onClick={onCheckout}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12,
              fontWeight: 700, fontSize: 14, fontFamily: 'Manrope',
              cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 28,
              opacity: loading ? 0.65 : 1,
              background: '#FFFFFF', color: '#306770', border: '1.5px solid #BFC8CC',
              letterSpacing: '0.3px', transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#306770' } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#BFC8CC' }}
          >
            {loading ? 'Redirecting...' : plan.cta}
          </button>
          <div style={{ height: 1, background: '#F0F0F0', marginBottom: 24 }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.features.map((feature) => (
              <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#4B6A73' }}>
                <Check size={15} style={{ color: '#63B08D', flexShrink: 0, marginTop: 1 }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FaqItem({ item, index, visible }: { item: { q: string; a: string }; index: number; visible: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${index * 80}ms, transform 0.5s ease ${index * 80}ms`,
        background: '#FFFFFF',
        border: '1px solid #DCDCDC',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#306770' }}>
          {item.q}
        </span>
        <ChevronDown
          size={18}
          style={{
            color: '#306770',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
          }}
        />
      </button>
      <div
        style={{
          maxHeight: open ? 200 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <p style={{ padding: '0 24px 20px', fontSize: 14, color: '#787878', lineHeight: 1.7 }}>
          {item.a}
        </p>
      </div>
    </div>
  )
}


const PlansPage = ({
  onBack,
  userEmail,
  onSignUp,
  onSignIn,
}: {
  onBack?: () => void
  userEmail?: string
  onSignUp?: () => void
  onSignIn?: () => void
}) => {
  const isGuest = !userEmail
  const [pageVisible, setPageVisible] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<StripePlan | 'tokens' | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ planKey: string; stripePlan?: StripePlan } | null>(null)
  const faqSection = useInView(0.1)

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setTimeout(() => setPageVisible(true), 60)
    })
    return () => cancelAnimationFrame(t)
  }, [])

  const handleStripeCheckout = async (plan: StripePlan | 'tokens') => {
    if (!userEmail && onSignUp) { onSignUp(); return }
    setCheckoutLoading(plan)
    setCheckoutError(null)
    try {
      const url = plan === 'tokens'
        ? await createTokenCheckoutSession(3, userEmail || '')
        : await createCheckoutSession(plan, userEmail || '')
      window.location.href = url
    } catch (err: any) {
      setCheckoutError(err?.message || 'Could not start checkout. Please try again.')
      setCheckoutLoading(null)
    }
  }

  const openPaymentModal = (planKey: string, stripePlan?: StripePlan) => {
    if (!userEmail && onSignUp) { onSignUp(); return }
    setPaymentModal({ planKey, stripePlan })
  }

  const plans: Plan[] = [
    {
      name: 'Free Plan',
      price: 1,
      period: '/ per 3 tokens',
      description: 'Only pay for what you need.',
      features: ['Token-based usage', 'No monthly commitment', 'Flexible as you grow'],
      cta: 'Get Tokens',
    },
    {
      name: 'Pro',
      price: 19,
      period: '/ mo',
      description: 'Our most popular plan for active job seekers.',
      features: ['100 tokens per month', '20 recruiter emails/day', 'Priority matching', 'AI resume tailoring', 'Cover letter generator'],
      cta: 'Go Pro',
      popular: true,
      badge: 'Most Popular',
      stripePlan: 'pro',
    },
    {
      name: 'Premium',
      price: 49,
      period: '/ mo',
      description: 'Maximum tools for serious career growth.',
      features: ['200 tokens per month', '30 recruiter emails/day', 'Everything in Pro', 'Career coach access', 'Interview prep'],
      cta: 'Go Premium',
      stripePlan: 'premium',
    },
  ]

  return (
    <>
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(145.48deg, #FFFFFF 1.38%, #F4F4F4 99.61%)',
        opacity: pageVisible ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 0 0',
            marginBottom: 0,
          }}
        >
          {/* cspell:disable-next-line */}
          <h1
            style={{
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 24,
              color: '#306770',
              letterSpacing: '3.6px',
              cursor: onBack ? 'pointer' : 'default',
            }}
            onClick={onBack}
          >
            WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
          </h1>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onBack && (
              <>
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
                    transition: 'all 0.2s ease',
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
                  <ArrowLeft size={15} />
                  {isGuest ? 'Back to Home' : 'Dashboard'}
                </button>
                {isGuest && (
                  <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                    <button
                      onClick={onSignIn}
                      style={{
                        padding: '7px 16px', borderRadius: 8, background: 'none',
                        border: '2px solid #306770', cursor: 'pointer', color: '#306770',
                        fontSize: 13, fontFamily: 'Manrope', fontWeight: 600, transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#306770'; e.currentTarget.style.color = '#fff' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#306770' }}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={onSignUp}
                      style={{
                        padding: '8px 18px', borderRadius: 8, background: '#306770',
                        border: 'none', cursor: 'pointer', color: '#fff',
                        fontSize: 13, fontFamily: 'Manrope', fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(48,103,112,0.3)', transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#245460' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#306770' }}
                    >
                      Sign Up Free
                    </button>
                  </div>
                )}
              </>
            )}
          </nav>
        </header>

        {/* Hero */}
        <div
          style={{
            textAlign: 'center',
            padding: '64px 0 56px',
            opacity: pageVisible ? 1 : 0,
            transform: pageVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 100ms, transform 0.6s ease 100ms',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(99,176,141,0.12)',
              color: '#306770',
              borderRadius: 99,
              padding: '5px 18px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '1px',
              fontFamily: 'Manrope',
              marginBottom: 20,
            }}
          >
            SIMPLE PRICING
          </div>
          <h2
            style={{
              fontFamily: 'Manrope',
              fontWeight: 800,
              fontSize: 42,
              color: '#306770',
              marginBottom: 14,
              lineHeight: 1.15,
            }}
          >
            Choose the plan that's right for you
          </h2>
          <p style={{ fontSize: 16, color: '#787878', maxWidth: 480, margin: '0 auto' }}>
            Supercharge your job search with AI-powered tools, personalized matches, and outreach support.
          </p>
        </div>

        {/* Plan Cards */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            justifyContent: 'center',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: checkoutError ? 24 : 80,
          }}
        >
          {plans.map((plan, i) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              index={i}
              pageVisible={pageVisible}
              onCheckout={() => openPaymentModal(plan.stripePlan ?? 'tokens', plan.stripePlan)}
              loading={!!checkoutLoading && checkoutLoading === (plan.stripePlan ?? 'tokens')}
            />
          ))}
        </div>

        {checkoutError && (
          <div
            style={{
              maxWidth: 480,
              margin: '0 auto 56px',
              padding: '14px 20px',
              borderRadius: 12,
              background: '#FFF0F0',
              border: '1px solid #F5C0C0',
              color: '#B91C1C',
              fontSize: 13,
              fontFamily: 'Manrope',
              textAlign: 'center',
            }}
          >
            {checkoutError}
          </div>
        )}

        {/* Social proof strip */}
        <div
          ref={undefined}
          style={{
            opacity: pageVisible ? 1 : 0,
            transform: pageVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 600ms, transform 0.6s ease 600ms',
            textAlign: 'center',
            marginBottom: 80,
          }}
        >
          <p style={{ fontSize: 13, color: '#787878', fontFamily: 'Manrope' }}>
            Trusted by{' '}
            <span style={{ color: '#306770', fontWeight: 700 }}>2,000+ job seekers</span>
            {' '}· Cancel anytime · No hidden fees
          </p>
        </div>

        {/* FAQ */}
        <div ref={faqSection.ref} style={{ maxWidth: 680, margin: '0 auto' }}>
          <h3
            style={{
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 26,
              color: '#306770',
              textAlign: 'center',
              marginBottom: 32,
              opacity: faqSection.visible ? 1 : 0,
              transform: faqSection.visible ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            Frequently Asked Questions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map((item, i) => (
              <FaqItem key={item.q} item={item} index={i} visible={faqSection.visible} />
            ))}
          </div>
        </div>

      </div>
    </div>

    {paymentModal && (
      <PaymentModal
        planKey={paymentModal.planKey}
        onClose={() => setPaymentModal(null)}
        onStripe={() => handleStripeCheckout(paymentModal!.stripePlan ?? 'tokens')}
      />
    )}
    </>
  )
}

export default PlansPage

import { motion, useMotionValue, useScroll, useSpring, useTransform, useReducedMotion } from 'motion/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import CountUp from 'react-countup';
const videoResumeRain = new URL('../ResumeRain.mp4', import.meta.url).href;
const videoLateNight = import.meta.env.VITE_LATE_NIGHT_VIDEO_URL || '';
const videoLateNightSrc = videoLateNight || videoResumeRain;

// Image assets from Figma (7-day expiration)
const imgMenu = 'https://www.figma.com/api/mcp/asset/be6c5842-59dc-4dc7-8c13-0611ab88a8ef';
const imgHero = 'https://www.figma.com/api/mcp/asset/77fe4e9b-5512-4750-bf21-1b03cfedec41';
const imgResume = 'https://www.figma.com/api/mcp/asset/3eadd910-2ebe-4ed0-b285-a8a7c1231607';
const imgRedCard = 'https://www.figma.com/api/mcp/asset/670df2bd-35bc-46f2-84cf-eda0aa260801';
const imgAi = 'https://www.figma.com/api/mcp/asset/91e82d1c-f1d7-4fe7-852c-ceed5fe1153f';
const imgIstock = 'https://www.figma.com/api/mcp/asset/50b059d0-3ebb-4801-b852-1856f77d71ca';
const imgInfo = 'https://www.figma.com/api/mcp/asset/0249f55e-be10-4aa6-89e1-655534230611';
const imgPoster = 'https://www.figma.com/api/mcp/asset/e8deeda6-3168-427e-aa98-6f79211df03d';
const imgRectangle = 'https://www.figma.com/api/mcp/asset/d3b2985f-5d76-4b00-b9c7-67c39749cf9b';
const imgBeach = 'https://www.figma.com/api/mcp/asset/a2a03643-312b-49a3-9a0b-4100b3585633';
const imgGroup28 = 'https://www.figma.com/api/mcp/asset/1315fb0a-d2eb-4f14-bf67-b2369b4807df';
const imgStar6 = 'https://www.figma.com/api/mcp/asset/11a59f1b-fd9f-40e2-9713-9caa8abe353e';
const imgStar1 = 'https://www.figma.com/api/mcp/asset/7364ec10-b25f-44e2-80e0-2b19ec8e9790';
const imgPaperChaos = 'https://www.figma.com/api/mcp/asset/2f220b59-1228-4dd9-8a89-8f94ac63f6e0';
const imgBeachLaptop = 'https://www.figma.com/api/mcp/asset/a2a03643-312b-49a3-9a0b-4100b3585633';
const imgFreelanceBeach = 'https://www.figma.com/api/mcp/asset/d7a0112a-68b1-49f2-9c3a-c44b2d53bc28';
const imgLateNight = new URL('../assets/late_night.png', import.meta.url).href;

// Animation variants
const fadeInUp = { hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0 } };
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12 } } };

type GlassmorphicBubbleProps = {
  content: React.ReactNode;
  hasScrollEntry?: boolean;
  scrollDirection?: 'left' | 'right' | null;
  scrollDelay?: number;
  parallaxY?: [number, number];
  parallaxX?: [number, number];
  mouseMultiplier?: number;
  className?: string;
  width?: string;
  height?: string;
};

type ParallaxPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  mouseMultiplier?: number;
  scaleOnHover?: number;
};

function GlassmorphicBubble({ 
  content, 
  hasScrollEntry = false,
  scrollDirection = null,
  scrollDelay = 0,
  parallaxY = [10, -10],
  parallaxX = [5, -5],
  mouseMultiplier = 15,
  className = "",
  width = "auto",
  height = "auto"
}: GlassmorphicBubbleProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 100, 
    damping: 30, 
    restDelta: 0.001 
  });
  
  const scrollY = useTransform(smoothProgress, [0, 1], parallaxY);
  const scrollX = useTransform(smoothProgress, [0, 1], parallaxX);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  const scrollAnimationProps = hasScrollEntry ? {
    initial: { 
      opacity: 0, 
      x: scrollDirection === 'left' ? -50 : scrollDirection === 'right' ? 50 : 0 
    },
    whileInView: { opacity: 1, x: 0 },
    viewport: { once: true },
    transition: { duration: 0.8, delay: scrollDelay, ease: "easeOut" }
  } : {};

  // Calculate final position with both scroll and mouse tracking
  const finalX = useTransform(() => scrollX.get() + (-mousePosition.x * mouseMultiplier));
  const finalY = useTransform(() => scrollY.get() + (-mousePosition.y * mouseMultiplier));

  return (
    <motion.div 
      ref={ref}
      className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-[20px] overflow-clip text-white ${className}`}
      style={{ width, height, x: finalX, y: finalY }}
      {...scrollAnimationProps}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {content}
    </motion.div>
  );
}


function ParallaxPanel({ className, style, children, mouseMultiplier = 12, scaleOnHover = 1.02 }: ParallaxPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [supportsParallax, setSupportsParallax] = useState(true);

  useEffect(() => {
    // Disable parallax on touch/coarse pointer devices for better mobile UX
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setSupportsParallax(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSupportsParallax(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!supportsParallax) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    setOffset({ x: dx * mouseMultiplier, y: dy * mouseMultiplier });
  };
  const onMouseLeave = () => setOffset({ x: 0, y: 0 });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, transform: supportsParallax ? `translate(${offset.x}px, ${offset.y}px)` : undefined }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      whileHover={{ scale: supportsParallax ? scaleOnHover : 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

type ParallaxHoverOptions = {
  yRange: [number, number];
  xRange: [number, number];
  mouseMultiplier?: number;
  hoverScale?: number;
};

function useParallaxHover({ yRange, xRange, mouseMultiplier = 20, hoverScale = 1.02 }: ParallaxHoverOptions) {
  const ref = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const scrollY = useTransform(smooth, [0, 1], yRange);
  const scrollX = useTransform(smooth, [0, 1], xRange);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const isHover = useMotionValue(0);

  const x = useTransform([scrollX, mouseX], (values: number[]) => {
    const [sx, mx] = values;
    return prefersReducedMotion ? 0 : sx + mx;
  });
  const y = useTransform([scrollY, mouseY], (values: number[]) => {
    const [sy, my] = values;
    return prefersReducedMotion ? 0 : sy + my;
  });
  const scale = useTransform(isHover, (h: number) => (prefersReducedMotion ? 1 : h ? hoverScale : 1));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const ny = (e.clientY - rect.top - rect.height / 2) / rect.height;
    mouseX.set(-nx * mouseMultiplier);
    mouseY.set(-ny * mouseMultiplier);
    isHover.set(1);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    isHover.set(0);
  };

  return { ref, x, y, scale, handleMouseMove, handleMouseLeave };
}

// Floating Bubbles Component
function FloatingBubbles() {
  const bubbles = [
    { size: 280, duration: 22, delay: 0, x: '5%', y: '8%' },
    { size: 350, duration: 28, delay: 2, x: '72%', y: '18%' },
    { size: 200, duration: 20, delay: 4, x: '60%', y: '60%' },
    { size: 320, duration: 25, delay: 1, x: '8%', y: '50%' },
    { size: 240, duration: 27, delay: 3, x: '75%', y: '70%' },
    { size: 360, duration: 30, delay: 1.5, x: '2%', y: '70%' },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {bubbles.map((bubble, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            width: bubble.size,
            height: bubble.size,
            left: bubble.x,
            top: bubble.y,
            background: 'radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.4), rgba(200, 230, 255, 0.15), rgba(150, 200, 255, 0.05))',
            backdropFilter: 'blur(80px)',
            WebkitBackdropFilter: 'blur(80px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: 'inset -2px -2px 8px rgba(0, 0, 0, 0.04), inset 2px 2px 8px rgba(255, 255, 255, 0.6)',
          }}
          animate={{
            y: [0, -50, 0],
            x: [0, 25, -25, 0],
          }}
          transition={{
            duration: bubble.duration,
            delay: bubble.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

const faqs = [
  {
    title: 'Will you rewrite my resume for each job?',
    text:
      'Yes. We generate a tailored version that highlights your most relevant experience, skills, and achievements for that specific posting. You approve, then download or copy to apply.',
  },
  {
    title: 'Does it help pass ATS filters?',
    text:
      'Absolutely. We structure content for ATS parsing and weave in the keywords that recruiters and screening systems look for — while keeping your resume clean and readable.',
  },
  {
    title: 'Is there a free plan?',
    text:
      'Yes. Free gets you daily matches and basic optimization tips. Premium adds auto-tailored resumes/cover letters, priority alerts, and faster apply workflows.',
  },
  {
    title: 'How is my data handled?',
    text:
      'Your data is encrypted in transit and at rest. We never sell your information, and you can delete your account and data at any time from settings.',
  },
  {
    title: 'Can I use my own template?',
    text:
      'Totally. Upload your resume once — we optimize content while preserving your preferred style and structure.',
  },
  {
    title: 'What jobs do you find?',
    text:
      'Remote-friendly roles across engineering, product, design, data, marketing, and more — curated from top boards and company sites.',
  },
];

// Helper Component: Time to Unplug Card with Parallax + Mouse Tracking
function TimeToUnplugCard() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const hoverX = useMotionValue(0);
  const hoverY = useMotionValue(0);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 100, 
    damping: 30, 
    restDelta: 0.001 
  });
  
  const y = useTransform(smoothProgress, [0, 1], [18, -18]);
  const x = useTransform(smoothProgress, [0, 1], [7, -7]);

  const derivedX = useTransform([x as any, hoverX as any], (values: number[]) => (values[0] || 0) + (values[1] || 0));
  const derivedY = useTransform([y as any, hoverY as any], (values: number[]) => (values[0] || 0) + (values[1] || 0));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
    hoverX.set(-mouseX * 20);
    hoverY.set(-mouseY * 20);
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
    hoverX.set(0);
    hoverY.set(0);
  };

  return (
    <motion.div 
      ref={ref}
      className="absolute left-[62px] top-[150px] w-[410px] h-[440px] bg-white rounded-[22px] px-[28px] pt-[32px] pb-[22px] z-10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        boxShadow: '0 24px 56px rgba(0,0,0,0.12)',
        x: derivedX,
        y: derivedY
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="w-[34px] h-[34px] rounded-[10px] bg-[#dfe3e6] flex items-center justify-center mb-6">
        <img src={imgResume} alt="Icon" className="w-[18px] h-[18px]" />
      </div>
      <h2 className="text-[32px] leading-[40px] font-normal text-[#0f1113] mb-8" style={{ maxWidth: '340px' }}>Time to unplug and explore the world while working remote.</h2>
      <div className="mt-auto w-[360px] bg-[#f5f6f7] rounded-[12px] px-6 py-5" style={{ boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }}>
        <p className="text-[15px] leading-[20px] font-semibold text-[#0f1113] mb-2">Save Hours of your Time</p>
        <p className="text-[13px] leading-[18px] text-[#4b4b4b]">Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.</p>
      </div>
    </motion.div>
  );
}

// Helper Component: Final CTA Card with Parallax + Mouse Tracking
function FooterCTACard() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const hoverX = useMotionValue(0);
  const hoverY = useMotionValue(0);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 100, 
    damping: 30, 
    restDelta: 0.001 
  });
  
  const y = useTransform(smoothProgress, [0, 1], [20, -20]);
  const x = useTransform(smoothProgress, [0, 1], [-8, 8]);

  const derivedX = useTransform([x as any, hoverX as any], (values: number[]) => (values[0] || 0) + (values[1] || 0));
  const derivedY = useTransform([y as any, hoverY as any], (values: number[]) => (values[0] || 0) + (values[1] || 0));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
    hoverX.set(-mouseX * 20);
    hoverY.set(-mouseY * 20);
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
    hoverX.set(0);
    hoverY.set(0);
  };

  return (
    <motion.div 
      ref={ref}
      className="absolute right-[62px] top-[100px] w-[618px] h-[595px] bg-white rounded-[20px] p-[64px] flex flex-col justify-center z-10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        x: derivedX,
        y: derivedY
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="bg-[#dfe3e6] w-[64px] h-[64px] rounded-[14px] flex items-center justify-center mb-8"><img src={imgResume} alt="Resume" className="w-8 h-8" /></div>
      <h2 className="text-[48px] leading-[60px] font-normal text-[#0f1113] mb-6">Start getting remote jobs daily straight to your inbox <span className="text-[#306770]">Free!</span></h2>
      <p className="text-[18px] leading-[28px] text-[#4b4b4b] mb-8">AI finds remote jobs from around the net and sends you the best matches.</p>
      <div className="flex gap-5">
        <button className="bg-[#306770] text-white rounded-[15px] w-[234px] h-[70px] text-[16px] font-medium flex items-center justify-center" style={{ boxShadow: '0px 7px 13px 0px rgba(33,33,33,0.25)' }}>Start Receiving Matches</button>
        <button className="bg-[#fade3e] text-[#171717] rounded-[15px] w-[189px] h-[70px] text-[16px] font-medium flex items-center justify-center">Go Premium</button>
      </div>
    </motion.div>
  );
}

// Helper Component: "This could be you" Glassmorphic Overlay
function ThisCouldBeYouPanel() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const hoverX = useMotionValue(0);
  const hoverY = useMotionValue(0);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 100, 
    damping: 30, 
    restDelta: 0.001 
  });
  
  const y = useTransform(smoothProgress, [0, 1], [10, -10]);
  const x = useTransform(smoothProgress, [0, 1], [5, -5]);

  const derivedX = useTransform([x as any, hoverX as any], (values: number[]) => (values[0] || 0) + (values[1] || 0));
  const derivedY = useTransform([y as any, hoverY as any], (values: number[]) => (values[0] || 0) + (values[1] || 0));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
    hoverX.set(-mouseX * 15);
    hoverY.set(-mouseY * 15);
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
    hoverX.set(0);
    hoverY.set(0);
  };

  return (
    <motion.div 
      ref={ref}
      className="absolute left-6 bottom-6 px-5 py-3 rounded-[14px] z-20"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        background: 'rgba(0,0,0,0.55)',
        color: 'white',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        x: derivedX,
        y: derivedY
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <p className="text-base">This could be you.</p>
    </motion.div>
  );
}

export default function LandingPageAnimated() {
  const [startCount, setStartCount] = useState(false);
  const statsRef = useRef<HTMLDivElement | null>(null);
  const unplugCardMotion = useParallaxHover({ yRange: [18, -18], xRange: [7, -7], mouseMultiplier: 20, hoverScale: 1.02 });
  const ctaCardMotion = useParallaxHover({ yRange: [20, -20], xRange: [-8, 8], mouseMultiplier: 20, hoverScale: 1.02 });
  const ctaPillMotion = useParallaxHover({ yRange: [10, -10], xRange: [5, -5], mouseMultiplier: 15, hoverScale: 1.02 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setStartCount(true);
        });
      },
      { threshold: 0.3 }
    );
    const node = statsRef.current;
    if (node) observer.observe(node);
    return () => {
      if (node) observer.unobserve(node);
    };
  }, []);

  const handleSignUp = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const handleLogin = () => window.location.href = '/?jobs=true';

  return (
    <div className="w-full min-h-screen bg-gray-100 overflow-x-hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <FloatingBubbles />
      <div
        className="relative w-full mx-auto shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]"
        style={{ backgroundImage: 'linear-gradient(165.2deg, rgba(255,255,255,1) 2.4%, rgba(227,227,227,1) 106.2%)' }}
      >
        {/* Headline removed per latest visual alignment request */}

        {/* Header */}
        <motion.div className="sticky top-0 z-50 w-full px-4 md:px-8 lg:px-16 py-4 md:py-6 flex items-center justify-between bg-gradient-to-b from-white/95 to-white/85 backdrop-blur-md shadow-md" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
          <p className="text-3xl md:text-4xl font-bold text-[#306770] tracking-widest" style={{ fontFamily: "'Manrope', sans-serif", lineHeight: '1', maxWidth: '300px' }}>WANDER/WORK</p>
          <div className="flex items-center gap-3 md:gap-4">
            <motion.button 
              onClick={handleLogin}
              className="text-[#306770] px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-medium border border-[#306770] hover:bg-[#306770]/5"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Login
            </motion.button>
            <motion.button 
              onClick={handleSignUp}
              className="bg-[#306770] text-white px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base font-medium"
              whileHover={{ scale: 1.05, boxShadow: '0 7px 13px rgba(33, 33, 33, 0.25)' }}
              whileTap={{ scale: 0.95 }}
            >
              Sign Up
            </motion.button>
            <div className="w-10 h-10 md:w-12 md:h-12 hidden sm:block"><img src={imgMenu} alt="Menu" className="w-full h-full object-contain" /></div>
          </div>
        </motion.div>

        {/* Main content */}
        <div className="w-full px-4 md:px-6 lg:px-8 py-8 md:py-12 flex flex-col gap-12 md:gap-16">
          {/* Hero - Desktop: absolute card on right, image on left */}
          <motion.div className="w-full flex flex-col lg:relative lg:h-[747px]" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}>
            {/* Mobile and Tablet layout */}
            <div className="lg:hidden flex flex-col gap-6">
              <div className="relative w-full h-56 sm:h-72 md:h-96 rounded-2xl overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
                <img src={imgHero} alt="Professional working" className="w-full h-full object-cover" />
                {/* Mobile overlay bubbles - glassmorphic */}
                <div className="absolute md:hidden z-10 left-4 right-4 bottom-20">
                  <GlassmorphicBubble
                    parallaxY={[8, -8]}
                    parallaxX={[4, -4]}
                    mouseMultiplier={15}
                    className="w-full"
                    height="105px"
                    content={
                      <div className="w-full h-full flex items-center justify-between px-4 py-3 gap-3">
                        <span className="text-sm md:text-base font-normal">Escape the 9-5 Rat Race</span>
                        <div className="w-6 h-6 flex-shrink-0"><img src={imgStar6} alt="Star" className="w-full h-full object-contain" /></div>
                      </div>
                    }
                  />
                </div>
                <div className="absolute md:hidden z-10 left-4 right-4 bottom-6">
                  <GlassmorphicBubble
                    parallaxY={[8, -8]}
                    parallaxX={[4, -4]}
                    mouseMultiplier={15}
                    className="w-full"
                    height="87px"
                    content={
                      <div className="w-full h-full flex items-center justify-center px-4 py-3">
                        <span className="text-sm md:text-base font-normal">This could be you.</span>
                      </div>
                    }
                  />
                </div>
              </div>
              <motion.div className="w-full bg-white rounded-2xl p-6 md:p-8 flex flex-col" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.3 }} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Manrope', sans-serif" }}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 md:gap-3 mb-6">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <img key={i} src={imgStar1} alt="Star" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
                      ))}
                    </div>
                    <span className="text-gray-500 text-sm md:text-base">Average Rating 4.94</span>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-normal mb-6" style={{ color: 'black', lineHeight: '1.2' }}>
                    <span style={{ display: 'block', marginBottom: 8 }}>Get Fresh Jobs Daily.</span>
                    <span style={{ display: 'block', marginBottom: 8 }}>Apply in seconds with AI.</span>
                    <span style={{ display: 'block' }}>Get the Interview.</span>
                  </h1>
                  <p className="text-sm md:text-base text-gray-600 mb-8" style={{ lineHeight: '1.5' }}>Stand out with AI-optimized resumes and personalized job matches designed to get past filters and reach hiring managers.</p>
                </div>
                <div ref={statsRef}>
                  {/* Mobile stats: single row */}
                  <div className="mb-6">
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-normal" style={{ lineHeight: '1' }}>{startCount ? <CountUp end={3} duration={1.6} decimals={0} suffix="k+" /> : '3k+'}</span>
                        <span className="text-xs text-gray-600">Jobs added daily.</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-normal" style={{ lineHeight: '1' }}>{startCount ? <CountUp end={92} duration={2} suffix="%" /> : '92%'}</span>
                        <span className="text-xs text-gray-600">More Interviews</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-normal">FREE</span>
                        <span className="text-xs text-gray-600">Get started $0</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-auto">
                  <motion.button onClick={handleSignUp} className="bg-[#306770] text-white px-6 md:px-8 py-3 md:py-4 rounded-xl text-sm md:text-base font-medium w-full sm:w-auto flex items-center justify-center" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }} style={{ boxShadow: '0 7px 13px rgba(33, 33, 33, 0.25)' }}>Start Receiving Matches</motion.button>
                  <motion.button onClick={handleSignUp} className="bg-[#fade3e] text-gray-900 px-6 md:px-8 py-3 md:py-4 rounded-xl text-sm md:text-base font-medium w-full sm:w-auto flex items-center justify-center" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>Go Premium</motion.button>
                </div>
              </motion.div>
            </div>

            {/* Desktop layout: image left, card positioned absolute right */}
            <div className="hidden lg:flex lg:items-stretch lg:gap-0">
              {/* Hero Image - Left side */}
              <div className="relative h-[747px] w-[795px] rounded-[20px] overflow-hidden flex-shrink-0 z-0" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
                <img src={imgHero} alt="Professional working" className="w-full h-full object-cover" />
                {/* Desktop overlay bubbles - glassmorphic */}
                <div className="hidden lg:flex absolute left-[420px] top-[80px] z-10">
                  <GlassmorphicBubble
                    width="253px"
                    height="87px"
                    parallaxY={[8, -8]}
                    parallaxX={[4, -4]}
                    mouseMultiplier={15}
                    content={
                      <div className="w-full h-full flex items-center justify-center px-4 py-3">
                        <span className="text-[18px] font-normal">This could be you.</span>
                      </div>
                    }
                  />
                </div>
                <div className="hidden lg:flex absolute left-[58px] bottom-[52px] z-10">
                  <GlassmorphicBubble
                    width="374px"
                    height="105px"
                    parallaxY={[8, -8]}
                    parallaxX={[4, -4]}
                    mouseMultiplier={15}
                    content={
                      <div className="w-full h-full flex items-center justify-between px-7 py-4 gap-3">
                        <span className="text-[24px] font-normal">Escape the 9-5 Rat Race</span>
                        <div className="w-6 h-6 flex-shrink-0"><img src={imgStar6} alt="Star" className="w-full h-full object-contain" /></div>
                      </div>
                    }
                  />
                </div>
              </div>

              {/* White Card - Absolute positioned on the right */}
              <motion.div 
                className="absolute right-0 top-0 bg-white rounded-[20px] z-20"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                style={{
                  width: '580px',
                  height: '747px',
                  boxShadow: '278px 309px 116px 0px rgba(0,0,0,0), 178px 198px 106px 0px rgba(0,0,0,0.01), 100px 111px 90px 0px rgba(0,0,0,0.05), 44px 49px 66px 0px rgba(0,0,0,0.09), 11px 12px 37px 0px rgba(0,0,0,0.1)',
                  fontFamily: "'Manrope', sans-serif",
                  padding: '66px 50px 50px 50px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  overflow: 'visible'
                }}
              >
                {/* Rating section */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <img key={i} src={imgStar1} alt="Star" className="w-6 h-6 object-contain" />
                    ))}
                  </div>
                  <span className="text-gray-500 text-base">Average Rating 4.94</span>
                </div>

                {/* Headline */}
                <h1 style={{ fontSize: '40px', fontWeight: 400, lineHeight: '60px', color: 'black', margin: 0, marginBottom: '32px' }}>
                  <span style={{ display: 'block', marginBottom: 8 }}>Get Fresh Jobs Daily.</span>
                  <span style={{ display: 'block', marginBottom: 8 }}>Apply in seconds with AI.</span>
                  <span style={{ display: 'block' }}>Get the Interview.</span>
                </h1>

                {/* Description paragraph */}
                <p style={{ fontSize: '16px', lineHeight: '24px', color: '#787878', marginBottom: '32px' }}>Stand out with AI-optimized resumes and personalized job matches designed to get past filters and reach hiring managers. Let AI find jobs for you and customize your resume automatically — so you apply in seconds, not hours.</p>

                {/* Stats Grid - 3 columns */}
                <div ref={statsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '80px', marginBottom: '32px' }}>
                  <div>
                    <div style={{ fontSize: '40px', fontWeight: 400, lineHeight: '1', marginBottom: '8px', color: 'black' }}>
                      {startCount ? <CountUp end={3} duration={1.6} decimals={0} suffix="k+" /> : '3k+'}
                    </div>
                    <div style={{ fontSize: '16px', color: '#787878' }}>Jobs added daily.</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '40px', fontWeight: 400, lineHeight: '1', marginBottom: '8px', color: 'black' }}>
                      {startCount ? <CountUp end={92} duration={2} suffix="%" /> : '92%'}
                    </div>
                    <div style={{ fontSize: '16px', color: '#787878' }}>More Interviews</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '40px', fontWeight: 400, lineHeight: '1', marginBottom: '8px', color: 'black' }}>FREE</div>
                    <div style={{ fontSize: '16px', color: '#787878' }}>Get started $0</div>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexShrink: 0 }}>
                  <motion.button 
                    onClick={handleSignUp}
                    style={{
                      width: '234px',
                      height: '60px',
                      backgroundColor: '#306770',
                      color: 'white',
                      border: 'none',
                      borderRadius: '15px',
                      fontSize: '16px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 7px 13px rgba(33, 33, 33, 0.25)'
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    Start Receiving Matches
                  </motion.button>
                  <motion.button
                    onClick={handleSignUp}
                    style={{
                      width: '189px',
                      height: '60px',
                      backgroundColor: '#fade3e',
                      color: '#171717',
                      border: 'none',
                      borderRadius: '15px',
                      fontSize: '16px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                  >
                    Go Premium
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Badges removed for desktop - they only show on mobile inside hero image */}

          {/* How it Works */}
          <motion.div className="w-full" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={staggerContainer} transition={{ duration: 0.6 }}>
            <motion.h2 className="text-4xl lg:text-5xl font-normal mb-12 lg:mb-16 w-full" variants={fadeInUp} transition={{ duration: 0.6 }} style={{ fontFamily: "'Manrope', sans-serif", lineHeight: '1.2', color: '#2a2f2f' }}>How it Works</motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
              <motion.div className="bg-white rounded-[20px] p-8 lg:p-10 flex flex-col" variants={cardVariants} whileHover={{ scale: 1.02 }} transition={{ duration: 0.3, ease: 'easeInOut' }} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Manrope', sans-serif", willChange: 'transform' }}>
                <div className="bg-gray-200 w-16 h-16 rounded-2xl flex items-center justify-center mb-6"><img src={imgResume} alt="Resume" className="w-8 h-8" /></div>
                <p className="text-[24px] leading-[40px] font-normal text-gray-900">Upload your resume (just once — no more endless edits).</p>
              </motion.div>
              <motion.div className="bg-white rounded-[20px] p-8 lg:p-10 flex flex-col" variants={cardVariants} whileHover={{ scale: 1.02 }} transition={{ duration: 0.3, ease: 'easeInOut' }} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Manrope', sans-serif", willChange: 'transform' }}>
                <div className="bg-gray-200 w-16 h-16 rounded-2xl flex items-center justify-center mb-6"><img src={imgRedCard} alt="Search" className="w-8 h-8" /></div>
                <p className="text-[24px] leading-[40px] font-normal text-gray-900">We find remote jobs from around the world and send you the jobs that match your skills automatically</p>
              </motion.div>
              <motion.div className="bg-white rounded-[20px] p-8 lg:p-10 flex flex-col" variants={cardVariants} whileHover={{ scale: 1.02 }} transition={{ duration: 0.3, ease: 'easeInOut' }} style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'Manrope', sans-serif", willChange: 'transform' }}>
                <div className="bg-gray-200 w-16 h-16 rounded-2xl flex items-center justify-center mb-6"><img src={imgAi} alt="AI" className="w-8 h-8" /></div>
                <p className="text-[24px] leading-[40px] font-normal text-gray-900">AI scans job boards + rewrites your resume and cover letter with the right keywords.</p>
              </motion.div>
            </div>
          </motion.div>

          {/* Frustrated - match Figma layout */}
          <motion.div className="relative w-full rounded-[20px] overflow-hidden" style={{ height: '706px' }} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.8 }}>
            <img src={imgLateNight} alt="Late night background" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#1f120c]/85 via-[#1f120c]/65 to-[#1f120c]/35" />

            {/* Main glass card */}
            <div
              className="absolute left-[48px] top-[96px] w-[420px] rounded-[18px] px-8 py-10"
              style={{
                background: 'rgba(47, 28, 18, 0.78)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              }}
            >
              <h2 className="text-white text-[30px] leading-[40px] font-normal mb-4">Frustrated by silence after applying?</h2>
              <p className="text-white text-[16px] leading-[24px]">Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.</p>
            </div>

            {/* Bottom-right pill */}
            <div
              className="absolute right-[48px] bottom-[56px] w-[280px] rounded-[14px] px-6 py-4"
              style={{
                background: 'rgba(47, 28, 18, 0.78)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 18px 36px rgba(0,0,0,0.2)',
              }}
            >
              <p className="text-white text-[15px] leading-[22px]">Job search cut from hours a day → minutes a day.</p>
            </div>
          </motion.div>

          {/* Benefits - mobile/tablet retains existing flow */}
          <div className="lg:hidden">
            <motion.div className="w-full grid grid-cols-1 gap-8 items-stretch" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } }}>
              <motion.div className="relative w-full h-96 rounded-[20px] overflow-hidden" variants={fadeInUp} transition={{ duration: 0.6 }} style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
                <img src={imgIstock} alt="Professional" className="w-full h-full object-cover" />
                <ParallaxPanel className="absolute left-0 right-0 bottom-8 mx-6 p-8 rounded-[20px]" style={{ fontFamily: "'Manrope', sans-serif", background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.2)' }} mouseMultiplier={18} scaleOnHover={1.02}>
                  <h3 className="text-white text-2xl font-normal mb-3">Save Hours of your Time</h3>
                  <p className="text-white text-lg">Get custom resumes that recruiters notice.</p>
                </ParallaxPanel>
              </motion.div>
              <div className="w-full flex flex-col justify-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <motion.h2 className="text-4xl font-normal mb-8" variants={fadeInUp} transition={{ duration: 0.6 }} style={{ lineHeight: '1.2', color: '#2a2f2f' }}>Stop wasting hours a week applying to jobs. Apply in <span className="text-[#306770]">seconds.</span></motion.h2>
                <div className="space-y-6 mb-8">
                  <motion.div className="flex gap-4" variants={fadeInUp}><div className="w-3 h-3 bg-[#306770] rounded-full mt-2 flex-shrink-0" /><p className="text-lg text-gray-700 leading-relaxed">Beat the bots with keyword-optimized applications.</p></motion.div>
                  <motion.div className="flex gap-4" variants={fadeInUp}><div className="w-3 h-3 bg-[#306770] rounded-full mt-2 flex-shrink-0" /><p className="text-lg text-gray-700 leading-relaxed">Skip the search — new roles sent to your inbox and dashboard.</p></motion.div>
                  <motion.div className="flex gap-4" variants={fadeInUp}><div className="w-3 h-3 bg-[#306770] rounded-full mt-2 flex-shrink-0" /><p className="text-lg text-gray-700 leading-relaxed">Get seen — AI-tuned resumes pass Applicant Tracking System (ATS) screens.</p></motion.div>
                </div>
                <motion.div className="flex gap-4" variants={fadeInUp}>
                  <motion.button onClick={handleSignUp} className="bg-[#306770] text-white rounded-[15px] px-8 py-4 font-medium text-lg w-[234px] h-[60px] flex items-center justify-center" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }} style={{ boxShadow: '0 7px 13px rgba(33, 33, 33, 0.25)' }}>Get My Daily Matches</motion.button>
                  <motion.button className="bg-[#e6e8ea] text-gray-900 rounded-[15px] px-8 py-4 font-medium text-lg w-[189px] h-[60px] flex items-center justify-center" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>Learn More</motion.button>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Benefits - desktop exact Figma layout */}
          <div className="hidden lg:block w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
            <div className="relative w-full h-auto overflow-visible rounded-[20px] flex items-center" style={{ background: 'linear-gradient(135deg, #f2eee8 0%, #ffffff 45%, #ffffff 100%)' }}>
              {/* Left image */}
              <div className="flex-shrink-0 w-[613px] h-[480px] rounded-[18px] overflow-hidden" style={{ boxShadow: '0 22px 48px rgba(0,0,0,0.18)' }}>
                <img src={imgIstock} alt="Professional frustrated" className="w-full h-full object-cover" />
                <div className="absolute left-[40px] bottom-[30px] w-[320px] rounded-[12px] px-6 py-4" style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                  <p className="text-white text-[16px] leading-[22px] font-medium mb-1">Save Hours of your Time</p>
                  <p className="text-white text-[13px] leading-[18px]">Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.</p>
                </div>
              </div>

              {/* Right content */}
              <div className="flex-1 px-10 py-12 flex flex-col gap-6">
                <h2 className="text-[34px] leading-[42px] font-normal text-[#1c1c1c]" style={{ maxWidth: '420px' }}>
                  Stop wasting hours a week applying to jobs. Apply in <span className="text-[#2d6a5a]">seconds.</span>
                </h2>
                <div className="flex flex-col gap-4 text-[20px] leading-[32px] text-[#5f5f5f]">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#2d6a5a' }} />
                    <p className="m-0">Beat the bots with keyword-optimized applications.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#2d6a5a' }} />
                    <p className="m-0">Skip the search — new roles sent to your inbox and dashboard.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#2d6a5a' }} />
                    <p className="m-0">Get seen — AI-tuned resumes pass Applicant Tracking System (ATS) screens.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="w-[170px] h-[46px] rounded-[10px] text-white text-[14px] font-medium" style={{ background: '#2d6a5a', boxShadow: '0 10px 20px rgba(0,0,0,0.18)' }}>Get My Daily Matches</button>
                  <button className="w-[140px] h-[46px] rounded-[10px] text-[#3a3a3a] text-[14px] font-medium" style={{ background: '#e6e8ea', boxShadow: '0 6px 14px rgba(0,0,0,0.08)' }}>Learn More</button>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <motion.div className="w-full" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} style={{ fontFamily: "'Manrope', sans-serif" }}>
            <motion.h2 className="text-4xl lg:text-5xl font-normal text-gray-900 mb-8" variants={fadeInUp} transition={{ duration: 0.5 }} style={{ color: '#2a2f2f' }}>FAQs</motion.h2>
            <div className="relative w-full rounded-[24px] overflow-visible">
              <div
                className="absolute inset-0 rounded-[24px]"
                style={{
                  background: 'linear-gradient(180deg, #cfe8f1 0%, #e9f5fb 55%, #ffffff 100%)',
                  boxShadow: '0 24px 56px rgba(0,0,0,0.08)',
                }}
              />
              <div className="relative px-4 md:px-6 lg:px-8 py-10 lg:py-14">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
                  {[...Array(6)].map((_, idx) => (
                    <motion.div
                      key={idx}
                      className="bg-white rounded-[20px] p-8 lg:p-10 flex flex-col"
                      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{ boxShadow: '0px 18px 28px rgba(0,0,0,0.08)' }}
                    >
                      <div className="bg-[#dfe3e6] w-10 h-10 rounded-[12px] flex items-center justify-center mb-4"><img src={imgInfo} alt="Info" className="w-6 h-6" /></div>
                      <h3 className="text-[20px] font-normal mb-2 text-[#171717]">Get Fresh Jobs .</h3>
                      <p className="text-[14px] leading-[22px] text-[#787878]">At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et.</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Time to Unplug - mobile/tablet */}
          <div className="lg:hidden w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
            <motion.div className="w-full" initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <div className="grid grid-cols-1 gap-8 items-center">
                <motion.div className="relative w-full h-80 rounded-[20px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
                  <img src={imgBeach} alt="Beach woman" className="w-full h-full object-cover" />
                </motion.div>
                <motion.div className="w-full flex flex-col justify-center">
                  <h2 className="text-4xl font-normal mb-6" style={{ color: '#2a2f2f', lineHeight: '1.2' }}>Time to unplug and explore the world while working <span className="text-[#306770]">remote.</span></h2>
                  <p className="text-lg text-gray-700 mb-6 leading-relaxed">Don't waste your precious time applying to jobs. Let us do the work for you.</p>
                  <p className="text-lg text-gray-700 leading-relaxed">Spend less time job hunting, and more time enjoying your life.</p>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Time to Unplug - desktop exact Figma layout */}
          <motion.div 
            className="hidden lg:block w-full" 
            style={{ fontFamily: "'Manrope', sans-serif" }}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="relative w-full h-[758px] bg-[#f3f4f6] overflow-visible">
              {/* Left white card with parallax + mouse tracking */}
              <TimeToUnplugCard />

              {/* Right beach image */}
              <div className="absolute right-0 top-[45px] w-[1000px] h-[667px] rounded-[20px] overflow-hidden" style={{ boxShadow: '0 24px 56px rgba(0,0,0,0.14)' }}>
                <img src={imgFreelanceBeach} alt="Beach woman relaxing" className="w-full h-full object-cover" />
              </div>
            </div>
          </motion.div>

          {/* Testimonials - mobile/tablet */}
          <div className="lg:hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
            <motion.h2 className="text-4xl font-normal text-gray-900 text-center mb-12" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ color: '#2a2f2f' }}>What our <span className="text-[#306770]">customers</span> are saying</motion.h2>
            <div className="relative rounded-[20px] overflow-hidden h-96 mb-10" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
              <video
                src={videoResumeRain}
                poster={imgPoster}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="absolute inset-0 bg-black/35" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { quote: 'I finally stopped guessing what recruiters want. Such a timesaver.', name: '— James L', role: 'Engineer', rating: '4.7' },
                { quote: 'The daily matches are spot-on. I applied in minutes and got callbacks.', name: '— Priya S', role: 'Product Manager', rating: '4.8' },
                { quote: 'Resume tuning helped me pass ATS checks I kept failing before.', name: '— Marco D', role: 'Data Analyst', rating: '4.6' },
              ].map((t, idx) => (
                <div key={idx} className="bg-white rounded-[20px] p-8" style={{ boxShadow: '0 12px 36px rgba(0,0,0,0.08)' }}>
                  <p className="text-gray-700 text-lg font-normal mb-6 leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <img src={imgRectangle} alt="User" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-normal text-gray-900 truncate">{t.name}</div>
                      <div className="text-sm text-gray-600 font-normal truncate">{t.role}</div>
                      <div className="flex items-center gap-1 mt-1"><img src={imgStar1} alt="Star" className="w-4 h-4" /><span className="text-sm text-gray-600 font-normal">{t.rating}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials - desktop Figma overlay */}
          <div className="hidden lg:block w-full" style={{ fontFamily: "'Manrope', sans-serif", maxWidth: '1440px', margin: '0 auto' }}>
            <h2 className="text-5xl font-normal text-center mb-12" style={{ color: '#2a2f2f' }}>What our <span className="text-[#306770]">customers</span> are saying</h2>
            <div className="relative w-full h-[950px] rounded-[20px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
              <img src={imgPaperChaos} alt="Paper chaos" className="absolute inset-0 w-full h-full object-cover" />
              {/* Responsive floating cards – no overlap, always in view */}
              <div className="absolute inset-0 flex items-center justify-center px-8 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 xl:gap-10 max-w-6xl w-full">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-[20px] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.12)] flex flex-col"
                      style={{ minHeight: '260px' }}
                    >
                      <p className="text-[#5e5e5e] text-[24px] leading-[36px] mb-4">“I finally stopped guessing what recruiters want. Such a timesaver.”</p>
                      <div className="flex items-center gap-3 mt-auto">
                        <img src={imgRectangle} alt="User" className="w-[94px] h-[94px] rounded-full object-cover" />
                        <div className="flex flex-col">
                          <span className="text-[20px] text-[#5e5e5e] leading-[28px]">— James L</span>
                          <span className="text-[16px] text-[#5e5e5e]">Engineer</span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <img src={imgStar1} alt="Star" className="w-6 h-6" />
                          <span className="text-[16px] text-[#5e5e5e]">4.2</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Final CTA - mobile/tablet */}
          <div className="lg:hidden w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
            <motion.div className="w-full" initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.8, ease: 'easeOut' }}>
              <div className="w-full grid grid-cols-1 gap-8 items-center px-0">
                <div className="relative w-full h-80 rounded-[22px] overflow-hidden">
                  <img src={imgBeachLaptop} alt="Beach laptop" className="w-full h-full object-cover" />
                  <div className="absolute left-4 bottom-4 px-4 py-2 rounded-[12px]" style={{ background: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(10px)' }}>
                    <p className="text-sm">This could be you.</p>
                  </div>
                </div>
                <div className="w-full bg-white rounded-[20px] p-8 flex flex-col justify-center" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
                  <div className="bg-[#dfe3e6] w-[56px] h-[56px] rounded-[12px] flex items-center justify-center mb-6"><img src={imgResume} alt="Resume" className="w-7 h-7" /></div>
                  <h2 className="text-[32px] leading-[44px] font-normal text-[#0f1113] mb-4">Start getting remote jobs daily straight to your inbox <span className="text-[#306770]">Free!</span></h2>
                  <p className="text-[16px] leading-[24px] text-[#4b4b4b] mb-6">AI finds remote jobs from around the net and sends you the best matches.</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleSignUp} className="bg-[#306770] text-white rounded-[12px] h-[56px] text-[14px] font-medium" style={{ boxShadow: '0px 7px 13px 0px rgba(33,33,33,0.25)' }}>Start Receiving Matches</button>
                    <button onClick={handleSignUp} className="bg-[#fade3e] text-[#171717] rounded-[12px] h-[56px] text-[14px] font-medium">Go Premium</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Final CTA - desktop Figma overlay */}
          <div className="hidden lg:block w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
            <motion.div 
              className="relative w-full h-[820px]"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Footer background */}
              <div className="absolute inset-0 w-full h-full bg-[#f5f5f5] rounded-[20px]" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }} />
              
              {/* Beach image left */}
              <div className="absolute left-[62px] top-[60px] w-[620px] h-[520px] rounded-[20px] overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
                <img src={imgBeachLaptop} alt="Beach laptop" className="w-full h-full object-cover" />
                <ThisCouldBeYouPanel />
              </div>

              {/* CTA card right - overlaps */}
              <FooterCTACard />
            </motion.div>
          </div>

          {/* Footer */}
          <motion.footer className="w-full" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <motion.div 
              className="w-full bg-white/60 rounded-2xl px-4 md:px-6 lg:px-8 py-4 md:py-5 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 mt-0 lg:mt-[-80px] relative z-0"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <a href="#" className="text-sm md:text-base text-[#306770] hover:underline">Privacy Policy</a>
              <a href="#" className="text-sm md:text-base text-[#306770] hover:underline">Terms of Service</a>
              <span className="text-sm md:text-base text-[#306770]">Copyright 2025</span>
            </motion.div>
          </motion.footer>
        </div>

        {/* Decorative background removed for responsiveness */}
      </div>
    </div>
  );
}

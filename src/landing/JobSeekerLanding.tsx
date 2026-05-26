// @ts-nocheck
import { motion, useSpring, useTransform, useScroll, useInView } from "motion/react";
import { useState, useRef } from "react";
import svgPaths from "./svg-7rnbkzp1in";
import imgMenu from "figma:asset/d0a9d673c5d94c18dd17c1643bd59c4d61742e78.png";
import img647A648A60D772Fd468C718F81636WellDressedManWorkingWithLaptopSittingOnTheRockyMountainOnBeautifulScenicClifBackgroundNearMeteoraMonasteriesInGreece from "figma:asset/c8a0a7b242b87c734d608cc38bf5905fcecbaab2.png";
import imgResume from "figma:asset/2890a7a8c8afb2cc555fd4678906a4a8fb182a00.png";
import imgRedCard from "figma:asset/3a56fc983239f488827221e78f490233bde36cce.png";
import imgAi from "figma:asset/f9cf20d34e838e53101a46e264f45e47b19f2e3f.png";
import imgIstockphoto1480979144612X612 from "figma:asset/bcf7986aed3699a8b742711600244619e5c21657.png";
import imgInfo from "figma:asset/b77769ec45f67a7fc46c76c3b542ca2b919fc9b1.png";
import imgFreelanceBeach from "figma:asset/bd1dfdd1f7541a99c130874e76da6fe27ad072ff.png";
import imgRectangle from "figma:asset/5239bc30164156cd9f48f875e53c61de406a8ca1.png";
import img202509012312PaperChaosUnleashedSimpleCompose01K430Tytefj6R4Ne752Vcfsze1 from "figma:asset/35904082bd19768543c49f5873af7b0656a20011.png";
import imgBeachComputerLaptopVpnRf from "figma:asset/17f56f62fc64ae1bb34eb9d3cd457cef5c9b04c3.png";
import imgPlayaChenRioCozumel from "figma:asset/727bb285cb25e44e8a2e2ed68ca5c149c445f1a7.png";

function Group58({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-10 py-6">
      <p className="font-bold text-[#306770] text-[32px] tracking-[4px]" style={{ fontFamily: 'Manrope, sans-serif', lineHeight: '1' }}>
        WANDER<span style={{ opacity: 0.45 }}>/</span>WORK
      </p>
      <button
        onClick={onSignIn}
        style={{
          background: '#306770',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '10px 28px',
          fontSize: '15px',
          fontWeight: '600',
          fontFamily: 'Manrope, sans-serif',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(48,103,112,0.35)',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#245460')}
        onMouseLeave={e => (e.currentTarget.style.background = '#306770')}
      >
        Sign In
      </button>
    </header>
  );
}

function Group21() {
  return (
    <div className="absolute contents inset-0">
      <div className="absolute bg-[#fade3e] inset-0 rounded-[15px]" />
    </div>
  );
}

function Group22() {
  return (
    <div className="absolute contents inset-[33.33%_21.16%_36.67%_19.05%]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal inset-[33.33%_21.16%_36.67%_19.05%] leading-[24px] text-[16px] text-center text-neutral-900">Go Premium</p>
    </div>
  );
}

function Group23({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <motion.div
      onClick={onSignUp}
      className="[grid-area:1_/_1] h-[60px] ml-0 mt-0 relative rounded-[15px] bg-[#fade3e] w-[189px] cursor-pointer flex items-center justify-center"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <p className="font-['Manrope:Regular',_sans-serif] font-normal text-[16px] text-center text-neutral-900">Go Premium</p>
    </motion.div>
  );
}

function Group25() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative">
      <Group23 />
    </div>
  );
}

function Group18() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[262px] mt-0 place-items-start relative">
      <div className="[grid-area:1_/_1] bg-[#fce03d] h-[60px] ml-0 mt-0 rounded-[15px] w-[189px]" />
      <Group25 />
    </div>
  );
}

function Group20() {
  return (
    <div className="absolute contents inset-0">
      <div className="absolute bg-[#306770] inset-0 rounded-[15px]" />
    </div>
  );
}

function Group40() {
  return (
    <div className="absolute contents inset-[30%_4.7%_40%_8.55%]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal inset-[30%_4.7%_40%_8.55%] leading-[24px] text-[16px] text-center text-white">Find Remote Work!</p>
    </div>
  );
}

function Group24({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <motion.div
      onClick={onSignUp}
      className="[grid-area:1_/_1] h-[60px] ml-0 mt-0 relative rounded-[15px] bg-[#306770] shadow-[0px_7px_13px_0px_rgba(33,33,33,0.25)] w-[234px] cursor-pointer flex items-center justify-center"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <p className="font-['Manrope:Regular',_sans-serif] font-normal text-[16px] text-center text-white">Find Remote Work!</p>
    </motion.div>
  );
}

function Group30({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  return (
    <div className="[grid-area:1_/_1] ml-[65px] mt-[525px] flex flex-col gap-2 relative">
      <div className="flex flex-row gap-7 items-center">
        <Group24 onSignUp={onSignUp} />
        <Group23 onSignUp={onGoPremium} />
      </div>
    </div>
  );
}

function Group33() {
  return (
    <div className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[24px] ml-[237px] mt-[651px] place-items-start relative text-black">
      <p className="[grid-area:1_/_1] h-[30px] ml-0 mt-0 relative text-[40px] w-[102px]">92%</p>
      <p className="[grid-area:1_/_1] ml-0 mt-[45px] relative text-[16px] w-[123px]">More Interviews</p>
    </div>
  );
}

function Group31() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[27px] leading-[24px] ml-0 mt-0 relative text-[40px] text-black w-[80px]">321</p>
    </div>
  );
}

function Group32() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Group31 />
    </div>
  );
}

function Frame34() {
  return (
    <div className="[grid-area:1_/_1] box-border content-stretch flex flex-col gap-[10px] items-start ml-0 mt-0 relative w-[80px]">
      <Group32 />
    </div>
  );
}

function Group42() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[27px] leading-[24px] ml-0 mt-0 relative text-[16px] text-black w-[133px]">Jobs added daily.</p>
    </div>
  );
}

function Group60() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Group42 />
    </div>
  );
}

function Frame51() {
  return (
    <div className="[grid-area:1_/_1] box-border content-stretch flex flex-col gap-[10px] items-start ml-0 mt-[42px] relative w-[133px]">
      <Group60 />
    </div>
  );
}

function Group44() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[80px] mt-[651px] place-items-start relative">
      <Frame34 />
      <Frame51 />
    </div>
  );
}

function Group34() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-px mt-0 place-items-start relative">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[30px] leading-[24px] ml-0 mt-0 relative text-[40px] text-black w-[99px]">FREE</p>
    </div>
  );
}

function Group45() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[396px] mt-[655px] place-items-start relative">
      <Group34 />
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[17px] leading-[24px] ml-0 mt-[45px] relative text-[16px] text-black w-[108px]">Get started $0</p>
    </div>
  );
}

function Group28() {
  return (
    <div className="[grid-area:1_/_1] h-[27.755px] ml-0 mt-0 relative w-[128px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 128 28">
        <g id="Group 28">
          <path d={svgPaths.p1e51eb00} fill="var(--fill-0, #FCE03D)" id="Star 1" />
          <path d={svgPaths.p2b93f680} fill="var(--fill-0, #FCE03D)" id="Star 2" />
          <path d={svgPaths.p34835100} fill="var(--fill-0, #FCE03D)" id="Star 3" />
          <path d={svgPaths.p371a8e80} fill="var(--fill-0, #FCE03D)" id="Star 4" />
          <path d={svgPaths.p21684780} fill="var(--fill-0, #FCE03D)" id="Star 5" />
        </g>
      </svg>
    </div>
  );
}

function Group29() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative">
      <Group28 />
    </div>
  );
}

function Group61() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[140px] mt-[2.135px] place-items-start relative">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[25.62px] leading-[24px] ml-0 mt-0 relative text-[#787878] text-[16px] w-[157px]">Average Rating 4.94</p>
    </div>
  );
}

function Group43() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[65px] mt-[66px] place-items-start relative">
      <Group29 />
      <Group61 />
    </div>
  );
}

function Group46({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[590px] mt-0 place-items-start relative"
      initial={{ opacity: 0, x: 100 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[747px] ml-0 mt-0 rounded-[20px] shadow-[278px_309px_116px_0px_rgba(0,0,0,0),178px_198px_106px_0px_rgba(0,0,0,0.01),100px_111px_90px_0px_rgba(0,0,0,0.05),44px_49px_66px_0px_rgba(0,0,0,0.09),11px_12px_37px_0px_rgba(0,0,0,0.1)] w-[626px]" />
      <Group30 onSignUp={onSignUp} onGoPremium={onGoPremium} />
      <Group33 />
      <Group44 />
      <Group45 />
      <div className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[146px] leading-[60px] ml-[65px] mt-[123.755px] relative text-[46px] text-black w-[491px]">
        <p className="mb-0">Wander the world</p>
        <p className="mb-0">while you work.</p>
      </div>
      <Group43 />
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[158px] leading-[26px] ml-[65px] mt-[340.755px] relative text-[#787878] text-[16px] w-[420px]">Let us write your resume, craft your cover letter, and connect you with top recruiters. We match you with the best (and most fresh) remote jobs from all over the world, or connect you straight to recruiters in your field. Stop sending out thousands of applications and let the work come to you.</p>
    </motion.div>
  );
}

function Frame6() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [30, -30]);
  const x = useTransform(smoothProgress, [0, 1], [12, -12]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="[grid-area:1_/_1] bg-black/40 backdrop-blur-md h-[105px] ml-[30px] mt-[596px] overflow-clip relative rounded-[20px] w-[374px] border border-white/10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 15)),
        y: useTransform(() => y.get() + (-mousePosition.y * 15))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[44px] leading-[40px] left-[39px] text-[24px] text-white top-[31px] w-[274px]">Escape the 9-5 Rat Race</p>
      <div className="absolute left-[322px] size-[26px] top-[40px]">
        <div className="absolute inset-[9.04%_10.85%_16.11%_10.85%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 20">
            <path d={svgPaths.p308f5240} fill="var(--fill-0, #FCE03D)" id="Star 6" />
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

function Group57({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <motion.div
        className="[grid-area:1_/_1] h-[556px] ml-0 mt-[106px] relative rounded-[20px] shadow-[495px_468px_191px_0px_rgba(0,0,0,0),317px_300px_174px_0px_rgba(0,0,0,0.01),178px_169px_147px_0px_rgba(0,0,0,0.05),79px_75px_109px_0px_rgba(0,0,0,0.09),20px_19px_60px_0px_rgba(0,0,0,0.1)] w-[795px]"
        data-name="647a648a60d772fd468c718f_81636-well-dressed-man-working-with-laptop-sitting-on-the-rocky-mountain-on-beautiful-scenic-clif-background-near-meteora-monasteries-in-greece"
        initial={{ opacity: 0, x: -100 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[20px]">
          <img alt="" className="absolute h-full left-[-13.21%] max-w-none top-0 w-[113.21%]" src={img647A648A60D772Fd468C718F81636WellDressedManWorkingWithLaptopSittingOnTheRockyMountainOnBeautifulScenicClifBackgroundNearMeteoraMonasteriesInGreece} />
        </div>
      </motion.div>
      <Group46 onSignUp={onSignUp} onGoPremium={onGoPremium} />
      <Frame6 />
    </div>
  );
}

function Group35() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <div className="[grid-area:1_/_1] bg-[#dfe3e6] ml-0 mt-0 rounded-[10px] size-[50px]" />
      <div className="[grid-area:1_/_1] ml-[10px] mt-[10px] relative size-[30px]" data-name="Resume">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgResume} />
      </div>
    </div>
  );
}

function Frame38() {
  return (
    <motion.div 
      className="[grid-area:1_/_1] bg-white box-border content-stretch flex flex-col gap-[30px] h-[305px] items-start ml-0 mt-0 px-[55px] py-[33px] relative rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[400px]"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <Group35 />
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[109px] leading-[40px] relative shrink-0 text-[24px] text-black w-[244px]">Upload your resume once. No more endless edits.</p>
    </motion.div>
  );
}

function Group36() {
  return (
    <motion.div 
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
    >
      <Frame38 />
    </motion.div>
  );
}

function Group37() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <div className="[grid-area:1_/_1] bg-[#dfe3e6] ml-0 mt-0 rounded-[10px] size-[50px]" />
      <div className="[grid-area:1_/_1] ml-[10px] mt-[10px] relative size-[30px]" data-name="Red Card">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgRedCard} />
      </div>
    </div>
  );
}

function Frame37() {
  return (
    <motion.div 
      className="[grid-area:1_/_1] bg-white box-border content-stretch flex flex-col gap-[20px] h-[305px] items-start ml-0 mt-0 px-[42px] py-[33px] relative rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[400px]"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <Group37 />
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[173px] leading-[40px] relative shrink-0 text-[24px] text-black w-[311px]">{`We find remote jobs from around the world and send you the jobs that match your skills automatically `}</p>
    </motion.div>
  );
}

function Group38() {
  return (
    <motion.div 
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
    >
      <Frame37 />
    </motion.div>
  );
}

function Frame35() {
  return (
    <div className="bg-[#dfe3e6] box-border content-stretch flex gap-[10px] items-center p-[9px] relative rounded-[10px] shrink-0 size-[50px]">
      <div className="relative shrink-0 size-[30px]" data-name="AI">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgAi} />
      </div>
    </div>
  );
}

function Frame36() {
  return (
    <motion.div 
      className="bg-white box-border content-stretch flex flex-col gap-[30px] h-[305px] items-start px-[44px] py-[32px] relative rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] shrink-0 w-[400px]"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
      whileHover={{ scale: 1.03 }}
    >
      <Frame35 />
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[172px] leading-[40px] relative shrink-0 text-[24px] text-black w-[295px] whitespace-pre-wrap">{`AI scans job boards + rewrites your resume and cover letter  with the right keywords.`}</p>
    </motion.div>
  );
}

function Frame39() {
  return (
    <div className="content-stretch flex gap-[20px] items-center relative shrink-0 w-full">
      <Group36 />
      <Group38 />
      <Frame36 />
    </div>
  );
}

function Frame40() {
  return (
    <div className="content-stretch flex flex-col gap-[34px] items-start relative shrink-0 w-[1240px]">
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[81px] leading-[82px] relative shrink-0 text-[46px] text-black w-full">How it Works</p>
      <Frame39 />
    </div>
  );
}

function Frame1() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [32, -32]);
  const x = useTransform(smoothProgress, [0, 1], [14, -14]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="absolute bg-black/40 backdrop-blur-md font-['Manrope:Regular',_sans-serif] font-normal h-[360px] left-[50px] overflow-clip rounded-[20px] top-[62px] w-[604px] max-w-[calc(100%-100px)] border border-white/10"
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 20)),
        y: useTransform(() => y.get() + (-mousePosition.y * 20))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
    >
      <motion.p 
        className="absolute h-auto leading-[82px] left-[37px] text-[46px] text-white top-[24px] w-[547px] max-w-[calc(100%-74px)]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
      >
        Frustrated by silence after applying?
      </motion.p>
      <motion.p
        className="absolute h-auto leading-[40px] left-[37px] text-[24px] text-white top-[199px] w-[547px] max-w-[calc(100%-74px)]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
      >
        Let recruiters come to you. Get their direct contact info and AI-crafted outreach emails, ready to send in seconds. No cold applying required.
      </motion.p>
    </motion.div>
  );
}

function Frame3() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [-28, 28]);
  const x = useTransform(smoothProgress, [0, 1], [-14, 14]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="absolute bg-black/40 backdrop-blur-md h-[142px] right-[50px] left-auto overflow-clip rounded-[20px] bottom-[50px] top-auto w-[389px] max-w-[calc(100%-100px)] border border-white/10"
      initial={{ opacity: 0, x: 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 15)),
        y: useTransform(() => y.get() + (-mousePosition.y * 15))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
    >
      <motion.div 
        className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-auto leading-[40px] left-[34px] text-[24px] text-white top-[35px] w-[321px] max-w-[calc(100%-68px)]"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
      >
        <p className="mb-0">{`Job search cut from `}</p>
        <p>hours a day → minutes a day.</p>
      </motion.div>
    </motion.div>
  );
}

function Frame41() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, margin: "200px" })
  return (
    <motion.div
      ref={containerRef}
      className="h-[706px] relative shrink-0 w-full max-w-[1440px]"
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[20px] bg-gray-900">
        {isInView && (
          <video
            className="absolute top-0 left-0 right-0 w-full object-cover pointer-events-none"
            style={{ height: '112%', objectPosition: 'top center' }}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src="/late-night-focus.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <Frame1 />
      <Frame3 />
    </motion.div>
  );
}

function Frame7() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [32, -32]);
  const x = useTransform(smoothProgress, [0, 1], [-12, 12]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="[grid-area:1_/_1] bg-black/40 backdrop-blur-md h-[180px] ml-[75.5px] mt-[513px] overflow-clip relative rounded-[20px] w-[503px] border border-white/10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 18)),
        y: useTransform(() => y.get() + (-mousePosition.y * 18))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <p className="absolute font-['Manrope:Medium',_sans-serif] font-medium h-[55px] leading-[82px] left-[38px] text-[24px] text-white top-[8px] w-[291px]">Save Hours of your Time</p>
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[79px] leading-[40px] left-[38px] text-[16px] text-white top-[75px] w-[446px]">Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.</p>
    </motion.div>
  );
}

function Group56() {
  return (
    <motion.div 
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      initial={{ opacity: 0, x: -100 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="[grid-area:1_/_1] h-[704px] ml-0 mt-0 relative rounded-[20px] shadow-[338px_470px_162px_0px_rgba(0,0,0,0),216px_301px_148px_0px_rgba(0,0,0,0.01),122px_169px_125px_0px_rgba(0,0,0,0.05),54px_75px_93px_0px_rgba(0,0,0,0.09),14px_19px_51px_0px_rgba(0,0,0,0.1)] w-[653px]" data-name="istockphoto-1480979144-612x612">
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[20px]">
          <img alt="" className="absolute h-full left-[-29.1%] max-w-none top-0 w-[161.72%]" src={imgIstockphoto1480979144612X612} />
        </div>
      </div>
      <Frame7 />
    </motion.div>
  );
}

function Group62() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] ml-0 mt-[8px] place-items-start relative">
      <div className="[grid-area:1_/_1] bg-[#306770] ml-0 mt-0 rounded-[15px] size-[10px]" />
    </div>
  );
}

function Group53() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[57px] leading-[32px] ml-[31px] mt-0 relative text-[#787878] text-[20px] w-[432px]">Beat the bots with keyword-optimized applications.</p>
      <Group62 />
    </div>
  );
}

function Group63() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] ml-0 mt-[8px] place-items-start relative">
      <div className="[grid-area:1_/_1] bg-[#306770] ml-0 mt-0 rounded-[15px] size-[10px]" />
    </div>
  );
}

function Group54() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[49px] leading-[32px] ml-[30px] mt-0 relative text-[#787878] text-[20px] w-[432px]">Skip the search. New roles sent to your inbox and dashboard.</p>
      <Group63 />
    </div>
  );
}

function Group64() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] ml-0 mt-[7px] place-items-start relative">
      <div className="[grid-area:1_/_1] bg-[#306770] ml-0 mt-0 rounded-[15px] size-[10px]" />
    </div>
  );
}

function Group55() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[49px] leading-[32px] ml-[30px] mt-0 relative text-[#787878] text-[20px] w-[432px]">Get seen. AI-tuned resumes pass Applicant Tracking System (ATS) screens.</p>
      <Group64 />
    </div>
  );
}

function Frame45() {
  return (
    <div className="content-stretch flex flex-col gap-[40px] items-start leading-[0] relative shrink-0 w-full">
      <Group53 />
      <Group54 />
      <Group55 />
    </div>
  );
}

function Frame46() {
  return (
    <div className="[grid-area:1_/_1] box-border content-stretch flex flex-col gap-[39px] items-center ml-0 mt-0 relative w-[529px]">
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[195px] leading-[60px] relative shrink-0 text-[46px] text-black w-full">
        <span>{`Stop wasting hours a week applying to jobs. Apply in `}</span>
        <span className="text-[#373c24]">seconds.</span>
      </p>
      <Frame45 />
    </div>
  );
}

function Group52() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <Frame46 />
    </div>
  );
}

function Group16({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <motion.div
      onClick={onSignUp}
      className="relative shrink-0 cursor-pointer"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="bg-[#306770] h-[70px] rounded-[15px] w-[234px] flex items-center justify-center">
        <p className="font-['Manrope:Regular',_sans-serif] font-normal text-[16px] text-white">Get My Daily Matches</p>
      </div>
    </motion.div>
  );
}

function Group17({ scrollToFaq }: { scrollToFaq?: () => void }) {
  return (
    <motion.div
      onClick={scrollToFaq}
      className="relative shrink-0 cursor-pointer"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="bg-[#dfe3e6] h-[70px] rounded-[15px] w-[189px] flex items-center justify-center relative">
        <div aria-hidden="true" className="absolute border border-[#cccccc] border-solid inset-[-1px] pointer-events-none rounded-[16px]" />
        <p className="font-['Manrope:Regular',_sans-serif] font-normal text-[16px] text-neutral-900">Learn More</p>
      </div>
    </motion.div>
  );
}

function Frame44({ onSignUp, scrollToFaq }: { onSignUp?: () => void; scrollToFaq?: () => void }) {
  return (
    <div className="content-stretch flex gap-[20px] items-center leading-[0] relative shrink-0">
      <Group16 onSignUp={onSignUp} />
      <Group17 scrollToFaq={scrollToFaq} />
    </div>
  );
}

function Frame47({ onSignUp, scrollToFaq }: { onSignUp?: () => void; scrollToFaq?: () => void }) {
  return (
    <motion.div
      className="content-stretch flex flex-col gap-[58px] items-start relative shrink-0 w-[529px]"
      initial={{ opacity: 0, x: 100 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <Group52 />
      <Frame44 onSignUp={onSignUp} scrollToFaq={scrollToFaq} />
    </motion.div>
  );
}

function Frame48({ onSignUp, scrollToFaq }: { onSignUp?: () => void; scrollToFaq?: () => void }) {
  return (
    <div className="content-stretch flex gap-[78px] items-center relative shrink-0">
      <Group56 />
      <Frame47 onSignUp={onSignUp} scrollToFaq={scrollToFaq} />
    </div>
  );
}

function Group15() {
  return (
    <div className="[grid-area:1_/_1] ml-0 mt-0 rounded-[20px] overflow-hidden h-[650px] w-[1461px]">
      <img alt="" className="w-full h-full object-cover" src={imgPlayaChenRioCozumel} />
    </div>
  );
}

function Group2() {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[229.573px] ml-0 mt-0 rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[423.565px]" />
      <div className="[grid-area:1_/_1] bg-[#e9f0f1] h-[39.926px] ml-[33.676px] mt-[29.944px] rounded-[40px] w-[49.89px]" />
      <div className="[grid-area:1_/_1] h-[27.948px] ml-[41.159px] mt-[35.933px] relative w-[34.923px]" data-name="Info">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgInfo} />
      </div>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-semibold h-auto leading-[22px] ml-[115.777px] mt-[38px] relative text-[17px] text-black w-[268px]">Where do jobs come from?</p>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[118.745px] leading-[24px] ml-[40px] mt-[91.038px] relative text-[#787878] text-[16px] w-[344px]">We scan job boards, company career pages, and hiring platforms daily. Every listing is filtered for remote roles that match your skills and target titles. No manual searching required.</p>
    </motion.div>
  );
}

function Group5() {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-[276.486px] place-items-start relative"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[229.573px] ml-0 mt-0 rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[423.565px]" />
      <div className="[grid-area:1_/_1] bg-[#e9f0f1] h-[39.926px] ml-[33.676px] mt-[29.945px] rounded-[40px] w-[49.89px]" />
      <div className="[grid-area:1_/_1] h-[27.948px] ml-[41.159px] mt-[35.934px] relative w-[34.923px]" data-name="Info">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgInfo} />
      </div>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-semibold h-auto leading-[22px] ml-[115.777px] mt-[38px] relative text-[17px] text-black w-[268px]">How does outreach work?</p>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[118.745px] leading-[24px] ml-[40px] mt-[91.037px] relative text-[#787878] text-[16px] w-[344px]">Our AI drafts personalized emails to recruiters on your behalf. You review each message before it sends so you stay in control. We handle the legwork so you collect the replies.</p>
    </motion.div>
  );
}

function Group6() {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[465.224px] mt-0 place-items-start relative"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[229.573px] ml-0 mt-0 rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[423.565px]" />
      <div className="[grid-area:1_/_1] bg-[#e9f0f1] h-[39.926px] ml-[33.676px] mt-[29.944px] rounded-[40px] w-[49.89px]" />
      <div className="[grid-area:1_/_1] h-[27.948px] ml-[41.159px] mt-[35.933px] relative w-[34.923px]" data-name="Info">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgInfo} />
      </div>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-semibold h-auto leading-[22px] ml-[115.777px] mt-[38px] relative text-[17px] text-black w-[268px]">Recruiters are your superpower</p>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[118.745px] leading-[24px] ml-[40px] mt-[91.038px] relative text-[#787878] text-[16px] w-[344px]">Recruiters find jobs for you. That's literally their job. Connect with ones in your field and let them bring the opportunities straight to you.</p>
    </motion.div>
  );
}

function Group13() {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[465.224px] mt-[276.486px] place-items-start relative"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[229.573px] ml-0 mt-0 rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[423.565px]" />
      <div className="[grid-area:1_/_1] bg-[#e9f0f1] h-[39.926px] ml-[33.676px] mt-[29.945px] rounded-[40px] w-[49.89px]" />
      <div className="[grid-area:1_/_1] h-[27.948px] ml-[41.159px] mt-[35.934px] relative w-[34.923px]" data-name="Info">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgInfo} />
      </div>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-semibold h-auto leading-[22px] ml-[115.777px] mt-[38px] relative text-[17px] text-black w-[268px]">Will my resume beat ATS?</p>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[118.745px] leading-[24px] ml-[40px] mt-[91.037px] relative text-[#787878] text-[16px] w-[344px]">Yes. Our AI reads each job description and rewrites your resume with the exact keywords ATS systems screen for. Over 90% of companies filter applicants through ATS before a human ever sees the application.</p>
    </motion.div>
  );
}

function Group8() {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[930.449px] mt-0 place-items-start relative"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[229.573px] ml-0 mt-0 rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[423.565px]" />
      <div className="[grid-area:1_/_1] bg-[#e9f0f1] h-[39.926px] ml-[33.676px] mt-[29.944px] rounded-[40px] w-[49.89px]" />
      <div className="[grid-area:1_/_1] h-[27.948px] ml-[41.16px] mt-[35.933px] relative w-[34.923px]" data-name="Info">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgInfo} />
      </div>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-semibold h-auto leading-[22px] ml-[115.777px] mt-[38px] relative text-[17px] text-black w-[268px]">Is it free to start?</p>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[118.745px] leading-[24px] ml-[40px] mt-[91.038px] relative text-[#787878] text-[16px] w-[344px]">Yes. Sign up and start receiving daily remote job matches at no cost. Premium unlocks higher token limits, unlimited AI document generation, and expanded recruiter outreach.</p>
    </motion.div>
  );
}

function Group14() {
  return (
    <motion.div
      className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[930.449px] mt-[276.486px] place-items-start relative"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="[grid-area:1_/_1] bg-white h-[229.573px] ml-0 mt-0 rounded-[10px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[423.565px]" />
      <div className="[grid-area:1_/_1] bg-[#e9f0f1] h-[39.926px] ml-[33.676px] mt-[29.945px] rounded-[40px] w-[49.89px]" />
      <div className="[grid-area:1_/_1] h-[27.948px] ml-[41.16px] mt-[35.934px] relative w-[34.923px]" data-name="Info">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgInfo} />
      </div>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-semibold h-auto leading-[22px] ml-[115.777px] mt-[38px] relative text-[17px] text-black w-[268px]">What jobs do you source?</p>
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[118.745px] leading-[24px] ml-[40px] mt-[91.037px] relative text-[#787878] text-[16px] w-[344px]">We focus exclusively on remote and location-flexible roles across tech, design, marketing, ops, finance, and more. Every listing is verified to be genuinely remote. No bait-and-switch.</p>
    </motion.div>
  );
}



function Group51() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const cardsY = useTransform(smoothProgress, [0, 1], [14, -14]);

  return (
    <div id="faq-section" ref={ref} className="flex flex-col shrink-0">
      <p className="ml-[53.493px] mb-10 font-normal leading-[82px] text-[80px] text-black" style={{fontFamily: "Manrope, sans-serif"}}>FAQ&apos;s</p>
      <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative">
        <Group15 />
        <motion.div
          className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[53.493px] mt-[80px] place-items-start relative"
          style={{ y: cardsY }}
        >
          <Group2 />
          <Group5 />
          <Group6 />
          <Group13 />
          <Group8 />
          <Group14 />
        </motion.div>
      </div>
    </div>
  );
}

function Group26() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <div className="[grid-area:1_/_1] bg-[#dfe3e6] ml-0 mt-0 rounded-[10px] size-[50px]" />
      <div className="[grid-area:1_/_1] ml-[10px] mt-[10px] relative size-[30px]" data-name="Resume">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgResume} />
      </div>
    </div>
  );
}

function Frame8() {
  return (
    <div className="bg-[rgba(0,0,0,0)] font-['Manrope:Regular',_sans-serif] font-normal h-[235px] overflow-clip relative rounded-[20px] shrink-0 w-[547px]">
      <p className="absolute leading-[34px] left-[37px] text-[24px] text-black top-[5px] w-[547px]">Don't waste your precious time applying to jobs. Lets us do the work for you.</p>
      <ul className="absolute left-[37px] top-[85px] w-[482px] space-y-2">
        <li className="flex items-start gap-3 text-[#312d2d] text-[18px] leading-[28px]">
          <span className="text-[24px] leading-[40px]">Spend less time job hunting, and more time enjoying your life.</span>
        </li>
      </ul>
    </div>
  );
}

function Frame9() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [18, -18]);
  const x = useTransform(smoothProgress, [0, 1], [7, -7]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="[grid-area:1_/_1] bg-white box-border content-stretch flex flex-col gap-[25px] h-[692px] items-start ml-0 mt-[66px] pb-[27px] pt-[56px] px-[59px] relative rounded-[20px] shadow-[199px_270px_94px_0px_rgba(0,0,0,0),127px_173px_86px_0px_rgba(0,0,0,0.01),71px_97px_72px_0px_rgba(0,0,0,0.05),32px_43px_54px_0px_rgba(0,0,0,0.09),8px_11px_29px_0px_rgba(0,0,0,0.1)] w-[678px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 20)),
        y: useTransform(() => y.get() + (-mousePosition.y * 20))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Group26 />
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[195px] leading-[60px] relative shrink-0 text-[46px] text-black w-[469px]">{`Time to unplug and explore the world while working remote. `}</p>
      <Frame8 />
    </motion.div>
  );
}

function Group49() {
  return (
    <motion.div 
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="[grid-area:1_/_1] h-[667px] ml-[258px] mt-0 relative rounded-[20px] shadow-[559px_417px_195px_0px_rgba(0,0,0,0),358px_267px_179px_0px_rgba(0,0,0,0.01),201px_150px_151px_0px_rgba(0,0,0,0.05),90px_67px_112px_0px_rgba(0,0,0,0.09),22px_17px_61px_0px_rgba(0,0,0,0.1)] w-[1000px]" data-name="freelance-beach">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none rounded-[20px] size-full" src={imgFreelanceBeach} />
        <FloatingGlassBubble className="absolute bottom-[-34px] right-[76px] z-10" delay={0.15}>
          <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal leading-[31px] left-[34px] text-[24px] text-white top-[22px] w-[306px]">
            Remote roles matched<br />to your skills.
          </p>
        </FloatingGlassBubble>
      </div>
      <Frame9 />
    </motion.div>
  );
}

function FloatingGlassBubble({
  className,
  children,
  delay = 0,
}: {
  className: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const scrollX = useTransform(smoothProgress, [0, 1], [7, -7]);
  const scrollY = useTransform(smoothProgress, [0, 1], [-7, 7]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left - rect.width / 2) / rect.width,
      y: (e.clientY - rect.top - rect.height / 2) / rect.height,
    });
  };

  const active = mousePosition.x !== 0 || mousePosition.y !== 0;

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
      style={{
        x: useTransform(() => scrollX.get() + (-mousePosition.x * 15)),
        y: useTransform(() => scrollY.get() + (-mousePosition.y * 15)),
      }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      animate={{ scale: active ? 1.02 : 1 }}
      transition={{
        opacity: { duration: 0.7, ease: "easeOut", delay },
        scale: { type: "spring", stiffness: 300, damping: 30 },
      }}
    >
      <motion.div
        className="relative h-[105px] w-[374px] overflow-clip rounded-[20px] border border-white/10 bg-black/40 backdrop-blur-md"
        animate={{
          x: [0, 9, 4, -8, -4, 0],
          y: [0, -6, 7, 5, -7, 0],
          rotate: [0, 0.12, -0.08, -0.12, 0.08, 0],
        }}
        transition={{
          duration: 8.4,
          ease: "easeInOut",
          repeat: Infinity,
          delay,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Group41() {
  return (
    <div className="absolute contents left-[239px] top-[209px]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[27px] leading-[40px] left-[265px] text-[#5e5e5e] text-[16px] top-[209px] w-[75px]">4.2</p>
      <div className="absolute h-[20px] left-[239px] top-[220px] w-[22px]">
        <div className="absolute inset-[10.37%_13.56%_17.39%_13.56%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 15">
            <path d={svgPaths.p2fa0f370} fill="var(--fill-0, #FCE03D)" id="Star 1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame5() {
  return (
    <motion.div
      className="testimonial-bouncy absolute bg-white h-[287.197px] left-[918.77px] overflow-clip rounded-[20px] top-[380px] w-[481.83px]"
      style={{ '--testimonial-bounce-duration': '9.5s', '--testimonial-bounce-delay': '-2.4s' }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="absolute font-['Manrope:Regular',_sans-serif] font-normal leading-[32px] left-[166px] top-[166px] w-[280px]">
        <p className="mb-0 text-[22px] text-[#5e5e5e] font-medium">- David K.</p>
        <p className="text-[15px] text-[#5e5e5e]">Product Designer</p>
      </div>
      <div className="absolute left-[49px] rounded-full size-[94px] top-[156px] flex items-center justify-center text-white font-bold text-[28px]" style={{ background: '#4a7fa5' }}>DK</div>
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[110px] leading-[36px] left-[33px] text-[#5e5e5e] text-[22px] top-[40px] w-[415px]">"From application to offer in 3 weeks. The ATS resume optimization is a game-changer."</p>
      <div className="absolute left-[166px] top-[228px] flex items-center gap-1">
        <span style={{ color: '#FCE03D', fontSize: '18px', lineHeight: 1 }}>★</span>
        <span className="font-['Manrope:Regular',_sans-serif] text-[#5e5e5e] text-[16px]">5.0</span>
      </div>
    </motion.div>
  );
}

function Group12() {
  return (
    <div className="absolute contents left-[918.77px] top-[380px]">
      <Frame5 />
    </div>
  );
}

function Group65() {
  return (
    <div className="absolute contents left-[239px] top-[209px]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[27px] leading-[40px] left-[265px] text-[#5e5e5e] text-[16px] top-[209px] w-[75px]">4.2</p>
      <div className="absolute h-[20px] left-[239px] top-[220px] w-[22px]">
        <div className="absolute inset-[10.37%_13.56%_17.39%_13.56%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 15">
            <path d={svgPaths.p2fa0f370} fill="var(--fill-0, #FCE03D)" id="Star 1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame10() {
  return (
    <motion.div
      className="testimonial-bouncy absolute bg-white h-[287.197px] left-[61.77px] overflow-clip rounded-[20px] top-[380px] w-[481.83px]"
      style={{ '--testimonial-bounce-duration': '10.5s', '--testimonial-bounce-delay': '-0.8s' }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="absolute font-['Manrope:Regular',_sans-serif] font-normal leading-[32px] left-[166px] top-[166px] w-[280px]">
        <p className="mb-0 text-[22px] text-[#5e5e5e] font-medium">- Tammy W.</p>
        <p className="text-[15px] text-[#5e5e5e]">Marketing Director</p>
      </div>
      <div className="absolute left-[49px] rounded-full size-[94px] top-[156px] flex items-center justify-center text-white font-bold text-[28px]" style={{ background: '#8b5e3c' }}>TW</div>
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[110px] leading-[36px] left-[33px] text-[#5e5e5e] text-[22px] top-[40px] w-[415px]">"The AI matched me with roles I actually wanted. Landed 3 interviews in my first week."</p>
      <div className="absolute left-[166px] top-[228px] flex items-center gap-1">
        <span style={{ color: '#FCE03D', fontSize: '18px', lineHeight: 1 }}>★</span>
        <span className="font-['Manrope:Regular',_sans-serif] text-[#5e5e5e] text-[16px]">4.6</span>
      </div>
    </motion.div>
  );
}

function Group19() {
  return (
    <div className="absolute contents left-[61.77px] top-[380px]">
      <Frame10 />
    </div>
  );
}

function Frame11() {
  return (
    <div className="[grid-area:1_/_1] bg-[rgba(0,0,0,0)] h-[721px] ml-0 mt-0 overflow-clip relative rounded-[20px] w-[1443px]">
      <Group12 />
      <Group19 />
    </div>
  );
}

function Group10() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[0.225px] mt-0 place-items-start relative">
      <Frame11 />
    </div>
  );
}

function Group66() {
  return (
    <div className="absolute contents left-[239px] top-[209px]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[27px] leading-[40px] left-[265px] text-[#5e5e5e] text-[16px] top-[209px] w-[75px]">4.2</p>
      <div className="absolute h-[20px] left-[239px] top-[220px] w-[22px]">
        <div className="absolute inset-[10.37%_13.56%_17.39%_13.56%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 15">
            <path d={svgPaths.p2fa0f370} fill="var(--fill-0, #FCE03D)" id="Star 1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame12() {
  return (
    <motion.div
      className="testimonial-bouncy [grid-area:1_/_1] bg-white h-[287.197px] ml-0 mt-0 overflow-clip relative rounded-[20px] w-[481.83px]"
      style={{ '--testimonial-bounce-duration': '9s', '--testimonial-bounce-delay': '-4.2s' }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div className="absolute font-['Manrope:Regular',_sans-serif] font-normal leading-[32px] left-[166px] top-[166px] w-[280px]">
        <p className="mb-0 text-[22px] text-[#5e5e5e] font-medium">- James L.</p>
        <p className="text-[15px] text-[#5e5e5e]">Software Engineer</p>
      </div>
      <div className="absolute left-[49px] rounded-full size-[94px] top-[156px] flex items-center justify-center text-white font-bold text-[28px]" style={{ background: '#306770' }}>JL</div>
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal h-[110px] leading-[36px] left-[33px] text-[#5e5e5e] text-[22px] top-[40px] w-[415px]">"I finally stopped guessing what recruiters want. Recruiter replies started coming in within days."</p>
      <div className="absolute left-[166px] top-[228px] flex items-center gap-1">
        <span style={{ color: '#FCE03D', fontSize: '18px', lineHeight: 1 }}>★</span>
        <span className="font-['Manrope:Regular',_sans-serif] text-[#5e5e5e] text-[16px]">4.8</span>
      </div>
    </motion.div>
  );
}

function Group11() {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[480px] mt-[39px] place-items-start relative">
      <Frame12 />
    </div>
  );
}

function Group48() {
  return (
    <motion.div 
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0 w-full"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="[grid-area:1_/_1] h-[721.494px] ml-0 mt-0 relative w-[1461px]">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover pointer-events-none">
          <source src="/ResumeRain.mp4" type="video/mp4" />
        </video>
      </div>
      <Group10 />
      <Group11 />
    </motion.div>
  );
}

function Group27() {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <div className="[grid-area:1_/_1] bg-[#dfe3e6] ml-0 mt-0 rounded-[10px] size-[50px]" />
      <div className="[grid-area:1_/_1] ml-[10px] mt-[10px] relative size-[30px]" data-name="Resume">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-contain pointer-events-none size-full" src={imgResume} />
      </div>
    </div>
  );
}

function Group67() {
  return (
    <div className="absolute contents inset-0">
      <div className="absolute bg-[#fade3e] inset-0 rounded-[15px]" />
    </div>
  );
}

function Group68() {
  return (
    <div className="absolute contents inset-[33.33%_21.16%_36.67%_19.05%]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal inset-[33.33%_21.16%_36.67%_19.05%] leading-[24px] text-[16px] text-center text-neutral-900">Go Premium</p>
    </div>
  );
}

function Group69({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <motion.div
      onClick={onSignUp}
      className="[grid-area:1_/_1] h-[60px] ml-0 mt-0 relative rounded-[15px] bg-[#fade3e] w-[189px] cursor-pointer flex items-center justify-center"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <p className="font-['Manrope:Regular',_sans-serif] font-normal text-[16px] text-center text-neutral-900">Go Premium</p>
    </motion.div>
  );
}

function Group70({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative">
      <Group69 onSignUp={onSignUp} />
    </div>
  );
}

function Group71({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[262px] mt-0 place-items-start relative">
      <div className="[grid-area:1_/_1] bg-[#fce03d] h-[60px] ml-0 mt-0 rounded-[15px] w-[189px]" />
      <Group70 onSignUp={onSignUp} />
    </div>
  );
}

function Group72() {
  return (
    <div className="absolute contents inset-0">
      <div className="absolute bg-[#306770] inset-0 rounded-[15px]" />
    </div>
  );
}

function Group73() {
  return (
    <div className="absolute contents inset-[30%_4.7%_40%_8.55%]">
      <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal inset-[30%_4.7%_40%_8.55%] leading-[24px] text-[16px] text-center text-white">Find Remote Work!</p>
    </div>
  );
}

function Group74({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <motion.div
      onClick={onSignUp}
      className="[grid-area:1_/_1] h-[60px] ml-0 mt-0 relative rounded-[15px] bg-[#306770] shadow-[0px_7px_13px_0px_rgba(33,33,33,0.25)] w-[234px] cursor-pointer flex items-center justify-center"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <p className="font-['Manrope:Regular',_sans-serif] font-normal text-[16px] text-center text-white">Find Remote Work!</p>
    </motion.div>
  );
}

function Group75({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  return (
    <div className="[grid-area:1_/_1] grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-px place-items-start relative">
      <Group71 onSignUp={onGoPremium} />
      <Group74 onSignUp={onSignUp} />
    </div>
  );
}

function Group39({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  return (
    <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
      <p className="[grid-area:1_/_1] font-['Manrope:Regular',_sans-serif] font-normal h-[30px] leading-[24px] ml-[154.5px] mt-0 relative text-[16px] text-white w-[180px]">Get Started for Free!</p>
      <Group75 onSignUp={onSignUp} onGoPremium={onGoPremium} />
    </div>
  );
}

function Frame43({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [20, -20]);
  const x = useTransform(smoothProgress, [0, 1], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="[grid-area:1_/_1] bg-white box-border content-stretch flex flex-col gap-[50px] h-[731px] items-start ml-[802px] mt-0 pl-[72px] pr-[29px] py-[77px] relative rounded-br-[10px] rounded-tr-[10px] shadow-[278px_309px_116px_0px_rgba(0,0,0,0),178px_198px_106px_0px_rgba(0,0,0,0.01),100px_111px_90px_0px_rgba(0,0,0,0.05),44px_49px_66px_0px_rgba(0,0,0,0.09),11px_12px_37px_0px_rgba(0,0,0,0.1)] w-[566px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 20)),
        y: useTransform(() => y.get() + (-mousePosition.y * 20))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Group27 />
      <p className="font-['Manrope:Regular',_sans-serif] font-extrabold h-auto leading-[58px] relative shrink-0 text-[#111] text-[46px] w-[451px]">
        Find the hottest remote jobs all over the world.
      </p>
      <p className="font-['Manrope:Regular',_sans-serif] font-normal h-[87px] leading-[40px] relative shrink-0 text-[24px] text-black w-[435px]">We surface remote roles from across the web and deliver the ones that match, straight to your dashboard.</p>
      <Group39 onSignUp={onSignUp} onGoPremium={onGoPremium} />
    </motion.div>
  );
}

function Group47({ onSignUp, onGoPremium }: { onSignUp?: () => void; onGoPremium?: () => void }) {
  return (
    <motion.div
      className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="[grid-area:1_/_1] h-[756px] ml-0 mt-[47px] relative rounded-[20px] shadow-[360px_731px_228px_0px_rgba(0,0,0,0),231px_468px_209px_0px_rgba(0,0,0,0.01),130px_263px_176px_0px_rgba(0,0,0,0.05),58px_117px_130px_0px_rgba(0,0,0,0.09),14px_29px_72px_0px_rgba(0,0,0,0.1)] w-[1169px]" data-name="Beach-computer-laptop-VPN-RF">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none rounded-[20px] size-full" src={imgBeachComputerLaptopVpnRf} />
        <FloatingGlassBubble className="absolute top-[-38px] left-[224px] z-10" delay={0.1}>
          <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal leading-[31px] left-[34px] text-[24px] text-white top-[22px] w-[306px]">
            Remote roles matched<br />to your skills.
          </p>
        </FloatingGlassBubble>
        <FloatingGlassBubble className="absolute bottom-[-34px] left-[64px] z-10" delay={0.15}>
          <p className="absolute font-['Manrope:Regular',_sans-serif] font-normal leading-[31px] left-[34px] text-[24px] text-white top-[22px] w-[306px]">
            Jobs filtered before<br />they hit your dashboard.
          </p>
        </FloatingGlassBubble>
      </div>
      <Frame43 onSignUp={onSignUp} onGoPremium={onGoPremium} />
    </motion.div>
  );
}

function Frame50({ onSignUp, onGoPremium, scrollToFaq }: { onSignUp?: () => void; onGoPremium?: () => void; scrollToFaq?: () => void }) {
  return (
    <div className="content-stretch flex flex-col gap-[200px] items-center relative shrink-0 w-full">
      <Group57 onSignUp={onSignUp} onGoPremium={onGoPremium} />
      <Frame40 />
      <Frame41 />
      <Frame48 onSignUp={onSignUp} scrollToFaq={scrollToFaq} />
      <Group51 />
      <Group49 />
      <Group48 />
      <Group47 onSignUp={onSignUp} onGoPremium={onGoPremium} />
    </div>
  );
}


function Frame13({ onSignUp: _onSignUp }: { onSignUp?: () => void }) {
  return (
    <div className="w-full max-w-[1329px] mx-auto bg-[rgba(255,255,255,0.6)] rounded-[20px] py-5 px-8">
      <div className="flex items-center justify-center gap-10 flex-wrap">
        <a href="#" className="font-normal text-[#306770] text-[15px] hover:underline cursor-pointer" style={{ fontFamily: 'Manrope, sans-serif' }}>Privacy Policy</a>
        <a href="#" className="font-normal text-[#306770] text-[15px] hover:underline cursor-pointer" style={{ fontFamily: 'Manrope, sans-serif' }}>Terms of Service</a>
        <p className="font-normal text-[#306770] text-[15px]" style={{ fontFamily: 'Manrope, sans-serif' }}>© 2026 Wander/Work, Inc.</p>
      </div>
    </div>
  );
}

function Group59({ onSignUp }: { onSignUp?: () => void }) {
  return (
    <div className="w-full flex justify-center px-6">
      <Frame13 onSignUp={onSignUp} />
    </div>
  );
}

function Frame49({ onSignUp, onGoPremium, scrollToFaq }: { onSignUp?: () => void; onGoPremium?: () => void; scrollToFaq?: () => void }) {
  return (
    <div className="content-stretch flex flex-col gap-[44px] items-center w-[1461px] mt-[137px]">
      <Frame50 onSignUp={onSignUp} onGoPremium={onGoPremium} scrollToFaq={scrollToFaq} />
      <Group59 onSignUp={onSignUp} />
    </div>
  );
}

function Frame42() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const y = useTransform(smoothProgress, [0, 1], [10, -10]);
  const x = useTransform(smoothProgress, [0, 1], [5, -5]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setMousePosition({ x: mouseX, y: mouseY });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div 
      ref={ref}
      className="absolute bg-black/40 backdrop-blur-md font-['Manrope:Regular',_sans-serif] font-normal h-[87px] left-[410px] overflow-clip rounded-[20px] top-[289px] w-[253px] border border-white/10"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        x: useTransform(() => x.get() + (-mousePosition.x * 15)),
        y: useTransform(() => y.get() + (-mousePosition.y * 15))
      }}
      animate={{
        scale: mousePosition.x !== 0 || mousePosition.y !== 0 ? 1.02 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <p className="absolute h-[29px] leading-[40px] left-[28px] text-[24px] text-white top-[23px] w-[205px]">This could be you.</p>
    </motion.div>
  );
}

export default function JobSeekerLanding({ scale = 1, onSignIn: _onSignIn, onSignUp, onGoPremium }: { scale?: number; onSignIn?: () => void; onSignUp?: () => void; onGoPremium?: () => void }) {
  const scrollToFaq = () => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="relative shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full min-h-screen overflow-x-hidden" data-name="Job Seeker Landing">
      <Frame49 onSignUp={onSignUp} onGoPremium={onGoPremium} scrollToFaq={scrollToFaq} />
      <Frame42 />
    </div>
  );
}

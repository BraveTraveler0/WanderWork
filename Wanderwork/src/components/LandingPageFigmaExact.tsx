// This is the exact Figma design with a fixed 1440px width layout
// Figma design assets
const imgPlayaChenRioCozumel = "https://www.figma.com/api/mcp/asset/205691e1-e477-45e5-ab44-bc7ce391afd0";
const imgMenu = "https://www.figma.com/api/mcp/asset/0994975b-69ba-4a4c-ba21-e95312f74a4e";
const img647A648A60D772Fd468C718F81636WellDressedManWorkingWithLaptopSittingOnTheRockyMountainOnBeautifulScenicClifBackgroundNearMeteoraMonasteriesInGreece = "https://www.figma.com/api/mcp/asset/3ac7be4b-73a6-41b2-a1e8-7bf7a15ac3b5";
const imgResume = "https://www.figma.com/api/mcp/asset/35a21016-c636-4041-a637-c5c0295ae009";
const imgRedCard = "https://www.figma.com/api/mcp/asset/60fff690-f283-4b29-9bb4-eda5d0dafe10";
const imgAi = "https://www.figma.com/api/mcp/asset/8abf9782-cd95-4fca-8780-01955d7fe3c8";
const imgIstockphoto1480979144612X612 = "https://www.figma.com/api/mcp/asset/956ac9be-2ddb-40c1-b4e1-cbb947c0b25e";
const imgInfo = "https://www.figma.com/api/mcp/asset/47395190-6943-46f2-b2a9-fdeca53e1917";
const imgFreelanceBeach = "https://www.figma.com/api/mcp/asset/15183923-e46e-4e1b-9a96-080e0e02c5cb";
const img202509012312PaperChaosUnleashedSimpleCompose01K430Tytefj6R4Ne752Vcfsze1 = "https://www.figma.com/api/mcp/asset/e8deeda6-3168-427e-aa98-6f79211df03d";
const imgRectangle = "https://www.figma.com/api/mcp/asset/e20aec8f-b4c0-4244-8de9-100db1e0b570";
const imgBeachComputerLaptopVpnRf = "https://www.figma.com/api/mcp/asset/8d5cfe81-35d6-4737-9376-ac5007308495";
const imgGroup28 = "https://www.figma.com/api/mcp/asset/24694c91-fd11-4a1a-967c-239b796e6e28";
const imgStar6 = "https://www.figma.com/api/mcp/asset/e8b34228-6a9a-47fa-964c-54cfae30744e";
const imgStar1 = "https://www.figma.com/api/mcp/asset/279c6aa0-9512-4266-92a1-ae0b0e30ca8c";

export default function LandingPageFigmaExact() {
  const handleSignUp = () => {
    window.open("https://tally.so/r/wLraG2", "_blank");
  };

  return (
    <div className="w-full min-h-screen overflow-x-auto overflow-y-auto bg-gray-100">
      {/* Fixed width container to match Figma exactly - 1440px */}
      <div className="relative w-[1440px] h-[7589px] mx-auto shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]" 
           style={{ backgroundImage: "linear-gradient(165.2deg, rgba(255,255,255,1) 2.4%, rgba(227,227,227,1) 106.2%)" }}>
        
        {/* Headline text - positioned absolutely on right side */}
        <div className="absolute left-[1666px] top-[76px] w-[566px] h-[300px]"
             style={{ fontFamily: "'Pathway Extreme', sans-serif", fontWeight: 400, fontSize: '46px', lineHeight: '82px', color: 'black', whiteSpace: 'pre-wrap' }}>
          <p style={{ marginBottom: 0 }}>Get Fresh Jobs Daily.</p>
          <p style={{ marginBottom: 0 }}>Apply in seconds with AI.</p>
          <p style={{ marginBottom: 0 }}>Get the Interview.</p>
        </div>
        
        {/* Header - WANDERWORK branding + Menu */}
        <div className="absolute left-[116px] top-[76px] flex items-center gap-[1147px]">
          <p className="text-[40px] font-bold text-[#306770] tracking-[6px]"
             style={{ fontFamily: "'Manrope', sans-serif", lineHeight: '24px', width: '411px', height: '27.867px', marginTop: '15.92px' }}>
            WANDERWORK
          </p>
          <div className="w-[44px] h-[43.791px]">
            <img src={imgMenu} alt="Menu" className="w-full h-full object-contain" />
          </div>
        </div>
        
        {/* Main content starts at top 137px */}
        <div className="absolute left-0 top-[137px] w-[1461px]">
          
          {/* Hero Section - Overlapping Cards */}
          <div className="relative w-full h-[747px] mb-[200px]">
            {/* Large hero image - positioned first */}
            <div className="absolute left-[122.5px] top-[106px] w-[795px] h-[556px] rounded-[20px] overflow-hidden"
                 style={{ boxShadow: '495px 468px 191px 0px rgba(0,0,0,0), 317px 300px 174px 0px rgba(0,0,0,0.01), 178px 169px 147px 0px rgba(0,0,0,0.05), 79px 75px 109px 0px rgba(0,0,0,0.09), 20px 19px 60px 0px rgba(0,0,0,0.1)' }}>
              <img src={img647A648A60D772Fd468C718F81636WellDressedManWorkingWithLaptopSittingOnTheRockyMountainOnBeautifulScenicClifBackgroundNearMeteoraMonasteriesInGreece} 
                   alt="Professional working on laptop" 
                   className="w-[113.21%] h-full object-cover"
                   style={{ marginLeft: '-13.21%' }} />
            </div>
            
            {/* White info card - overlaps hero image on right */}
            <div className="absolute left-[712.5px] top-0 w-[626px] h-[747px] bg-white rounded-[20px] p-[65px]"
                 style={{ boxShadow: '278px 309px 116px 0px rgba(0,0,0,0), 178px 198px 106px 0px rgba(0,0,0,0.01), 100px 111px 90px 0px rgba(0,0,0,0.05), 44px 49px 66px 0px rgba(0,0,0,0.09), 11px 12px 37px 0px rgba(0,0,0,0.1)', fontFamily: "'Manrope', sans-serif" }}>
              
              {/* Rating stars */}
              <div className="flex items-center gap-3 mb-[30px]">
                <img src={imgGroup28} alt="5 stars" className="h-[27.755px] w-[128px]" />
                <span className="text-[#787878] text-[16px]" style={{ lineHeight: '24px' }}>Average Rating 4.94</span>
              </div>
              
              {/* Main headline */}
              <h1 className="text-[46px] font-normal mb-[30px] w-[451px]" 
                  style={{ lineHeight: '70px', color: 'black' }}>
                <span style={{ display: 'block', marginBottom: 0 }}>Get Fresh Jobs Daily.</span>
                <span style={{ display: 'block', marginBottom: 0 }}>Apply in seconds.</span>
                <span style={{ display: 'block' }}>Get the Interview.</span>
              </h1>
              
              {/* Description */}
              <p className="text-[16px] text-[#787878] mb-[36px] w-[399px]" 
                 style={{ lineHeight: '24px' }}>
                Stand out with AI-optimized resumes and personalized job matches designed to get past filters and reach hiring managers. Let AI find jobs for you and customize your resume automatically — so you apply in seconds, not hours.
              </p>
              
              {/* Stats row */}
              <div className="flex gap-[85px] mb-[40px]">
                <div>
                  <div className="text-[40px] font-normal mb-[3px]" style={{ lineHeight: '24px', height: '30px' }}>3k+</div>
                  <div className="text-[16px]" style={{ lineHeight: '24px' }}>Jobs added daily.</div>
                </div>
                <div>
                  <div className="text-[40px] font-normal mb-[15px]" style={{ lineHeight: '24px', height: '30px' }}>92%</div>
                  <div className="text-[16px]" style={{ lineHeight: '24px' }}>More Interviews</div>
                </div>
                <div>
                  <div className="text-[40px] font-normal mb-[15px]" style={{ lineHeight: '24px', height: '30px' }}>FREE</div>
                  <div className="text-[16px]" style={{ lineHeight: '24px' }}>Get started $0</div>
                </div>
              </div>
              
              {/* CTA buttons */}
              <div className="flex gap-[28px]">
                <button onClick={handleSignUp}
                        className="bg-[#306770] text-white px-[40px] py-[18px] rounded-[15px] text-[16px] font-normal h-[60px]"
                        style={{ boxShadow: '0px 7px 13px 0px rgba(33,33,33,0.25)', lineHeight: '24px' }}>
                  Start Receiving Matches
                </button>
                <button onClick={handleSignUp}
                        className="bg-[#fade3e] text-[#171717] px-[40px] py-[18px] rounded-[15px] text-[16px] font-normal h-[60px]"
                        style={{ lineHeight: '24px' }}>
                  Go Premium
                </button>
              </div>
            </div>
            
            {/* "Escape 9-5" badge - overlays bottom-left of hero image */}
            <div className="absolute left-[152.5px] top-[596px] w-[374px] h-[105px] bg-black/70 backdrop-blur-sm rounded-[20px] flex items-center justify-between px-[39px]">
              <span className="text-white text-[24px] font-normal" style={{ fontFamily: "'Manrope', sans-serif", lineHeight: '40px' }}>
                Escape the 9-5 Rat Race
              </span>
              <div className="w-[26px] h-[26px]">
                <img src={imgStar6} alt="Star" className="w-full h-full" />
              </div>
            </div>
          </div>
          
          {/* "This could be you" badge - positioned to left side */}
          <div className="absolute left-[288px] top-[152px] w-[253px] h-[87px] bg-black/50 backdrop-blur-sm rounded-[20px] flex items-center justify-center">
            <span className="text-white text-[24px] font-normal" style={{ fontFamily: "'Manrope', sans-serif", lineHeight: '40px' }}>
              This could be you.
            </span>
          </div>
          
          {/* How it Works Section */}
          <div className="absolute left-[110.5px] top-[947px] w-[1240px]">
            <h2 className="text-[46px] font-normal mb-[34px] w-full" 
                style={{ fontFamily: "'Manrope', sans-serif", lineHeight: '82px', height: '81px' }}>
              How it Works
            </h2>
            
            <div className="flex gap-[20px]">
              {/* Card 1 */}
              <div className="bg-white w-[400px] h-[305px] rounded-[20px] p-[33px_55px]"
                   style={{ boxShadow: '199px 270px 94px 0px rgba(0,0,0,0), 127px 173px 86px 0px rgba(0,0,0,0.01), 71px 97px 72px 0px rgba(0,0,0,0.05), 32px 43px 54px 0px rgba(0,0,0,0.09), 8px 11px 29px 0px rgba(0,0,0,0.1)', fontFamily: "'Manrope', sans-serif" }}>
                <div className="bg-[#dfe3e6] w-[50px] h-[50px] rounded-[10px] flex items-center justify-center mb-[30px]">
                  <img src={imgResume} alt="Resume" className="w-[30px] h-[30px]" />
                </div>
                <p className="text-[24px] font-normal w-[244px]" style={{ lineHeight: '40px', height: '109px' }}>
                  Upload your resume (just once — no more endless edits).
                </p>
              </div>
              
              {/* Card 2 */}
              <div className="bg-white w-[400px] h-[305px] rounded-[20px] p-[33px_42px]"
                   style={{ boxShadow: '199px 270px 94px 0px rgba(0,0,0,0), 127px 173px 86px 0px rgba(0,0,0,0.01), 71px 97px 72px 0px rgba(0,0,0,0.05), 32px 43px 54px 0px rgba(0,0,0,0.09), 8px 11px 29px 0px rgba(0,0,0,0.1)', fontFamily: "'Manrope', sans-serif" }}>
                <div className="bg-[#dfe3e6] w-[50px] h-[50px] rounded-[10px] flex items-center justify-center mb-[20px]">
                  <img src={imgRedCard} alt="Search" className="w-[30px] h-[30px]" />
                </div>
                <p className="text-[24px] font-normal w-[311px]" style={{ lineHeight: '40px', height: '173px' }}>
                  We find remote jobs from around the world and send you the jobs that match your skills automatically
                </p>
              </div>
              
              {/* Card 3 */}
              <div className="bg-white w-[400px] h-[305px] rounded-[20px] p-[32px_44px]"
                   style={{ boxShadow: '199px 270px 94px 0px rgba(0,0,0,0), 127px 173px 86px 0px rgba(0,0,0,0.01), 71px 97px 72px 0px rgba(0,0,0,0.05), 32px 43px 54px 0px rgba(0,0,0,0.09), 8px 11px 29px 0px rgba(0,0,0,0.1)', fontFamily: "'Manrope', sans-serif" }}>
                <div className="bg-[#dfe3e6] w-[50px] h-[50px] rounded-[10px] flex items-center justify-center mb-[30px]">
                  <img src={imgAi} alt="AI" className="w-[30px] h-[30px]" />
                </div>
                <p className="text-[24px] font-normal w-[295px]" style={{ lineHeight: '40px', height: '172px' }}>
                  AI scans job boards + rewrites your resume and cover letter with the right keywords.
                </p>
              </div>
            </div>
          </div>
          
          {/* Frustrated Section with dark overlay */}
          <div className="absolute left-[10.5px] top-[1567px] w-[1440px] h-[706px] rounded-[20px] overflow-hidden bg-gradient-to-r from-black/80 to-black/40"
               style={{ fontFamily: "'Manrope', sans-serif" }}>
            <div className="absolute left-[50px] top-[86px] w-[604px]">
              <h2 className="text-white text-[46px] font-normal mb-[25px]" style={{ lineHeight: '82px', height: '160px' }}>
                Frustrated by silence after applying?
              </h2>
              <p className="text-white text-[24px] font-normal" style={{ lineHeight: '40px', height: '120px' }}>
                Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.
              </p>
            </div>
            
            <div className="absolute right-[25px] bottom-[63px] w-[389px] h-[142px] bg-black/60 backdrop-blur-sm rounded-[20px] flex items-center px-[34px]">
              <p className="text-white text-[24px] font-normal" style={{ lineHeight: '40px' }}>
                Job search cut from hours a day → minutes a day.
              </p>
            </div>
          </div>
          
          {/* Benefits Section - Image Left, Content Right */}
          <div className="absolute left-[100.5px] top-[2473px] w-[1260px] h-[704px] flex gap-[78px]">
            {/* Left image */}
            <div className="relative w-[653px] h-[704px] rounded-[20px] overflow-hidden"
                 style={{ boxShadow: '338px 470px 162px 0px rgba(0,0,0,0), 216px 301px 148px 0px rgba(0,0,0,0.01), 122px 169px 125px 0px rgba(0,0,0,0.05), 54px 75px 93px 0px rgba(0,0,0,0.09), 14px 19px 51px 0px rgba(0,0,0,0.1)' }}>
              <img src={imgIstockphoto1480979144612X612} alt="Professional" className="w-[161.72%] h-full object-cover" style={{ marginLeft: '-29.1%' }} />
              
              {/* Overlay text on image */}
              <div className="absolute left-[75.5px] bottom-[191px] w-[503px] h-[180px] bg-black/70 backdrop-blur-sm rounded-[20px] px-[38px] py-[8px]"
                   style={{ fontFamily: "'Manrope', sans-serif" }}>
                <h3 className="text-white text-[24px] font-medium mb-[8px]" style={{ lineHeight: '82px', height: '55px' }}>
                  Save Hours of your Time
                </h3>
                <p className="text-white text-[16px] font-normal" style={{ lineHeight: '40px', height: '79px' }}>
                  Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.
                </p>
              </div>
            </div>
            
            {/* Right content */}
            <div className="w-[529px] pt-[53.5px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <h2 className="text-[46px] font-normal mb-[58px] w-full" style={{ lineHeight: '60px', height: '195px' }}>
                Stop wasting hours a week applying to jobs. Apply in <span className="text-[#373c24]">seconds.</span>
              </h2>
              
              <div className="mb-[58px]">
                {/* Bullet 1 */}
                <div className="flex gap-[21px] mb-[40px]">
                  <div className="w-[10px] h-[10px] bg-[#306770] rounded-[15px] mt-[24px] flex-shrink-0" />
                  <p className="text-[20px] text-[#787878] font-normal" style={{ lineHeight: '32px', height: '57px' }}>
                    Beat the bots with keyword-optimized applications.
                  </p>
                </div>
                
                {/* Bullet 2 */}
                <div className="flex gap-[20px] mb-[40px]">
                  <div className="w-[10px] h-[10px] bg-[#306770] rounded-[15px] mt-[24px] flex-shrink-0" />
                  <p className="text-[20px] text-[#787878] font-normal" style={{ lineHeight: '32px', height: '49px' }}>
                    Skip the search — new roles sent to your inbox and dashboard.
                  </p>
                </div>
                
                {/* Bullet 3 */}
                <div className="flex gap-[20px]">
                  <div className="w-[10px] h-[10px] bg-[#306770] rounded-[15px] mt-[24px] flex-shrink-0" />
                  <p className="text-[20px] text-[#787878] font-normal" style={{ lineHeight: '32px', height: '49px' }}>
                    Get seen — AI-tuned resumes pass Applicant Tracking System (ATS) screens.
                  </p>
                </div>
              </div>
              
              {/* CTA buttons */}
              <div className="flex gap-[20px]">
                <button onClick={handleSignUp}
                        className="bg-[#306770] text-white rounded-[15px] text-[16px] font-normal w-[234px] h-[70px]"
                        style={{ lineHeight: '24px' }}>
                  Get My Daily Matches
                </button>
                <button className="bg-[#dfe3e6] border border-[#ccc] text-[#171717] rounded-[15px] text-[16px] font-normal w-[189px] h-[70px]"
                        style={{ lineHeight: '24px' }}>
                  Learn More
                </button>
              </div>
            </div>
          </div>
          
          {/* FAQ Section */}
          <div className="absolute left-[-20px] top-[3377px] w-[1501px] h-[917px]">
            <div className="bg-white/80 rounded-[20px] w-full h-full p-[63.7px_43.7px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              <h2 className="text-[46px] font-normal mb-[83.45px]" style={{ lineHeight: '82px', height: '99.815px' }}>
                FAQ's
              </h2>
              
              <div className="grid grid-cols-3 gap-x-[41.68px] gap-y-[46.49px]">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white w-[423.565px] h-[229.573px] rounded-[20px] p-[29.94px_33.68px]"
                       style={{ boxShadow: '199px 270px 94px 0px rgba(0,0,0,0), 127px 173px 86px 0px rgba(0,0,0,0.01), 71px 97px 72px 0px rgba(0,0,0,0.05), 32px 43px 54px 0px rgba(0,0,0,0.09), 8px 11px 29px 0px rgba(0,0,0,0.1)' }}>
                    <div className="bg-[#e9f0f1] w-[49.89px] h-[39.926px] rounded-[40px] flex items-center justify-center mb-[23.44px]">
                      <img src={imgInfo} alt="Info" className="w-[34.923px] h-[27.948px]" />
                    </div>
                    <h3 className="text-[24px] font-normal mb-[12.09px]" style={{ lineHeight: '82px', height: '49.477px' }}>
                      Get Fresh Jobs .
                    </h3>
                    <p className="text-[16px] text-[#787878] font-normal" style={{ lineHeight: '24px', height: '118.745px' }}>
                      At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Remote Work + Beach Section */}
          <div className="absolute left-[101.5px] top-[4494px] w-[1258px] h-[758px]">
            {/* Beach image */}
            <div className="absolute left-[258px] top-0 w-[1000px] h-[667px] rounded-[20px] overflow-hidden"
                 style={{ boxShadow: '559px 417px 195px 0px rgba(0,0,0,0), 358px 267px 179px 0px rgba(0,0,0,0.01), 201px 150px 151px 0px rgba(0,0,0,0.05), 90px 67px 112px 0px rgba(0,0,0,0.09), 22px 17px 61px 0px rgba(0,0,0,0.1)' }}>
              <img src={imgFreelanceBeach} alt="Beach work" className="w-full h-full object-cover" />
            </div>
            
            {/* White card overlay */}
            <div className="absolute left-0 top-[66px] w-[678px] h-[692px] bg-white rounded-[20px] p-[56px_59px_27px]"
                 style={{ boxShadow: '199px 270px 94px 0px rgba(0,0,0,0), 127px 173px 86px 0px rgba(0,0,0,0.01), 71px 97px 72px 0px rgba(0,0,0,0.05), 32px 43px 54px 0px rgba(0,0,0,0.09), 8px 11px 29px 0px rgba(0,0,0,0.1)', fontFamily: "'Manrope', sans-serif" }}>
              <div className="bg-[#dfe3e6] w-[50px] h-[50px] rounded-[10px] flex items-center justify-center mb-[25px]">
                <img src={imgResume} alt="Resume" className="w-[30px] h-[30px]" />
              </div>
              
              <h2 className="text-[46px] font-normal mb-[25px] w-[469px]" style={{ lineHeight: '60px', height: '195px' }}>
                Time to unplug and explore the world while working remote.
              </h2>
              
              <div className="bg-black/5 rounded-[20px] p-[10px_37px] w-[547px] h-[235px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <h3 className="text-[24px] font-normal mb-[15px]" style={{ lineHeight: '82px', height: '55px' }}>
                  Save Hours of your Time
                </h3>
                <p className="text-[#312d2d] text-[24px] font-normal" style={{ lineHeight: '40px', height: '160px' }}>
                  Get custom resumes that recruiters notice. Designed to outsmart job application filters used by 90% of companies.
                </p>
              </div>
            </div>
          </div>
          
          {/* Testimonials Section */}
          <div className="absolute left-0 top-[5452px] w-[1461px] h-[721.494px] rounded-[20px] overflow-hidden">
            {/* Background image with overlay */}
            <div className="absolute inset-0">
              <img src={img202509012312PaperChaosUnleashedSimpleCompose01K430Tytefj6R4Ne752Vcfsze1} 
                   alt="Background" 
                   className="w-[100.02%] h-[303.82%] object-cover" 
                   style={{ marginLeft: '-1.35%', marginTop: '-174.5%' }} />
            </div>
            
            <div className="relative pt-[402px] px-[61.78px] flex gap-[95px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {/* Testimonial 1 */}
              <div className="bg-white w-[481.83px] h-[287.197px] rounded-[20px] p-[47px_33px_156px]">
                <p className="text-[#5e5e5e] text-[24px] font-normal mb-[19px]" style={{ lineHeight: '40px', height: '100px' }}>
                  "I finally stopped guessing what recruiters want. Such a timesaver"
                </p>
                <div className="flex items-center gap-[17px]">
                  <img src={imgRectangle} alt="User" className="w-[94px] h-[94px] rounded-full object-cover" />
                  <div>
                    <div className="text-[24px] font-normal" style={{ lineHeight: '40px' }}>
                      — James L
                    </div>
                    <div className="text-[16px] text-[#5e5e5e] font-normal" style={{ lineHeight: '40px' }}>
                      Engineer
                    </div>
                    <div className="flex items-center gap-[6px] mt-[6px]">
                      <img src={imgStar1} alt="Star" className="w-[22px] h-[20px]" />
                      <span className="text-[16px] text-[#5e5e5e] font-normal" style={{ lineHeight: '40px' }}>4.2</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Testimonial 2 */}
              <div className="bg-white w-[481.83px] h-[287.197px] rounded-[20px] p-[47px_33px_156px]">
                <p className="text-[#5e5e5e] text-[24px] font-normal mb-[19px]" style={{ lineHeight: '40px', height: '100px' }}>
                  "I finally stopped guessing what recruiters want. Such a timesaver"
                </p>
                <div className="flex items-center gap-[17px]">
                  <img src={imgRectangle} alt="User" className="w-[94px] h-[94px] rounded-full object-cover" />
                  <div>
                    <div className="text-[24px] font-normal" style={{ lineHeight: '40px' }}>
                      — James L
                    </div>
                    <div className="text-[16px] text-[#5e5e5e] font-normal" style={{ lineHeight: '40px' }}>
                      Engineer
                    </div>
                    <div className="flex items-center gap-[6px] mt-[6px]">
                      <img src={imgStar1} alt="Star" className="w-[22px] h-[20px]" />
                      <span className="text-[16px] text-[#5e5e5e] font-normal" style={{ lineHeight: '40px' }}>4.2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Final CTA Section */}
          <div className="absolute left-[46.5px] top-[6373.494px] w-[1368px] h-[803px]">
            {/* Beach laptop image */}
            <div className="absolute left-0 top-[47px] w-[1169px] h-[756px] rounded-[20px] overflow-hidden"
                 style={{ boxShadow: '360px 731px 228px 0px rgba(0,0,0,0), 231px 468px 209px 0px rgba(0,0,0,0.01), 130px 263px 176px 0px rgba(0,0,0,0.05), 58px 117px 130px 0px rgba(0,0,0,0.09), 14px 29px 72px 0px rgba(0,0,0,0.1)' }}>
              <img src={imgBeachComputerLaptopVpnRf} alt="Beach laptop" className="w-full h-full object-cover" />
            </div>
            
            {/* White card overlay on right */}
            <div className="absolute right-0 top-0 w-[566px] h-[731px] bg-white rounded-r-[10px] p-[77px_72px_77px_72px]"
                 style={{ boxShadow: '278px 309px 116px 0px rgba(0,0,0,0), 178px 198px 106px 0px rgba(0,0,0,0.01), 100px 111px 90px 0px rgba(0,0,0,0.05), 44px 49px 66px 0px rgba(0,0,0,0.09), 11px 12px 37px 0px rgba(0,0,0,0.1)', fontFamily: "'Manrope', sans-serif" }}>
              <div className="bg-[#dfe3e6] w-[50px] h-[50px] rounded-[10px] flex items-center justify-center mb-[50px]">
                <img src={imgResume} alt="Resume" className="w-[30px] h-[30px]" />
              </div>
              
              <h2 className="text-[46px] font-normal text-[#2a2f2f] mb-[50px] w-[451px]" style={{ lineHeight: '60px', height: '181px' }}>
                Start getting remote jobs daily straight to your inbox <span className="text-[#306770]">Free!</span>
              </h2>
              
              <p className="text-[24px] font-normal mb-[50px] w-[435px]" style={{ lineHeight: '40px', height: '87px' }}>
                AI finds remote jobs from around the net and sends you the jobs
              </p>
              
              {/* CTA buttons */}
              <div className="flex gap-[20px]">
                <button onClick={handleSignUp}
                        className="bg-[#306770] text-white rounded-[15px] text-[16px] font-normal w-[234px] h-[60px]"
                        style={{ boxShadow: '0px 7px 13px 0px rgba(33,33,33,0.25)', lineHeight: '24px' }}>
                  Start Receiving Matches
                </button>
                <button onClick={handleSignUp}
                        className="bg-[#fade3e] text-[#171717] rounded-[15px] text-[16px] font-normal w-[189px] h-[60px]"
                        style={{ lineHeight: '24px' }}>
                  Go Premium
                </button>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="absolute left-[66px] top-[7300.494px] w-[1329px] h-[92px]">
            <div className="bg-white/60 rounded-[20px] w-full h-full flex items-center justify-center"
                 style={{ fontFamily: "'Manrope', sans-serif" }}>
              <div className="flex gap-[112.81px] text-[16px] text-[#306770]" style={{ lineHeight: '24px', height: '32.843px' }}>
                <a href="#" className="hover:underline">Privacy Policy</a>
                <a href="#" className="hover:underline">Terms of Service</a>
                <span>Copyright 2025</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Beach background image at bottom */}
        <div className="absolute left-[-203px] top-[3545px] w-[1845px] h-[868px] overflow-hidden">
          <img src={imgPlayaChenRioCozumel} 
               alt="Beach" 
               className="w-[94.34%] h-[125.33%] object-cover" 
               style={{ marginLeft: '2.54%', marginTop: '-25.33%' }} />
        </div>
      </div>
    </div>
  );
}

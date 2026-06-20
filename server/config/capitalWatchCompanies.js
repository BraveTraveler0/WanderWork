// Companies that funding applications can be drafted for. Add a new entry here
// to make it selectable in the Capital Watch approval popup — no other code changes needed.
const COMPANIES = [
  {
    id: 'aonverse',
    name: 'Aonverse',
    profile: `Aonverse is a creator-first social marketplace blending short-form content, direct commerce, and digital goods, with a playful, customizable, gaming-inspired feel. Founder and CEO: Darrien Carter, who has experience working with Fortune 500 companies like Coca-Cola, Mitsubishi, and Delta. The idea comes from firsthand exposure to platform risk for creators, highlighted by the recent TikTok ban scare — temporary reversals do not remove structural risk. Current proof: beta is live; team and user base doubled in Q4 2024; hosted a 400+ attendee creative mixer with 50+ influencers and vendors; Georgia Tech graduate program partnership for a Web3 marketplace launching in March; graduated from Square One Startup School; lean team with an experienced CTO and a retired Air Force veteran COO; Atlanta-based, clean cap table, founder-led execution.`,
  },
  {
    id: 'wanderwork',
    name: 'Wanderwork',
    profile: `Wanderwork is an AI-powered remote job search platform that helps job seekers find and land remote roles faster. Founder: Darrien Carter. The platform aggregates remote job listings, uses AI to tailor resumes and cover letters per job, automates recruiter outreach with AI-drafted emails, and matches candidates to jobs via a pairing/scoring engine. It serves job seekers directly through Pro and Premium subscription tiers, with growing weekly active users and recruiter contact volume. Atlanta-based, founder-led execution.`,
  },
];

function getCompanies() {
  return COMPANIES.map(({ id, name }) => ({ id, name }));
}

function getCompanyProfile(id) {
  return COMPANIES.find((c) => c.id === id) || null;
}

module.exports = { COMPANIES, getCompanies, getCompanyProfile };

// Seed data utility - posts sample jobs to the backend
// Usage: node seed-backend.js

const BASE_URL =
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_LOCAL_APP_SERVER_URL ||
  'http://localhost:8000';

const sampleJobs = [
  {
    job_code: 'WH001',
    title: 'Senior Full Stack Developer',
    company: 'TechCorp',
    salary: '$120k-$160k',
    location: [{ city: 'San Francisco', state: 'CA', postalCode: '94102', country: 'USA' }],
    url: 'https://example.com/jobs/1',
    jobType: 'Full-time',
    datePosted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    shortDescription: 'Build scalable web applications with React, Node.js, and PostgreSQL.',
    tags: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS']
  },
  {
    job_code: 'WH002',
    title: 'Product Designer',
    company: 'DesignHub',
    salary: '$100k-$140k',
    location: [{ city: 'New York', state: 'NY', postalCode: '10001', country: 'USA' }],
    url: 'https://example.com/jobs/2',
    jobType: 'Full-time',
    datePosted: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    shortDescription: 'Create beautiful, user-centered designs for our mobile and web products.',
    tags: ['Figma', 'UI/UX', 'Prototyping', 'User Research']
  },
  {
    job_code: 'WH003',
    title: 'DevOps Engineer',
    company: 'CloudSystems',
    salary: '$130k-$170k',
    location: [{ city: 'Austin', state: 'TX', postalCode: '73301', country: 'USA' }],
    url: 'https://example.com/jobs/3',
    jobType: 'Full-time',
    datePosted: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    shortDescription: 'Manage cloud infrastructure and CI/CD pipelines for a high-traffic platform.',
    tags: ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'CI/CD']
  }
];

const sampleCandidate = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+1-555-0123',
  location: [{ locationName: 'Home', city: 'Seattle', state: 'WA', postalCode: '98101' }],
  targetRoles: ['Full Stack Developer', 'Software Engineer'],
  seniority: ['Mid-Level', 'Senior'],
  skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'MongoDB'],
  urls: [{ urlName: 'LinkedIn', urlAddress: 'https://linkedin.com/in/janedoe' }],
  resume: { filename: 'resume.pdf' },
  resumeLink: 'https://example.com/resume.pdf',
  status: 'active',
  paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  graceDays: 7,
  tokenBalance: 30,
  tokensUsed: 5,
  creditsBalance: 100,
  creditsUsed: 0
};

async function seedBackend() {
  try {
    console.log(`Seeding backend at ${BASE_URL}/jobseeker/update`);
    
    const payload = {
      Jobs: sampleJobs,
      Candidates: [sampleCandidate],
      Applications: [],
      Contacts: [],
      CandidateJobPairing: [],
      ContactJobPairing: []
    };

    const response = await fetch(`${BASE_URL}/jobseeker/update`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: payload })
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
    }

    let result = text;
    try {
      result = JSON.parse(text);
    } catch (err) {
      // leave text as-is for logging
    }

    console.log('✅ Seed data posted successfully:', result);
    console.log(`✅ Added ${sampleJobs.length} jobs and ${1} candidate`);
  } catch (error) {
    console.error('❌ Failed to seed backend:', error.message);
    process.exit(1);
  }
}

seedBackend();

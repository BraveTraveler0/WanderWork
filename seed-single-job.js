const API_BASE = 'https://application-server-cwqu.onrender.com';

const sampleJob = {
  title: 'Senior Frontend Developer',
  company: 'TechCorp Solutions',
  location: 'San Francisco, CA',
  type: 'Full-time',
  salary: '$120k - $180k',
  description: 'We are seeking an experienced Frontend Developer to join our growing team.',
  requirements: ['5+ years React experience', 'TypeScript proficiency', 'Strong CSS skills'],
  posted: new Date().toISOString(),
  status: 'active'
};

async function seedJob() {
  console.log(`Posting job to ${API_BASE}/jobseeker/job`);
  
  try {
    const response = await fetch(`${API_BASE}/jobseeker/job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleJob)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Successfully posted job:', result);
  } catch (error) {
    console.error('❌ Failed to post job:', error.message);
  }
}

seedJob();

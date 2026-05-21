/**
 * Sample data to seed the backend database
 * Run this to populate the backend with test data
 */

const BASE_URL = "https://application-server-cwqu.onrender.com";

const sampleData = {
  Candidates: [
    {
      id: 1,
      name: "John Smith",
      email: "john.smith@email.com",
      location: "San Francisco, CA",
      title: "Senior UX Designer",
      tokens: 150,
      premiumDaysLeft: 45,
      skills: ["UX Design", "Figma", "User Research"]
    }
  ],
  Jobs: [
    {
      id: 1,
      title: "Senior Product Designer",
      company: "Google",
      location: "Mountain View, CA",
      description: "We're looking for a talented senior product designer to join our team and help shape the future of our products. You'll work closely with engineers and product managers to design intuitive, beautiful interfaces.",
      skills: ["UX Design", "Product Design", "Figma"],
      postedDate: "2025-12-30",
      isNew: true
    },
    {
      id: 2,
      title: "UX/UI Designer",
      company: "Airbnb",
      location: "San Francisco, CA",
      description: "Join our design team to create delightful experiences for millions of users worldwide. We value innovation, user empathy, and attention to detail in every design decision.",
      skills: ["UI Design", "Prototyping", "Interaction Design"],
      postedDate: "2025-12-28",
      isNew: true
    },
    {
      id: 3,
      title: "Design Systems Lead",
      company: "Figma",
      location: "San Francisco, CA",
      description: "Lead the evolution of our design system by creating scalable, accessible components that empower designers and developers worldwide.",
      skills: ["Design Systems", "Component Design", "Documentation"],
      postedDate: "2025-12-25",
      isNew: false
    },
    {
      id: 4,
      title: "Frontend Developer",
      company: "React Native",
      location: "Remote",
      description: "Build amazing experiences using React and React Native. We're looking for passionate developers who want to make an impact on how people interact with technology.",
      skills: ["React", "JavaScript", "Mobile Development"],
      postedDate: "2025-12-20",
      isNew: false
    },
    {
      id: 5,
      title: "Product Manager",
      company: "Slack",
      location: "San Francisco, CA",
      description: "Shape the future of workplace collaboration as a Product Manager at Slack. Work with design, engineering, and data teams to build products that millions use daily.",
      skills: ["Product Strategy", "Data Analysis", "User Research"],
      postedDate: "2025-12-19",
      isNew: false
    }
  ],
  Applications: [],
  Contacts: [],
  CandidateJobPairing: [],
  ContactJobPairing: []
};

async function seedDatabase() {
  try {
    console.log("Seeding database with sample data...");
    
    const response = await fetch(`${BASE_URL}/jobseeker/update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sampleData),
    });

    if (!response.ok) {
      throw new Error(`Failed to seed data: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Database seeded successfully!");
    console.log("Response:", result);

    // Verify the data was added
    const verifyResponse = await fetch(`${BASE_URL}/jobseeker/`);
    const verifyData = await verifyResponse.json();
    console.log("\n✅ Verification - Current data in database:");
    console.log(`  - Candidates: ${verifyData.Candidates.length}`);
    console.log(`  - Jobs: ${verifyData.Jobs.length}`);
    console.log(`  - Applications: ${verifyData.Applications.length}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export default seedDatabase;

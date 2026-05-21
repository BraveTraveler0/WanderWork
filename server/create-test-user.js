#!/usr/bin/env node

/**
 * Create test user: Darrien Carter
 * Usage: node create-test-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.DATABASE_URI || 'mongodb://localhost:27017/aon';

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Define User model (for authentication)
    const User = mongoose.models.User || 
      mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));

    // Define Candidate model (for job seeker data)
    const Candidate = mongoose.models.Candidate || 
      mongoose.model('Candidate', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.candidates' }));

    // Check if user already exists in User collection
    const existingUser = await User.findOne({ email: 'darrienccarter@gmail.com' });
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    if (!existingUser) {
      // Create User account (for authentication)
      await User.create({
        email: 'darrienccarter@gmail.com',
        password: hashedPassword,
        displayName: 'Darrien Carter',
        slug: 'darrien-carter',
        bio: 'Job seeker test account',
        stars: 0,
        tutcomplete: true,
        tutview: false,
        verified: true
      });
      console.log('✅ User account created');
    } else {
      console.log('ℹ User account already exists');
    }

    // Check if candidate profile exists
    const existingCandidate = await Candidate.findOne({ email: 'darrienccarter@gmail.com' });
    
    if (existingCandidate) {
      console.log('✅ Candidate profile already exists');
      
      // Update candidate with complete data
      const updates = {
        firstName: 'Darrien',
        lastName: 'Carter',
        creditsBalance: existingCandidate.creditsBalance || 150,
        creditsUsed: existingCandidate.creditsUsed || 0,
        graceDays: 7,
        location: existingCandidate.location || [{
          locationName: 'Austin, TX',
          city: 'Austin',
          state: 'Texas',
          country: 'USA'
        }],
        skills: existingCandidate.skills || ['JavaScript', 'React', 'Node.js', 'MongoDB', 'TypeScript'],
        jobPreferences: existingCandidate.jobPreferences || {
          desiredJobTypes: ['Full-time'],
          desiredSalaryRange: { min: 80000, max: 150000 },
          remotePreference: 'hybrid'
        },
        active: true
      };
      
      await Candidate.findOneAndUpdate(
        { email: 'darrienccarter@gmail.com' },
        updates,
        { new: true }
      );
      
      console.log('✅ Candidate profile updated');
    } else {
      // Create new candidate profile
      await Candidate.create({
        email: 'darrienccarter@gmail.com',
        firstName: 'Darrien',
        lastName: 'Carter',
        creditsBalance: 150,
        creditsUsed: 0,
        graceDays: 7,
        location: [{
          locationName: 'Austin, TX',
          city: 'Austin',
          state: 'Texas',
          country: 'USA'
        }],
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'TypeScript'],
        jobPreferences: {
          desiredJobTypes: ['Full-time'],
          desiredSalaryRange: { min: 80000, max: 150000 },
          remotePreference: 'hybrid'
        },
        createdAt: new Date(),
        source: 'test',
        active: true
      });
      console.log('✅ Candidate profile created');
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('   Email: darrienccarter@gmail.com');
    console.log('   Password: password123');
    console.log('   Credits: 150');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createTestUser();

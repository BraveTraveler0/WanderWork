require('dotenv').config();
const mongoose = require('mongoose');

async function checkDB() {
  try {
    await mongoose.connect(process.env.DATABASE_URI || 'mongodb://localhost:27017/aon');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n📂 Collections:', collections.map(c => c.name).join(', '));
    
    // Check JobSeeker collections
    const jobseekerCollections = collections.filter(c => c.name.toLowerCase().includes('jobseeker'));
    console.log('\n🔍 JobSeeker collections:', jobseekerCollections.map(c => c.name).join(', '));
    
    for (const col of jobseekerCollections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  ${col.name}: ${count} documents`);
      
      if (count > 0) {
        const sample = await db.collection(col.name).findOne();
        console.log(`  Sample from ${col.name}:`, JSON.stringify(sample, null, 2).substring(0, 200) + '...');
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkDB();

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

const EMAILS = ['darrienccarter@gmail.com', 'sephrim07@gmail.com'];

async function run() {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB:', process.env.DATABASE_URI);

  const db = mongoose.connection.db;

  for (const email of EMAILS) {
    const lower = email.toLowerCase();

    const u = await db.collection('users').deleteMany({ email: { $regex: new RegExp(`^${lower}$`, 'i') } });
    const c = await db.collection('jobseeker.candidates').deleteMany({ email: { $regex: new RegExp(`^${lower}$`, 'i') } });

    console.log(`${email}: deleted ${u.deletedCount} user(s), ${c.deletedCount} candidate(s)`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });

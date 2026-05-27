const mongoose = require('mongoose')
require('dotenv').config()

const uri = process.env.DATABASE_URI
if (!uri) { console.error('DATABASE_URI not set'); process.exit(1) }

mongoose.connect(uri).then(async () => {
  const Applications = require('./models/JobSeeker/jobSeeker.Application')

  const result = await Applications.deleteMany({
    coverLetter: { $in: [null, ''] },
    $or: [
      { 'resume.content': { $exists: false } },
      { 'resume.content': '' },
      { resume: { $in: [null, ''] } },
      { resume: {} },
    ],
  })

  console.log(`Deleted ${result.deletedCount} empty application records.`)
  process.exit(0)
}).catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

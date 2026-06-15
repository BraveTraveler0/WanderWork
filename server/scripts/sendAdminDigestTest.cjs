'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const mongoose = require('mongoose')

async function main() {
  await mongoose.connect(process.env.DATABASE_URI)
  console.log('Connected to MongoDB')

  const { sendAdminWeeklyDigest } = require('../schedules/adminWeeklyDigest')
  await sendAdminWeeklyDigest()

  await mongoose.disconnect()
  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

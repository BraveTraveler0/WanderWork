'use strict'

// Turns on the shared team view for a member's businesses (same as the Team switch in
// the dashboard): everyone on the business then shares one saved/dismissed list and
// Outbox, and existing personal saves and dismissals are merged into it. Idempotent.
//
// Usage: node server/scripts/capitalWatchShareTeamView.cjs <owner email> "<business name>" ["<business name>" ...]

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mongoose = require('mongoose')
const Member = require('../models/CapitalWatch/capitalWatch.Member')
const Business = require('../models/CapitalWatch/capitalWatch.Business')
const { foldIntoShared } = require('../utils/capitalWatchData')

async function run() {
  const [email, ...names] = process.argv.slice(2)
  if (!email || !names.length) throw new Error('Usage: capitalWatchShareTeamView.cjs <owner email> "<business name>" ...')
  await mongoose.connect(process.env.DATABASE_URI)
  console.log(`database: ${mongoose.connection.db.databaseName}`)
  const owner = await Member.findOne({ email: email.toLowerCase() }).lean()
  if (!owner) throw new Error(`No member ${email}`)
  for (const name of names) {
    const business = await Business.findOne({ name, memberIds: owner._id }).lean()
    if (!business) { console.log(`skip: ${owner.email} has no business named "${name}"`); continue }
    await Business.updateOne({ _id: business._id }, { $set: { sharedView: true } })
    const merged = await foldIntoShared(business._id)
    console.log(`${name}: shared team view on for ${business.memberIds.length} people; merged ${merged} personal save(s)/dismissal(s)`)
  }
  await mongoose.disconnect()
}

run().catch((err) => { console.error(err.message); process.exit(1) })

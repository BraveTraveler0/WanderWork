'use strict'

// One-time, idempotent: makes saves and dismissals personal (each person has their own
// view). Applied opportunities stay shared by the business.
//
// 1. Replaces the unique index (business, grant) with (business, grant, member).
// 2. Each existing save/dismissal goes to the person who made it. Older ones with no
//    owner recorded are copied to everyone on the business, so nobody's view changes.
//
// Usage: node server/scripts/capitalWatchPersonalViews.cjs   (uses DATABASE_URI)

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

async function run() {
  await mongoose.connect(process.env.DATABASE_URI)
  const db = mongoose.connection.db
  const decisions = db.collection('capitalwatch.decisions')
  console.log(`database: ${db.databaseName}`)

  const indexes = await decisions.indexes()
  if (indexes.some((i) => i.name === 'business_1_grant_1')) {
    await decisions.dropIndex('business_1_grant_1')
    console.log('dropped old index business_1_grant_1')
  }
  await decisions.createIndex({ business: 1, grant: 1, member: 1 }, { unique: true })
  console.log('index business_1_grant_1_member_1 ready')

  const teams = new Map((await db.collection('capitalwatch.businesses').find({}, { projection: { memberIds: 1 } }).toArray())
    .map((b) => [String(b._id), b.memberIds || []]))
  const shared = await decisions.find({ status: { $in: ['archived', 'rejected'] }, member: null }).toArray()
  let assigned = 0
  let copied = 0
  for (const d of shared) {
    const team = teams.get(String(d.business)) || []
    const owner = d.decidedBy && team.some((id) => String(id) === String(d.decidedBy)) ? d.decidedBy : null
    if (owner) {
      await decisions.updateOne({ _id: d._id }, { $set: { member: owner } })
      assigned++
      continue
    }
    const { _id, ...rest } = d
    for (const id of team) {
      await decisions.updateOne(
        { business: d.business, grant: d.grant, member: id },
        { $setOnInsert: { ...rest, member: id } },
        { upsert: true },
      )
      copied++
    }
    await decisions.deleteOne({ _id })
  }
  console.log(`saves/dismissals given to their owner: ${assigned}; copied to each teammate: ${copied} (from ${shared.length - assigned} with no owner)`)
  const left = await decisions.countDocuments({ status: { $in: ['archived', 'rejected'] }, member: null })
  console.log(`shared saves/dismissals left: ${left}`)
  await mongoose.disconnect()
}

run().catch((err) => { console.error(err); process.exit(1) })

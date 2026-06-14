'use strict'

/**
 * Manually trigger pairAllCandidates against the live DB.
 *
 * Usage (from the server/ directory):
 *   node scripts/runPairingNow.cjs
 *
 * On Render shell:
 *   cd /opt/render/project/src/server && node scripts/runPairingNow.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const mongoose = require('mongoose')
const { pairAllCandidates } = require('../services/jobPairingService')

async function main() {
  console.log('[pairing] Connecting to DB...')
  await mongoose.connect(process.env.DATABASE_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 120000,
  })
  console.log('[pairing] Connected. Starting pairAllCandidates...')

  const start = Date.now()
  const results = await pairAllCandidates()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const succeeded = results.filter(r => !r.error).length
  const failed = results.filter(r => r.error)

  console.log(`\n[pairing] Done in ${elapsed}s`)
  console.log(`  Candidates processed: ${results.length}`)
  console.log(`  Succeeded: ${succeeded}`)
  if (failed.length) {
    console.log(`  Failed (${failed.length}):`)
    failed.forEach(r => console.log(`    ${r.candidateId}: ${r.error}`))
  }

  const totalPaired = results.filter(r => !r.error).reduce((sum, r) => sum + (r.paired || 0), 0)
  console.log(`  Total job pairings written: ${totalPaired}`)

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('[pairing] Fatal error:', err)
  process.exit(1)
})

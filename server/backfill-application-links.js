#!/usr/bin/env node
/**
 * Backfill JobSeeker application links.
 * Sets candidateId + jobId on applications based on email + job_id/job_code.
 *
 * Usage:
 *   node backfill-application-links.js
 *   node backfill-application-links.js --dry-run
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.DATABASE_URI || 'mongodb://localhost:27017/aon';
const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const candidatesCol = db.collection('jobseeker.candidates');
  const jobsCol = db.collection('jobseeker.jobs');
  const appsCol = db.collection('jobseeker.applications');

  const [candidates, jobs] = await Promise.all([
    candidatesCol.find({}, { projection: { _id: 1, email: 1 } }).toArray(),
    jobsCol.find({}, { projection: { _id: 1, job_code: 1, airtableId: 1 } }).toArray(),
  ]);

  const candidateByEmail = new Map(
    candidates
      .filter((c) => c?.email)
      .map((c) => [String(c.email).toLowerCase(), c._id])
  );

  const jobByKey = new Map();
  for (const job of jobs) {
    if (job?.airtableId) jobByKey.set(String(job.airtableId), job._id);
    if (job?.job_code) jobByKey.set(String(job.job_code), job._id);
  }

  const cursor = appsCol.find({
    $or: [{ candidateId: { $exists: false } }, { jobId: { $exists: false } }],
  });

  let updated = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    const app = await cursor.next();
    if (!app) break;

    const email = String(app.email || '').toLowerCase();
    const candidateId = candidateByEmail.get(email);
    const jobKey = app.job_id || app.jobId || app.job_code || app.airtableId;
    const jobId = jobKey ? jobByKey.get(String(jobKey)) : null;

    if (!candidateId || !jobId) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      updated++;
      continue;
    }

    const res = await appsCol.updateOne(
      { _id: app._id },
      { $set: { candidateId, jobId } }
    );

    if (res.modifiedCount === 1) updated++;
  }

  console.log(`Backfill complete. Updated ${updated}. Skipped ${skipped}. Dry-run: ${DRY_RUN}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

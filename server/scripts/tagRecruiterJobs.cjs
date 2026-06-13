'use strict';
/**
 * tagRecruiterJobs.cjs
 * Sets has_recruiter: true on all jobs whose company matches a recruiter in our DB.
 * Run after any recruiter import or job import.
 *
 * Usage: node server/scripts/tagRecruiterJobs.cjs
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function normalizeCompany(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|company|technologies|solutions|group|holdings|international|worldwide|global)\b\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function tagRecruiterJobs() {
  const jobCol = mongoose.connection.collection('jobseeker.jobs');
  const recruiterCol = mongoose.connection.collection('jobseeker.recruiters');

  // Build set of normalized company names from recruiter DB
  const recruiters = await recruiterCol.find({}, { projection: { company: 1 } }).toArray();
  const recruiterCompanySet = new Set(
    recruiters.map(r => normalizeCompany(r.company)).filter(c => c.length >= 3)
  );
  console.log(`[tagRecruiterJobs] ${recruiterCompanySet.size} recruiter companies`);

  // Fetch all jobs with a company name
  const jobs = await jobCol.find(
    { company: { $exists: true, $nin: ['', null, 'Unknown'] } },
    { projection: { _id: 1, company: 1, has_recruiter: 1 } }
  ).toArray();
  console.log(`[tagRecruiterJobs] ${jobs.length} jobs to check`);

  const toTag = [];
  const toUntag = [];

  for (const job of jobs) {
    const norm = normalizeCompany(job.company);
    const matched = norm.length >= 3 && recruiterCompanySet.has(norm);
    if (matched && !job.has_recruiter) toTag.push(job._id);
    else if (!matched && job.has_recruiter) toUntag.push(job._id);
  }

  console.log(`[tagRecruiterJobs] Tagging ${toTag.length}, untagging ${toUntag.length}`);

  if (toTag.length > 0) {
    const res = await jobCol.updateMany({ _id: { $in: toTag } }, { $set: { has_recruiter: true } });
    console.log(`[tagRecruiterJobs] Tagged ${res.modifiedCount} jobs`);
  }
  if (toUntag.length > 0) {
    const res = await jobCol.updateMany({ _id: { $in: toUntag } }, { $unset: { has_recruiter: '' } });
    console.log(`[tagRecruiterJobs] Untagged ${res.modifiedCount} jobs`);
  }

  const total = await jobCol.countDocuments({ has_recruiter: true });
  console.log(`[tagRecruiterJobs] Done. ${total} jobs now have has_recruiter: true`);
}

if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URI)
    .then(() => tagRecruiterJobs())
    .then(() => mongoose.disconnect())
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { tagRecruiterJobs };

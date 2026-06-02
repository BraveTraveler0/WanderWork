// One-time import: loads Indeed JSON exports from Jobs/Jobs - June into MongoDB
// Run: node server/scripts/importIndeedJobs.cjs
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const FILES_DIR = path.join(__dirname, '../../Jobs/Jobs - June');

function generateJobCode(urlNormalized) {
  return `J${crypto.createHash('sha1').update(String(urlNormalized || '')).digest('hex').slice(0, 7).toUpperCase()}`;
}

function firstText(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const joined = value.filter(Boolean).join(', ').trim();
      if (joined) return joined;
      continue;
    }
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function stripHtml(str) {
  return String(str || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeJobType(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ').trim();
  return String(value || '').trim();
}

function normalizeLocation(loc) {
  if (!loc) return 'Unconfirmed';
  const l = stripHtml(loc);
  if (/remote/i.test(l)) return 'Remote';
  // Strip zip codes: "Mesa, AZ 85206" -> "Mesa, AZ"
  return l.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
}

function inferSource(record, url) {
  const explicit = firstText(record.source);
  if (explicit) return explicit;
  if (/indeed\.com/i.test(url)) return 'Indeed';
  if (/remotive\.com/i.test(url)) return 'remotive';
  return 'n8n';
}

function parseDate(record) {
  const raw = firstText(record.datePosted, record.date_posted, record.postedAt, record.postedDate, record.rawDate);
  if (!raw) return new Date();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;
  if (typeof raw === 'string') {
    const withZ = new Date(`${raw}Z`);
    if (!Number.isNaN(withZ.getTime())) return withZ;
  }
  return new Date();
}

async function main() {
  await mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB');

  const col = mongoose.connection.collection('jobseeker.jobs');
  const requestedFiles = process.argv.slice(2).map((file) => path.basename(file));
  const files = fs.readdirSync(FILES_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => requestedFiles.length === 0 || requestedFiles.includes(f));
  if (requestedFiles.length && files.length !== requestedFiles.length) {
    const found = new Set(files);
    const missing = requestedFiles.filter((file) => !found.has(file));
    throw new Error(`Requested import file(s) not found in ${FILES_DIR}: ${missing.join(', ')}`);
  }
  console.log(`Found ${files.length} file(s):`, files);

  let totalUpserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const records = JSON.parse(fs.readFileSync(path.join(FILES_DIR, file), 'utf8'));
    console.log(`\nProcessing ${file} - ${records.length} records`);
    let upserted = 0, updated = 0, skipped = 0, errors = 0;

    for (const r of records) {
      try {
        const url = firstText(r.url, r.id, r.applyUrl, r.apply_url);
        if (!url) { skipped++; continue; }

        const urlNormalized = url.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
        const title = stripHtml(firstText(r.positionName, r.title, r.jobTitle, r.job_title, r.name));
        const company = stripHtml(firstText(r.company, r.companyName, r.employer, 'Unknown'));
        const descriptionRaw = firstText(
          r.description,
          r.description_short,
          r.descriptionShort,
          r.jobDescription,
          r.job_description,
          r.companyInfo?.companyDescription
        );
        const fallbackDescription = `${title} at ${company}. Full details are available through the job posting link.`;
        const description_short = stripHtml(descriptionRaw).slice(0, 500) || fallbackDescription;
        const providedJobCode = firstText(r.jobCode, r.job_code, r.code);

        const doc = {
          title,
          company,
          url,
          url_normalized: urlNormalized,
          salary: r.salary ? String(r.salary).trim() : 'Not Listed',
          location: normalizeLocation(r.location),
          job_type: normalizeJobType(r.jobType || r.job_type || r.type),
          date_posted: parseDate(r),
          description_short,
          source: inferSource(r, url),
          score: 0,
          tags: [],
          cover_letter: '',
          updatedAt: new Date(),
        };

        if (!doc.title) { skipped++; continue; }

        const update = {
          $set: doc,
          $setOnInsert: {
            job_code: providedJobCode || generateJobCode(urlNormalized),
            createdAt: new Date(),
          },
        };
        if (providedJobCode) update.$set.job_code = providedJobCode;

        const result = await col.updateOne({ url_normalized: urlNormalized }, update, { upsert: true });
        if (result.upsertedCount) upserted++;
        else updated++;
      } catch (err) {
        console.error('Error:', err.message);
        errors++;
      }
    }

    console.log(`  Upserted: ${upserted}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
    totalUpserted += upserted;
    totalUpdated += updated;
    totalSkipped += skipped;
    totalErrors += errors;
  }

  console.log(`\nDone. Total upserted: ${totalUpserted}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

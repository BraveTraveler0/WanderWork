const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { uploadToR2, isConfigured: r2Configured } = require('../../utils/r2.js');
const dbUtils = require('../../utils/dbUtils.js');
const Candidates = require('../../models/JobSeeker/jobSeeker.Candidate.js');
const Jobs = require('../../models/JobSeeker/jobSeeker.Job.js');
const Contacts = require('../../models/JobSeeker/jobSeekerContact.js');
const Applications = require('../../models/JobSeeker/jobSeeker.Application.js');
const CandidateJobPairings = require('../../models/JobSeeker/jobSeeker.CandidateJobPairing.js');
const ContactJobPairings = require('../../models/JobSeeker/jobSeekerContactJobPairing.js');
const { pairCandidateJobs, pairAllCandidates } = require('../../services/jobPairingService.js');
const { getRecruiterContactsMaxOverride } = require('../../config/recruiterContactsOverrides');
const { easternDaysElapsed } = require('../../utils/easternDayReset');
const { formatCandidateLocation, sanitizeDocumentContact, sanitizeResumeHeader } = require('../../utils/resumeContact');

function textValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(' ');
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
        return Object.values(value).map(textValue).filter(Boolean).join(' ');
    }
    return String(value);
}

function cleanTextValue(value) {
    return textValue(value).trim();
}

async function extractPdfText(fileBuffer) {
    const pdfParse = require('pdf-parse');

    // pdf-parse v1 exported a callable function. v2 exports PDFParse.
    if (typeof pdfParse === 'function') {
        const parsed = await pdfParse(fileBuffer);
        return parsed?.text || '';
    }

    if (typeof pdfParse.PDFParse === 'function') {
        const parser = new pdfParse.PDFParse({ data: fileBuffer });
        try {
            const parsed = await parser.getText();
            return parsed?.text || '';
        } finally {
            await parser.destroy();
        }
    }

    throw new Error('Unsupported pdf-parse API. Expected callable parser or PDFParse class.');
}
// ── Junk job detection (shared between read-time filter and DB purge) ─────────
function isJunkJobRecord(job) {
    // Check all possible title field names used by scrapers
    const title = cleanTextValue(job.title || job.job_title || job.name || '')
    // "7,000+ Digital Designer jobs in United States" / "13,000+ Marketing Designer jobs"
    if (/^\d[\d,]*\+?\s+.+\bjobs?\b/i.test(title)) return true
    // "Best Remote UX Designer Jobs in NYC, NY 2026"
    if (/\bbest\b.+\bjobs?\b/i.test(title)) return true
    // Any title containing "jobs in [place]" with a 4-digit year — search listing pages
    if (/\bjobs?\b.+\bin\b.+\d{4}/i.test(title)) return true
    // Aggregator headings starting with a digit: "13,000 Marketing jobs"
    if (/\bjobs?\s+in\b/i.test(title) && /^\d/.test(title)) return true
    // "Job Application for [role]" — fake aggregator titles
    if (/^job\s+application\s+for\b/i.test(title)) return true
    const desc = [job.description_short, job.shortDescription, job.summary, job.description, job.why_matched].map(textValue).filter(Boolean).join(' ')
    if (/skip\s+to\s+main\s+content/i.test(desc)) return true
    if (/why\s+you\s+were\s+matched/i.test(desc)) return true
    // "Reposted/Posted 16 Days AgoSave/AgoSaved" — metadata bleeding into description
    if (/(?:re)?posted\s+\d+\s+days?\s+ago\s*saved?\b/i.test(desc)) return true
    if (/\d+\s+days?\s+ago\s*saved?\b/i.test(desc)) return true
    // "Any time (N,NNN)" — LinkedIn search facet text
    if (/\bany\s+time\s+\(\d[\d,]+\)/i.test(desc)) return true
    // Cookie/privacy/terms policy pages scraped instead of a real job description
    if (/\bthis\s+(?:cookie|privacy)\s+policy\b/i.test(desc)) return true
    if (/\bterms\s+(?:of\s+service|and\s+conditions)\b.{0,200}applies\s+to/i.test(desc)) return true
    // Three or more facet-count patterns "(13,334)" "(10,745)"
    const facetCounts = (desc.match(/\(\d[\d,]{2,}\)/g) || []).length
    if (facetCounts >= 3) return true
    return false
}

// ── Skills extraction from resume text ───────────────────────────────────────
const SKILL_KEYWORDS = [
    // Languages
    'JavaScript','TypeScript','Python','Java','C++','C#','Go','Rust','Ruby','PHP','Swift','Kotlin',
    'Scala','R','MATLAB','Perl','Bash','Shell','Dart','Elixir','Haskell','Clojure','Lua',
    // Frontend
    'React','Vue','Angular','Next.js','Nuxt.js','Svelte','HTML','CSS','Sass','Tailwind',
    'Material UI','Bootstrap','jQuery','Redux','Zustand','Vite','Webpack','Figma',
    'Sketch','Adobe XD','Storybook','Three.js','D3.js',
    // Backend
    'Node.js','Express','Django','Flask','FastAPI','Spring Boot','Rails','Laravel','ASP.NET',
    'NestJS','Fastify','GraphQL','REST','gRPC','WebSocket','tRPC',
    // Databases
    'PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','SQLite','DynamoDB','Cassandra',
    'Firebase','Supabase','Prisma','Sequelize','Mongoose','SQL','NoSQL',
    // Cloud / DevOps
    'AWS','Azure','GCP','Docker','Kubernetes','Terraform','Ansible','Jenkins',
    'GitHub Actions','CircleCI','CI/CD','Linux','Nginx','Apache','Vercel','Netlify',
    // Data / AI / ML
    'Machine Learning','Deep Learning','TensorFlow','PyTorch','Pandas','NumPy',
    'Scikit-learn','NLP','Computer Vision','Data Analysis','Data Science',
    'Power BI','Tableau','Spark','Hadoop','Airflow','dbt','LLM','OpenAI','LangChain',
    // Mobile
    'iOS','Android','React Native','Flutter','Ionic','Xcode','Swift UI','Kotlin Multiplatform',
    // Testing
    'Jest','Vitest','Cypress','Playwright','Selenium','PyTest','JUnit','Mocha','Chai',
    // APIs / Tooling
    'Git','GitHub','GitLab','Bitbucket','Postman','Swagger','OpenAPI','Jira','Confluence',
    'Notion','Linear','Figma','Slack',
    // Design
    'UX','UI','Prototyping','Wireframing','User Research','Accessibility','WCAG',
    'Adobe Photoshop','Adobe Illustrator','InDesign','Canva',
    // Project / Product
    'Agile','Scrum','Kanban','Product Management','Project Management',
    'Roadmapping','A/B Testing','OKRs','Stakeholder Management',
    // Business / Marketing
    'SEO','SEM','Google Ads','Facebook Ads','Email Marketing','Content Marketing',
    'Salesforce','HubSpot','Marketo','Mixpanel','Amplitude','Google Analytics',
    // Finance / Ops
    'Excel','Financial Modeling','QuickBooks','SAP','ERP','SQL Server',
    // Soft skills
    'Leadership','Communication','Teamwork','Problem Solving','Analytical Thinking',
    'Cross-functional Collaboration','Mentoring',
]

function extractSkillsFromText(text) {
    if (!text || typeof text !== 'string') return []
    const found = new Set()
    for (const skill of SKILL_KEYWORDS) {
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i').test(text)) {
            found.add(skill)
        }
    }
    return Array.from(found)
}

function extractTargetRoleFromText(text) {
    if (!text || typeof text !== 'string') return ''
    const titlePatterns = [
        /^([A-Z][a-zA-Z &\/\-|]+(?:Engineer|Developer|Designer|Manager|Analyst|Architect|Lead|Director|Scientist|Consultant|Specialist|Coordinator|Associate|Officer|Executive|Representative|Administrator|Strategist|Producer|Writer|Editor))(?:\s*[\|\/\-]|$)/m,
        /(?:title|position|role|job title)\s*[:\-]\s*([A-Z][^\n]{3,60})/i,
        /^([A-Z][a-zA-Z &\/\-|]+)[\r\n]/m,
    ]
    for (const pattern of titlePatterns) {
        const match = text.match(pattern)
        const candidate = match?.[1]?.trim()
        if (candidate && candidate.length >= 5 && candidate.length <= 80) return candidate
    }
    return ''
}

// ── Resume field extraction — used at startup backfill and per-request ────────
function deriveResumeFields(resumeText) {
    if (!resumeText) return { workExperience: '', education: '' }
    const lines = resumeText.split(/\r?\n/)
    const WORK_HEADINGS = [
        'experience', 'work experience', 'professional experience', 'employment history',
        'employment', 'work history', 'career history', 'relevant experience',
    ]
    const EDU_HEADINGS = [
        'education', 'education and training', 'academic background',
        'academic history', 'qualifications',
    ]
    const ALL_HEADINGS = [
        ...WORK_HEADINGS, ...EDU_HEADINGS,
        'summary', 'professional summary', 'objective', 'profile', 'about', 'highlights',
        'skills', 'technical skills', 'core competencies', 'key skills',
        'projects', 'portfolio', 'certifications', 'licenses', 'credentials',
        'awards', 'achievements', 'honors', 'publications', 'references', 'additional',
        'volunteer', 'languages', 'interests', 'activities',
    ]
    const makeRe = (arr) => new RegExp(
        `^(?:${arr.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:\\-]?\\s*$`,
        'i'
    )
    const allSectionRe = makeRe(ALL_HEADINGS)
    const extract = (headingRe) => {
        let start = -1
        for (let i = 0; i < lines.length; i++) {
            if (headingRe.test(lines[i].trim())) { start = i + 1; break }
        }
        if (start < 0) return ''
        const out = []
        for (let i = start; i < lines.length; i++) {
            const trimmed = lines[i].trim()
            // Stop only at exact section headings — not at content that starts with those words
            if (out.length > 0 && allSectionRe.test(trimmed) && !headingRe.test(trimmed)) break
            out.push(lines[i])
        }
        while (out.length && !out[out.length - 1].trim()) out.pop()
        return out.join('\n').trim()
    }
    return {
        workExperience: extract(makeRe(WORK_HEADINGS)),
        education: extract(makeRe(EDU_HEADINGS)),
    }
}

function inferNameFromFilename(filename) {
    const base = path.basename(String(filename || ''), path.extname(String(filename || '')));
    const cleaned = base
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[_-]+/g, ' ')
        .replace(/\b(?:resume|cv|curriculum|vitae|copy|final|updated|new)\b/gi, ' ')
        .replace(/\b\d{1,4}(?:[.\-/]\d{1,2}){0,2}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const parts = cleaned.split(/\s+/).filter((part) => /^[A-Za-z][A-Za-z'.-]*$/.test(part));
    if (parts.length < 2) return { firstName: '', lastName: '' };
    const format = (value) => value
        .split(/(\s+|-)/)
        .map((part) => /^[A-Za-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part)
        .join('');
    return {
        firstName: format(parts[0]),
        lastName: format(parts.slice(1, 3).join(' ')),
    };
}

async function extractResumeTextFromFile(file) {
    const ext = path.extname(file?.originalname || '').toLowerCase();
    let extractedText = '';
    try {
        const fileBuffer = file.buffer;
        if (ext === '.pdf') {
            extractedText = await extractPdfText(fileBuffer);
        } else if (ext === '.docx' || ext === '.doc') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedText = result.value || '';
        } else if (ext === '.rtf') {
            const raw = fileBuffer.toString('latin1');
            extractedText = raw
                .replace(/\\pard[^\\]*/gi, '\n')
                .replace(/\\'[0-9a-f]{2}/gi, '')
                .replace(/\\[a-z]+\-?\d*\s?/gi, '')
                .replace(/[{}\\]/g, '')
                .replace(/\r?\n\s*\r?\n/g, '\n\n')
                .replace(/[ \t]+/g, ' ')
                .trim();
        } else if (ext === '.txt') {
            extractedText = fileBuffer.toString('utf-8');
        }
    } catch (extractErr) {
        console.warn('Resume text extraction failed (non-fatal):', extractErr.message);
    }
    return extractedText;
}

async function parseResumeTextFields(extractedText, filename = '') {
    let aiParsed = null;
    if (extractedText && process.env.OPENAI_API_KEY) {
        try {
            const aiResponse = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a resume parser. Extract structured data from the resume text and return ONLY valid JSON with these exact keys:
- firstName: string (first name only)
- lastName: string (last name only, may be empty)
- phone: string (phone number, empty if not found)
- targetRole: string (most recent job title or stated career goal)
- skills: array of strings (technical and professional skills)
- workExperience: string (all work history, each job separated by a blank line, include company, title, dates, and responsibilities)
- education: string (all education entries, each separated by a blank line, include school, degree, dates)
- summary: string (professional summary or objective if present, otherwise empty string)
- location: string (city and state/country if found, otherwise empty)
- inferredKeywords: array of up to 20 strings - the most important professional keywords from this resume (job titles held, industries, key technologies, domain terms). These are used for job matching so be specific and diverse.`
                        },
                        {
                            role: 'user',
                            content: extractedText.slice(0, 12000)
                        }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: 2000,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );
            aiParsed = JSON.parse(aiResponse.data.choices[0].message.content);
        } catch (aiErr) {
            console.warn('AI resume parsing failed, falling back to regex:', aiErr.message);
        }
    }

    const { workExperience: regexWork, education: regexEdu } = deriveResumeFields(extractedText);
    const regexSkills = extractSkillsFromText(extractedText);
    const regexRole = extractTargetRoleFromText(extractedText);
    const regexPhone = extractedText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]?.trim() || '';
    const regexEmail = extractedText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0]?.trim() || '';
    const regexLocation = (() => {
        const m = extractedText.match(/\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})\b/);
        return m ? { locationName: `${m[1].trim()}, ${m[2]}`, city: m[1].trim(), state: m[2] } : null;
    })();
    const nameLines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5);
    const nameLine = nameLines.find(l => /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(l));
    const regexFirstName = nameLine ? nameLine.split(/\s+/)[0] : '';
    const regexLastName = nameLine ? nameLine.split(/\s+/).slice(1).join(' ') : '';
    const filenameName = inferNameFromFilename(filename);

    const finalWork = aiParsed?.workExperience || regexWork;
    const finalEdu = aiParsed?.education || regexEdu;
    const aiSkills = Array.isArray(aiParsed?.skills) ? aiParsed.skills : [];
    const aiInferredKeywords = Array.isArray(aiParsed?.inferredKeywords) ? aiParsed.inferredKeywords : [];
    const finalRole = cleanTextValue(aiParsed?.targetRole || regexRole || '');
    const finalPhone = cleanTextValue(aiParsed?.phone || regexPhone || '');
    const finalFirstName = cleanTextValue(aiParsed?.firstName || regexFirstName || filenameName.firstName || '');
    const finalLastName = cleanTextValue(aiParsed?.lastName || regexLastName || filenameName.lastName || '');
    const finalSummary = cleanTextValue(aiParsed?.summary || '');
    const finalEmail = regexEmail;
    const finalLocation = (() => {
        if (aiParsed?.location) {
            const locationText = cleanTextValue(aiParsed.location);
            const parts = locationText.split(',').map(s => s.trim());
            return parts[0] ? { locationName: locationText, city: parts[0], state: parts[1] || '' } : null;
        }
        return regexLocation;
    })();

    return {
        aiParsed,
        regexSkills,
        aiSkills,
        aiInferredKeywords,
        finalWork,
        finalEdu,
        finalRole,
        finalPhone,
        finalFirstName,
        finalLastName,
        finalSummary,
        finalEmail,
        finalLocation,
        extractionOk: !!(aiParsed || finalWork || finalEdu || aiSkills.length || finalFirstName || finalLastName),
    };
}

async function parseResumeFile(file) {
    const extractedText = await extractResumeTextFromFile(file);
    const parsed = await parseResumeTextFields(extractedText, file?.originalname || '');
    return { extractedText, ...parsed };
}

// Extracts work_experience and education from resume_text for candidates missing those fields.
async function backfillCandidateResumeFields() {
    try {
        const candidates = await Candidates.find(
            { resume_text: { $exists: true, $ne: '' } },
            { _id: 1, resume_text: 1, work_experience: 1, education: 1 }
        ).lean().exec()
        let updated = 0
        for (const candidate of candidates) {
            if (candidate.work_experience && candidate.education) continue
            const resumeText = typeof candidate.resume_text === 'string' ? candidate.resume_text : ''
            const { workExperience, education } = deriveResumeFields(resumeText)
            const update = {}
            if (workExperience && !candidate.work_experience) update.work_experience = workExperience
            if (education && !candidate.education) update.education = education
            if (!Object.keys(update).length) continue
            await Candidates.updateOne({ _id: candidate._id }, { $set: update })
            updated++
        }
        if (updated > 0) console.log(`[backfillCandidateResumeFields] Updated ${updated} candidate(s) with extracted resume fields`)
    } catch (e) {
        console.warn('[backfillCandidateResumeFields] Failed:', e.message)
    }
}

// Deletes all junk jobs from the DB — call once at startup.
async function purgeJunkJobs() {
    try {
        const JobDynamic = mongoose.models.JobDynamic ||
            mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }))
        const all = await JobDynamic.find({}, { _id: 1, title: 1, description_short: 1, shortDescription: 1, summary: 1, description: 1 }).lean().exec()
        const junkIds = all.filter(isJunkJobRecord).map((j) => j._id)
        if (junkIds.length === 0) return
        const result = await JobDynamic.deleteMany({ _id: { $in: junkIds } })
        _invalidateJobsCache()
        console.log(`[purgeJunkJobs] Deleted ${result.deletedCount} junk job record(s)`)
    } catch (e) {
        console.warn('[purgeJunkJobs] Failed:', e.message)
    }
}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const RESUME_EXTRACT_WEBHOOK = process.env.N8N_RESUME_EXTRACT_WEBHOOK_URL || '';
const { getPublicServerUrl } = require('../../utils/publicUrls');
const PUBLIC_SERVER_URL = getPublicServerUrl();
const CUSTOM_REQUEST_WEBHOOK = process.env.N8N_CUSTOM_REQUEST_WEBHOOK_URL || '';

async function updateAirtableCandidateSkills(candidate, skills) {
    if (!AIRTABLE_TOKEN) return { updated: false, reason: 'missing_token' };
    if (!AIRTABLE_BASE_ID) return { updated: false, reason: 'missing_base_id' };
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Candidates`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    const fields = { skills };
    const recordId = candidate.airtableId;

    if (recordId) {
        const response = await fetch(`${baseUrl}/${recordId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'airtableId' };
    }

    if (candidate.email) {
        const filter = encodeURIComponent(`LOWER({email})=LOWER('${candidate.email}')`);
        const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
        if (!lookup.ok) {
            return { updated: false, reason: `airtable_lookup_${lookup.status}` };
        }
        const data = await lookup.json();
        const first = data?.records?.[0];
        if (!first?.id) return { updated: false, reason: 'airtable_not_found' };
        const response = await fetch(`${baseUrl}/${first.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'email_lookup' };
    }

    return { updated: false, reason: 'missing_identifier' };
}

async function updateAirtableCandidateResume(candidate, resumeLink) {
    if (!AIRTABLE_TOKEN) return { updated: false, reason: 'missing_token' };
    if (!candidate) return { updated: false, reason: 'missing_candidate' };
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Candidates`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    // Only update resume_link. Do NOT send resume_text: '' — that would clear Airtable's
    // text field and cause the hourly sync to wipe MongoDB's extracted data.
    const fields = {
        resume_link: resumeLink || '',
    };

    if (candidate.airtableId) {
        const response = await fetch(`${baseUrl}/${candidate.airtableId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'airtableId' };
    }

    if (candidate.email) {
        const filter = encodeURIComponent(`LOWER({email})=LOWER('${candidate.email}')`);
        const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
        if (!lookup.ok) {
            return { updated: false, reason: `airtable_lookup_${lookup.status}` };
        }
        const data = await lookup.json();
        const first = data?.records?.[0];
        if (!first?.id) return { updated: false, reason: 'airtable_not_found' };
        const response = await fetch(`${baseUrl}/${first.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'email_lookup' };
    }

    return { updated: false, reason: 'missing_identifier' };
}

const UNKNOWN_COMPANY_VALUES = new Set([
    'unknown', 'n/a', 'na', 'none', 'null', 'undefined', '-', 'company', 'company name', 'join',
    'creative agency', 'agency', 'ai', 'salary', 'compensation', 'benefits', 'pay', 'not specified',
    'not available', 'name'
]);

const GENERIC_COMPANY_WORDS = new Set([
    'unknown', 'company', 'agency', 'creative', 'studio', 'firm', 'startup', 'team', 'remote',
    'hybrid', 'ai', 'design', 'designer', 'developer', 'engineer', 'manager', 'director', 'lead',
    'senior', 'junior', 'staff', 'principal', 'freelance', 'contract', 'full', 'time', 'part',
    'position', 'role', 'job', 'careers', 'opportunity', 'ui', 'ux', 'salary', 'compensation',
    'benefits', 'pay'
]);

const TECH_STACK_WORDS = new Set([
    'javascript', 'typescript', 'react', 'reactjs', 'vue', 'angular', 'node', 'nodejs', 'deno',
    'express', 'next', 'nextjs', 'nuxt', 'svelte', 'sveltekit', 'jquery', 'bootstrap', 'tailwind',
    'webpack', 'vite', 'rollup', 'babel', 'graphql', 'rest', 'api', 'aws', 'azure', 'gcp', 'docker',
    'kubernetes', 'terraform', 'python', 'java', 'c', 'c++', 'c#', 'php', 'ruby', 'rails', 'go',
    'golang', 'rust', 'swift', 'kotlin', 'dart', 'flutter', 'ios', 'android', 'figma', 'sketch',
    'adobe', 'photoshop', 'illustrator', 'xd', 'sql', 'postgres', 'postgresql', 'mysql', 'mongodb'
]);

const ATS_PLATFORMS = new Set([
    'greenhouse', 'lever', 'workday', 'myworkdayjobs', 'ashbyhq', 'ashby', 'smartrecruiters',
    'applytojob', 'jobvite', 'icims', 'jazz', 'recruitee', 'bamboohr', 'indeed', 'linkedin',
    'glassdoor', 'monster', 'ziprecruiter', 'wellfound', 'angellist', 'careers', 'jobs',
    'workable', 'personio', 'teamtailor'
]);

const isRomanNumeral = (value) => /^[IVXLCDM]+$/i.test(value);

const stripHtml = (value) => textValue(value).replace(/<[^>]*>/g, ' ');

const normalizeText = (value) => stripHtml(value).replace(/\s+/g, ' ').trim();

const splitWords = (value) => textValue(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const hasEnoughLetters = (value) => {
    const letters = (value.match(/[A-Za-z]/g) || []).length;
    const digits = (value.match(/\d/g) || []).length;
    if (letters === 0) return false;
    if (digits > letters) return false;
    return true;
};

const stripCompanyLabels = (value) => {
    if (!value) return '';
    let cleaned = String(value).trim();
    const nameIndex = cleaned.search(/company\s*name\s*[:\-]/i);
    if (nameIndex >= 0) {
        cleaned = cleaned.slice(nameIndex).replace(/company\s*name\s*[:\-]\s*/i, '').trim();
    } else {
        const labelMatch = cleaned.match(/^(?:company\s*name|company|name)\s*[:\-]\s*(.+)$/i);
        if (labelMatch) {
            cleaned = String(labelMatch[1] || '').trim();
        }
    }
    cleaned = cleaned.replace(/^(?:salary|compensation|benefits|pay)\s*[:\-]\s*/i, '').trim();
    const cutoff = cleaned.match(/^(.*?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i);
    if (cutoff) {
        cleaned = String(cutoff[1] || '').trim();
    }
    return cleaned;
};

const getJobDescription = (job) => {
    const candidates = [
        job.description,
        job.shortDescription,
        job.jobDescription,
        job.summary,
        job.description_short,
        job.descriptionShort,
        job.longDescription,
        job.job_description,
        job.description_text,
        job.jobDescriptionText,
        job.Job_Description
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate === 'string') {
            const normalized = normalizeText(candidate);
            if (normalized.length >= 10) return normalized;
        }
        if (Array.isArray(candidate)) {
            const normalized = normalizeText(candidate.filter(Boolean).join(' '));
            if (normalized.length >= 10) return normalized;
        }
        if (candidate && typeof candidate === 'object') {
            const values = Object.values(candidate).filter((v) => typeof v === 'string');
            const normalized = normalizeText(values.join(' '));
            if (normalized.length >= 10) return normalized;
        }
    }
    return '';
};

const looksLikeCompany = (value, titleWords) => {
    if (!value) return false;
    const trimmed = cleanTextValue(value);
    if (!trimmed) return false;
    if (trimmed.length < 3 && !/^[A-Z]{2,3}$/.test(trimmed)) return false;
    if (isRomanNumeral(trimmed)) return false;
    if (!hasEnoughLetters(trimmed)) return false;
    if (/\bday\s+week\b/i.test(trimmed)) return false;
    if (/\bsalary\b|\bcompensation\b|\bbenefits\b|\bpay\b/i.test(trimmed)) return false;
    if (/[\\/]/.test(trimmed)) return false;
    const words = splitWords(trimmed);
    if (!words.length) return false;
    if (words.every((word) => GENERIC_COMPANY_WORDS.has(word))) return false;
    if (words.every((word) => TECH_STACK_WORDS.has(word))) return false;
    if (titleWords && words.every((word) => titleWords.has(word))) return false;
    return true;
};

const normalizeCompanyValue = (value, titleWords) => {
    if (!value) return '';
    const trimmed = cleanTextValue(value);
    if (!trimmed) return '';
    let cleaned = trimmed.replace(/^[\"'“”‘’]+|[\"'“”‘’,.;:]+$/g, '').trim();
    cleaned = stripCompanyLabels(cleaned);
    const lowered = cleaned.toLowerCase();
    if (UNKNOWN_COMPANY_VALUES.has(lowered)) return '';
    if (isRomanNumeral(cleaned)) return '';
    if (!hasEnoughLetters(cleaned)) return '';
    if (/^\d+$/.test(cleaned)) return '';
    if (/\bday\s+week\b/i.test(cleaned)) return '';
    if (/\bsalary\b|\bcompensation\b|\bbenefits\b|\bpay\b/i.test(cleaned)) return '';
    if (/[\\/]/.test(cleaned)) return '';
    const joinMatch = cleaned.match(/^(?:join|at|with)\s+(.+)$/i);
    if (joinMatch && looksLikeCompany(joinMatch[1], titleWords)) {
        return joinMatch[1].trim();
    }
    return cleaned;
};

const isUnknownCompany = (value, title) => {
    if (!value) return true;
    const trimmed = cleanTextValue(value);
    if (!trimmed) return true;
    const lowered = trimmed.toLowerCase();
    if (/^company\s*name\b/.test(lowered) || /^company\b/.test(lowered)) return true;
    if (UNKNOWN_COMPANY_VALUES.has(lowered)) return true;
    if (isRomanNumeral(trimmed)) return true;
    if (!hasEnoughLetters(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (/\bday\s+week\b/i.test(trimmed)) return true;
    if (/\bsalary\b|\bcompensation\b|\bbenefits\b|\bpay\b/i.test(trimmed)) return true;
    if (/[\\/]/.test(trimmed)) return true;
    const words = splitWords(trimmed);
    if (!words.length) return true;
    const titleWords = new Set(splitWords(title || ''));
    if (words.every((word) => GENERIC_COMPANY_WORDS.has(word) || titleWords.has(word))) return true;
    if (words.every((word) => TECH_STACK_WORDS.has(word) || titleWords.has(word))) return true;
    return false;
};

const inferCompanyFromUrl = (url) => {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./i, '');
        const parts = host.split('.').filter(Boolean);
        if (!parts.length) return '';
        const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        if (ATS_PLATFORMS.has(root.toLowerCase())) return '';
        return root
            .split('-')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    } catch {
        return '';
    }
};

const inferCompanyFromDescription = (description, title) => {
    if (!description) return '';
    const text = normalizeText(description);
    if (!text) return '';

    const titleWords = new Set(splitWords(title || ''));

    const patterns = [
        /(?:^|[.!?\n]\s*)(?:at|with|join)\s+([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})/,
        /company\s*name\s*[:\-]\s*([A-Za-z0-9][^.\n\r]+?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i,
        /company\s*[:\-]\s*([A-Za-z0-9][^.\n\r]+?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i,
        /name\s*[:\-]\s*([A-Za-z0-9][^.\n\r]+?)(?:\s*(?:salary|compensation|benefits|pay)\b|[.\n\r]|$)/i,
        /\b([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})\s+as\s+(?:a|an|the)\b/,
        /(?:^|[.!?\n]\s*)(?:company|company overview|about)\s*[:\-]?\s*([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})/,
        /\b([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,4})\s+(?:is|are|was|were)\s+(?:a|an|the)\b/,
        /\b([A-Z]{2,}(?:\s+[A-Z]{2,}){0,3})\b/
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const candidate = normalizeCompanyValue(match[1], titleWords);
            if (candidate && looksLikeCompany(candidate, titleWords)) return candidate;
        }
    }

    const counts = new Map();
    const capsPattern = /\b([A-Za-z0-9][\w&.'-]+(?:\s+[A-Za-z0-9][\w&.'-]+){0,3})\b/g;
    let found = capsPattern.exec(text);
    while (found) {
        const candidate = normalizeCompanyValue(found[1], titleWords);
        if (candidate && looksLikeCompany(candidate, titleWords)) {
            counts.set(candidate, (counts.get(candidate) || 0) + 1);
        }
        found = capsPattern.exec(text);
    }

    let best = '';
    let bestCount = 0;
    for (const [candidate, count] of counts.entries()) {
        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    }

    return best;
};

const inferCompanyName = (job) => {
    const title = cleanTextValue(job?.title || '');
    const titleWords = new Set(splitWords(title));
    const normalizedCompany = normalizeCompanyValue(job?.company || '', titleWords);
    const currentCompany = cleanTextValue(job?.company || '');
    if (normalizedCompany && normalizedCompany !== currentCompany) return normalizedCompany;
    if (!isUnknownCompany(job?.company, title)) return currentCompany || '';
    const description = getJobDescription(job);
    const fromDescription = inferCompanyFromDescription(description, title);
    if (fromDescription) return fromDescription;
    const fromUrl = inferCompanyFromUrl(job?.url || '');
    if (fromUrl) return fromUrl;
    return currentCompany || 'Unknown';
};

const escapeAirtableValue = (value) => String(value || '').replace(/'/g, "\\'");

async function updateAirtableJobCompany(job, company) {
    if (!AIRTABLE_TOKEN) return { updated: false, reason: 'missing_token' };
    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/FreshJobs`;
    const headers = {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
    };

    const fields = { company };

    if (job?.airtableId) {
        const response = await fetch(`${baseUrl}/${job.airtableId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields })
        });
        if (!response.ok) {
            return { updated: false, reason: `airtable_error_${response.status}` };
        }
        return { updated: true, method: 'airtableId' };
    }

    const jobCode = job?.job_code || job?.jobCode || '';
    const jobId = job?.id || job?.job_id || '';
    const jobUrl = job?.url || '';
    if (!jobCode && !jobId && !jobUrl) {
        return { updated: false, reason: 'missing_identifier' };
    }

    const parts = [];
    if (jobCode) parts.push(`{job_code}='${escapeAirtableValue(jobCode)}'`);
    if (jobId) parts.push(`{id}='${escapeAirtableValue(jobId)}'`);
    if (jobUrl) parts.push(`{url}='${escapeAirtableValue(jobUrl)}'`);
    const filter = encodeURIComponent(`OR(${parts.join(',')})`);
    const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
    if (!lookup.ok) {
        return { updated: false, reason: `airtable_lookup_${lookup.status}` };
    }
    const data = await lookup.json();
    const first = data?.records?.[0];
    if (!first?.id) return { updated: false, reason: 'airtable_not_found' };
    const response = await fetch(`${baseUrl}/${first.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields })
    });
    if (!response.ok) {
        return { updated: false, reason: `airtable_error_${response.status}` };
    }
    return { updated: true, method: 'lookup' };
}

async function backfillJobCompanies(jobs) {
    if (!Array.isArray(jobs) || !jobs.length) return;
    const updates = [];
    const maxUpdates = 50;

    for (const job of jobs) {
        const inferred = inferCompanyName(job);
        if (!inferred) continue;
        const current = job.company ? String(job.company).trim() : '';
        if (current && current.toLowerCase() === inferred.toLowerCase()) continue;
        job.company = inferred;
        updates.push({ job, company: inferred });
        if (updates.length >= maxUpdates) break;
    }

    for (const entry of updates) {
        try {
            await Jobs.updateOne({ _id: entry.job._id }, { company: entry.company });
        } catch (error) {
            console.warn('Failed to update job company in MongoDB', error.message);
        }
    }
}

// Dashboard reads do not need embedded document payloads. Some legacy candidate
// records contain large resume/cover-letter objects, which can push an otherwise
// small authenticated page load past the frontend timeout.
const CANDIDATE_DASHBOARD_FIELDS = [
    'firstName', 'lastName', 'email', 'contactEmail', 'phone', 'location',
    'targetRoles', 'seniority', 'skills', 'skills_2', 'urls',
    'resumeLink', 'coverLetterLink', 'resume_hash',
    'resume_updated_at', 'coverLetter_updated_at', 'work_experience',
    'education', 'summary', 'inferredKeywords', 'status', 'paidUntil',
    'graceDays', 'tokenBalance', 'tokensUsed', 'creditsBalance', 'creditsUsed',
    'plan', 'recruiterContactsLeft', 'recruiterContactsUpdatedAt',
].join(' ')

const getEverything = asyncHandler(async (req, res) => {
    try {
        if (req.user?.email) {
            const userEmail = req.user.email.toLowerCase()
            let match = await Candidates.findOne({ email: userEmail })
                .select(CANDIDATE_DASHBOARD_FIELDS)
                .lean()

            // Auto-create a Candidate document if this authenticated user has none yet
            if (!match) {
                const displayName = req.user.displayName || req.user.email.split('@')[0]
                const nameParts = String(displayName).trim().split(' ').filter(Boolean)
                try {
                    const created = await Candidates.findOneAndUpdate(
                        { email: userEmail },
                        {
                            $setOnInsert: {
                                email: userEmail,
                                firstName: nameParts[0] || displayName,
                                lastName: nameParts.slice(1).join(' ') || '',
                                phone: '',
                                location: [],
                                targetRoles: [],
                                seniority: [],
                                skills: [],
                                urls: [],
                                resume: {},
                                status: 'active',
                                paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                tokenBalance: 100,
                                recruiterContactsLeft: 10,
                                recruiterContactsUpdatedAt: new Date(),
                            },
                        },
                        { upsert: true, new: true }
                    )
                    if (created) match = created.toObject ? created.toObject() : created
                } catch (e) {
                    console.warn('[getEverything] Auto-create candidate failed:', e.message)
                }
            }

            const candidate = match ? withEffectiveRecruiterContacts(match) : null
            const [ApplicationsForCandidate, CandidatePairings] = await Promise.all([
                candidate
                    ? Applications.find({ candidateId: candidate._id, status: { $ne: 'system' } }).lean().exec()
                    : Promise.resolve([]),
                candidate
                    ? CandidateJobPairings.find(
                        { candidateId: candidate._id },
                        { candidateId: 1, jobId: 1, score: 1, matchedSkills: 1, reason: 1, pairedAt: 1, source: 1, algorithmVersion: 1 }
                    ).lean().exec()
                    : Promise.resolve([]),
            ])
            const matchedJobIds = [
                ...ApplicationsForCandidate
                    .filter((application) =>
                        application.jobId &&
                        application.status !== 'not_interested' &&
                        application.status !== 'dismissed'
                    )
                    .map((application) => application.jobId),
                ...CandidatePairings
                    .filter((pairing) => pairing.jobId && Number(pairing.score || 0) >= 10)
                    .map((pairing) => pairing.jobId),
            ]
            const Jobs = await getDashboardJobsPure(100, matchedJobIds)

            return res.json({
                Applications: ApplicationsForCandidate,
                Candidates: candidate ? [candidate] : [],
                Jobs,
                Contacts: [],
                CandidateJobPairing: CandidatePairings,
                ContactJobPairing: [],
            })
        }

        let allCandidates = await getAllCandidatesPure()

        // When authenticated, return only the logged-in user's candidate
        if (req.user?.email) {
            const userEmail = req.user.email.toLowerCase()
            let match = allCandidates.find((c) => (c.email || '').toLowerCase() === userEmail)

            // Auto-create a Candidate document if this authenticated user has none yet
            if (!match) {
                const displayName = req.user.displayName || req.user.email.split('@')[0]
                const nameParts = String(displayName).trim().split(' ').filter(Boolean)
                try {
                    const created = await Candidates.findOneAndUpdate(
                        { email: userEmail },
                        {
                            $setOnInsert: {
                                email: userEmail,
                                firstName: nameParts[0] || displayName,
                                lastName: nameParts.slice(1).join(' ') || '',
                                phone: '',
                                location: [],
                                targetRoles: [],
                                seniority: [],
                                skills: [],
                                urls: [],
                                resume: {},
                                status: 'active',
                                paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                tokenBalance: 100,
                                recruiterContactsLeft: 10,
                                recruiterContactsUpdatedAt: new Date(),
                            },
                        },
                        { upsert: true, new: true }
                    )
                    if (created) match = created.toObject ? created.toObject() : created
                } catch (e) {
                    console.warn('[getEverything] Auto-create candidate failed:', e.message)
                }
            }

            allCandidates = match ? [match] : []
        }

        const [allApplications, allJobs, allContacts, allCandidatePairings, allContactPairings] = await Promise.all([
            getAllApplicationsPure(),
            getAllJobsPure(),
            getAllContactsPure(),
            getAllCandidateJobPairingsPure(),
            getAllContactJobPairingsPure(),
        ]);
        const visibleCandidates = req.user?.email
            ? allCandidates.filter((c) => String(c.email || '').toLowerCase() === req.user.email.toLowerCase())
            : allCandidates;
        const candidateIds = new Set(visibleCandidates.map((c) => String(c._id)));
        const filteredApplications = allApplications.filter((a) =>
            a.status !== 'system' && (req.user?.email ? candidateIds.has(String(a.candidateId)) : true)
        );
        const filteredCandidatePairing = allCandidatePairings.filter((p) =>
            req.user?.email ? candidateIds.has(String(p.candidateId)) : true
        );
        res.json({
            Applications: filteredApplications,
            Candidates: visibleCandidates,
            Jobs: allJobs,
            Contacts: req.user?.email ? [] : allContacts,
            CandidateJobPairing: filteredCandidatePairing,
            ContactJobPairing: req.user?.email ? [] : allContactPairings,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'An error occurred collecting data.' });
    }
});

const getAllCandidates = asyncHandler(async (req, res) => {
    if (req.user?.email) {
        const candidate = await Candidates.findOne({ email: req.user.email.toLowerCase() })
            .select(CANDIDATE_DASHBOARD_FIELDS)
            .lean().exec();
        return res.json(candidate ? [withEffectiveRecruiterContacts(candidate)] : []);
    }
    const results = await getAllCandidatesPure();
    res.json(results);
});

const getAllJobs = asyncHandler(async (req, res) => {
    const results = await getAllJobsPure({
        search: req.query.q || req.query.search || '',
        limit: req.query.limit,
    });
    res.json(results);
});

const getAllApplications = asyncHandler(async (req, res) => {
    const email = req.user?.email || req.query.email;
    if (email) {
        const candidate = await Candidates.findOne({ email: String(email).toLowerCase() }, '_id').lean();
        if (!candidate) return res.json([]);
        const results = await Applications.find({
            candidateId: candidate._id,
            $or: [
                { coverLetter: { $exists: true, $ne: '' } },
                { 'resume.content': { $exists: true, $ne: '' } },
                { resume: { $type: 'string', $ne: '' } },
            ],
        }).sort({ preparedAt: -1 }).lean();
        return res.json(results);
    }
    const results = await getAllApplicationsPure();
    res.json(results);
});

const getAllContacts = asyncHandler(async (req, res) => {
    if (req.user?.email) return res.json([]);
    const results = await getAllContactsPure();
    res.json(results);
});

const getAllCandidateJobPairings = asyncHandler(async (req, res) => {
    if (req.user?.email) {
        const candidate = await Candidates.findOne({ email: req.user.email.toLowerCase() }, '_id').lean();
        if (!candidate) return res.json([]);
        const results = await CandidateJobPairings.find(
            { candidateId: candidate._id },
            { candidateId: 1, jobId: 1, score: 1, matchedSkills: 1, reason: 1, pairedAt: 1 }
        ).lean().exec();
        return res.json(results);
    }
    const results = await getAllCandidateJobPairingsPure();
    res.json(results);
});

const getAllContactJobPairings = asyncHandler(async (req, res) => {
    if (req.user?.email) return res.json([]);
    const results = await getAllContactJobPairingsPure();
    res.json(results);
});

const PLAN_MAX_CONTACTS = { free: 10, upgraded: 20, premium: 30 }

// Applies the same day-based recruiter-contact refill used by getAllCandidatesPure
// to a single candidate, without touching the DB. Keeps reads (e.g. a logged-in
// user's own dashboard) from showing a stale pre-refill count.
function withEffectiveRecruiterContacts(c) {
    const max = getRecruiterContactsMaxOverride(c.email) ?? (PLAN_MAX_CONTACTS[c.plan || 'free'] || 10)
    const left = c.recruiterContactsLeft ?? max
    const updatedAt = c.recruiterContactsUpdatedAt ? new Date(c.recruiterContactsUpdatedAt) : new Date(0)
    const daysElapsed = easternDaysElapsed(updatedAt)
    const effectiveLeft = Math.min(left + daysElapsed, max)
    return { ...c, recruiterContactsLeft: effectiveLeft, recruiterContactsMax: max }
}

async function getAllCandidatesPure() {
    const candidates = await Candidates.find().lean().exec()
    return candidates.map(withEffectiveRecruiterContacts)
}

// Fields the UI actually needs — excludes raw scraper blobs and vendor internals
const JOB_PROJECTION = {
    _id: 1, title: 1, job_title: 1, name: 1,
    company: 1, location: 1,
    description: 1, description_short: 1, shortDescription: 1, summary: 1, why_matched: 1,
    skills: 1, tags: 1, jobType: 1, job_type: 1,
    salary: 1,
    date_posted: 1, datePosted: 1, postedAt: 1, postedDate: 1, rawDate: 1, preparedAt: 1,
    url: 1, apply_url: 1, applyUrl: 1, company_url: 1,
    source: 1, job_code: 1, job_id: 1, lang: 1, ats_direct: 1, ats: 1,
    has_recruiter: 1, interested: 1, hasNewBadge: 1,
}

// 5-minute in-memory cache — avoids a full MongoDB scan on every page load
let _jobsCache = null
let _jobsCacheAt = 0
const JOB_CACHE_TTL = 5 * 60 * 1000

function _invalidateJobsCache() { _jobsCache = null; _jobsCacheAt = 0 }

function parseJobDate(job) {
    const raw = job?.date_posted || job?.datePosted || job?.postedAt || job?.postedDate || job?.rawDate;
    if (!raw) return null;
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct.getTime();
    if (typeof raw === 'string') {
        const withZ = new Date(`${raw}Z`);
        if (!Number.isNaN(withZ.getTime())) return withZ.getTime();
    }
    if (!Number.isNaN(Number(raw))) {
        const asNum = new Date(Number(raw));
        if (!Number.isNaN(asNum.getTime())) return asNum.getTime();
    }
    return null;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Clusters of interchangeable search terms so a query like "designer" also
// matches jobs only tagged/titled "UX", and "us" also matches "United States"
// in location fields. Each cluster expands to a single regex alternation, so
// one query term still ANDs against the rest of the query but ORs across its
// whole synonym group. Add a cluster here for any new sourced category so its
// jobs stay reachable by the words people actually type.
const SEARCH_SYNONYM_CLUSTERS = [
    ['ux', 'ui', 'user experience', 'user interface', 'product design', 'designer', 'design'],
    // 'support' is a deliberate single-word member: expandSearchTerm only
    // activates a cluster when one of its phrases occurs INSIDE the (single-
    // word) query term, never the reverse — a cluster built entirely from
    // multi-word phrases can never be triggered by anything a user actually
    // types. Every other cluster already has a one-word member; this one
    // didn't, so searching "support" or "customer service" (split into two
    // AND'd single-word terms) never matched this cluster at all.
    ['customer service', 'customer support', 'support agent', 'help desk', 'client support', 'support'],
    ['virtual assistant', 'executive assistant', 'admin assistant', 'administrative assistant', 'assistant', 'admin'],
    ['paralegal', 'legal assistant', 'legal services', 'law clerk', 'legal'],
    ['hr', 'human resources', 'recruiter', 'recruiting', 'talent acquisition'],
    ['accounting', 'finance', 'accountant', 'bookkeeper', 'financial analyst', 'financial'],
    ['sales', 'account executive', 'sdr', 'business development', 'account manager'],
    ['product manager', 'product management', 'pm'],
    ['project manager', 'project management', 'pmo'],
    ['writer', 'writing', 'content', 'copywriter', 'editor', 'content creation'],
    ['data', 'analytics', 'data analyst', 'data scientist', 'ai', 'artificial intelligence', 'machine learning'],
    ['intern', 'internship', 'entry level'],
    ['teacher', 'teaching', 'tutor', 'instructor', 'education', 'online teaching'],
    ['pr', 'public relations', 'communications', 'media relations'],
    ['marketing', 'social media', 'social media marketing', 'growth marketing'],
    ['us', 'usa', 'united states', 'american', 'u.s.'],
    ['remote', 'work from home', 'wfh', 'anywhere'],
]

const SEARCH_SYNONYM_LOOKUP = new Map()
for (const cluster of SEARCH_SYNONYM_CLUSTERS) {
    for (const phrase of cluster) {
        SEARCH_SYNONYM_LOOKUP.set(phrase, cluster)
    }
}

// Expands a single lowercased query word to every synonym cluster it belongs
// to (matched as a whole word so "us" doesn't fire on "used" or "bus"). Falls
// back to the literal term when it isn't part of any known cluster.
function expandSearchTerm(term) {
    const related = new Set([term])
    for (const [phrase, cluster] of SEARCH_SYNONYM_LOOKUP) {
        const phraseRe = new RegExp(`(^|\\s)${escapeRegex(phrase)}(\\s|$)`)
        if (phraseRe.test(` ${term} `)) {
            cluster.forEach((p) => related.add(p))
        }
    }
    return [...related]
}

// Short, curated fields — safe to match against the full synonym cluster
// since there's no room for a word like "design" to show up incidentally.
const STRUCTURED_SEARCH_FIELDS = [
    'title', 'job_title', 'name', 'company',
    'skills', 'tags', 'jobType', 'job_type', 'source',
    'location.city', 'location.state', 'location.country',
]

// Free-text fields — matched on the literal typed term only. Expanding a
// generic cluster member like "design" or "data" against full descriptions
// pulls in unrelated jobs that merely mention the word in passing (e.g. a
// "Tax Senior" role whose blurb says "help design our processes").
const FREETEXT_SEARCH_FIELDS = [
    'description', 'description_short', 'shortDescription', 'summary', 'why_matched',
]

// Short tokens (us, ai, pm, hr, pr, ux, ui...) need word-boundary anchoring —
// unanchored, "us" matches inside "business"/"focus" on nearly every job.
// Longer terms stay unanchored on purpose so "engineer" still finds jobs
// titled "Engineering" and "market" still finds "Marketing" — anchoring
// those would break prefix/plural matching people rely on today.
function regexForPhrase(phrase) {
    const escaped = escapeRegex(phrase)
    if (phrase.length > 3) return escaped
    // \b only fires at a word/non-word transition, so a naive \b on both
    // sides breaks terms that start or end in punctuation — "c++" would
    // never match "C++ Developer" because nothing is a "word char" after
    // the trailing "+". Only anchor the side that's actually alphanumeric.
    const startsWord = /^[a-z0-9]/i.test(phrase)
    const endsWord = /[a-z0-9]$/i.test(phrase)
    return `${startsWord ? '\\b' : ''}${escaped}${endsWord ? '\\b' : ''}`
}

function buildJobSearchFilter(search) {
    const terms = String(search || '')
        .toLowerCase()
        .replace(/[^a-z0-9+#.]+/g, ' ')
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
        .slice(0, 8)

    if (!terms.length) return null

    return {
        $and: terms.map((term) => {
            const expanded = expandSearchTerm(term)
            const expandedRegex = { $regex: expanded.map(regexForPhrase).join('|'), $options: 'i' }
            const literalRegex = { $regex: regexForPhrase(term), $options: 'i' }
            return {
                $or: [
                    ...STRUCTURED_SEARCH_FIELDS.map((field) => ({ [field]: expandedRegex })),
                    ...FREETEXT_SEARCH_FIELDS.map((field) => ({ [field]: literalRegex })),
                ],
            }
        }),
    }
}

async function getAllJobsPure(options = {}) {
    const searchFilter = buildJobSearchFilter(options.search)
    const isSearch = Boolean(searchFilter)
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 200, 1), 500)

    if (!isSearch && _jobsCache && Date.now() - _jobsCacheAt < JOB_CACHE_TTL) return _jobsCache

    const JobDynamic = mongoose.models.JobDynamic ||
        mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }));
    const jobs = await JobDynamic.find(searchFilter || {}, JOB_PROJECTION).lean().exec();
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;

    const filtered = jobs.filter((job) => {
        if (isJunkJobRecord(job)) return false
        const jobUrl = String(job.url || job.apply_url || '')
        if (/linkedin\.com/i.test(jobUrl)) return false
        const title = String(job.title || job.job_title || job.name || '').trim()
        const desc = String(job.description_short || job.description || '').trim()
        if (!isLikelyEnglish(title) || !isLikelyEnglish(desc)) return false
        const ts = parseJobDate(job);
        if (!ts) return true;
        return ts >= cutoff;
    }).sort((a, b) => {
        const aTime = parseJobDate(a) || 0;
        const bTime = parseJobDate(b) || 0;
        return bTime - aTime;
    });

    for (const job of filtered) {
        const inferred = inferCompanyName(job);
        if (inferred && job.company !== inferred) {
            job.company = inferred;
        }
    }

    setImmediate(() => {
        backfillJobCompanies(filtered).catch((error) => {
            console.warn('Backfill job companies failed', error.message);
        });
    });

    if (isSearch) return filtered.slice(0, limit)

    _jobsCache = filtered
    _jobsCacheAt = Date.now()
    return filtered;
}

// The dashboard needs a useful recent feed, not the entire jobs collection.
// Read a bounded set by indexed insertion order so page load does not transfer
// thousands of job descriptions before anything can render. Full search remains
// available through GET /jobseeker/job.
async function getDashboardJobsPure(limit = 300, requiredJobIds = []) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 300, 1), 500)
    const JobDynamic = mongoose.models.JobDynamic ||
        mongoose.model('JobDynamic', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.jobs' }))
    const normalizedRequiredIds = [...new Set(requiredJobIds.map(String))]
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id))
    const [recentJobs, requiredJobs] = await Promise.all([
        JobDynamic.find({}, JOB_PROJECTION)
            .sort({ _id: -1 })
            .limit(safeLimit * 3)
            .lean().exec(),
        normalizedRequiredIds.length
            ? JobDynamic.find({ _id: { $in: normalizedRequiredIds } }, JOB_PROJECTION).lean().exec()
            : Promise.resolve([]),
    ])
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000

    const recent = recentJobs
        .filter((job) => {
            if (isJunkJobRecord(job)) return false
            const jobUrl = String(job.url || job.apply_url || '')
            if (/linkedin\.com/i.test(jobUrl)) return false
            const title = String(job.title || job.job_title || job.name || '').trim()
            const desc = String(job.description_short || job.description || '').trim()
            if (!isLikelyEnglish(title) || !isLikelyEnglish(desc)) return false
            const ts = parseJobDate(job)
            return !ts || ts >= cutoff
        })
        .sort((a, b) => (parseJobDate(b) || 0) - (parseJobDate(a) || 0))
        .slice(0, safeLimit)

    // Pairings are authoritative even when the matched job is older than the
    // bounded recent feed. Merge them back in so the Matched filter can always
    // resolve every pairing returned alongside this response.
    const seen = new Set()
    return [...requiredJobs, ...recent].filter((job) => {
        const id = String(job._id)
        if (seen.has(id)) return false
        seen.add(id)
        return true
    })
}

async function getAllApplicationsPure() {
    return await Applications.find().lean().exec();
}

async function getAllContactsPure() {
    return await Contacts.find().lean().exec();
}

async function getAllCandidateJobPairingsPure() {
    return await CandidateJobPairings.find({}, { candidateId: 1, jobId: 1, score: 1, matchedSkills: 1, reason: 1, pairedAt: 1 }).lean().exec();
}

async function getAllContactJobPairingsPure() {
    return await ContactJobPairings.find().lean().exec();
}

const getCandidateById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({message: 'Candidate ID must be supplied.'});
    }
    try
    {
        const results = await Candidates.findById(id).lean().exec();
        if (!results) {
            return res.status(404).json({message: 'No Candidate found.'});
        }
        if (req.user?.email && String(results.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account.' });
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.status(500).json({message: 'An error occurred when trying to collect Candidate ' + id});
    }
});

const getJobById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({message: 'Job ID must be supplied'});
    }
    try
    {
        const results = await Jobs.findById(id).lean().exec();
        if(!results) {
            return res.status(404).json({message: 'No Job found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.status(500).json({message: 'An error occured when trying to collect Job ' + id});
    }
});

const getApplicationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({message: 'Application ID must be supplied.'});
    }
    try
    {
        const results = await Applications.findById(id).lean().exec();
        if(!results) {
            return res.status(404).json({message: 'No Application found.'});
        }
        if (req.user?.email) {
            const candidate = await Candidates.findOne({ email: req.user.email.toLowerCase() }, '_id').lean().exec();
            if (!candidate || String(results.candidateId) !== String(candidate._id)) {
                return res.status(403).json({ message: 'Forbidden: application does not belong to this account.' });
            }
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.status(500).json({message: 'An error occured when trying to collect Application ' + id});
    }
});

const getCandidateJobPariringById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({message: 'A candidate+job pairing ID must be supplied.'});
    }
    try
    {
        const results = await CandidateJobPairings.findById(id).lean().exec();
        if(!results) {
            return res.status(404).json({message: 'No Candidate+Job pairing found.'});
        }
        if (req.user?.email) {
            const candidate = await Candidates.findOne({ email: req.user.email.toLowerCase() }, '_id').lean().exec();
            if (!candidate || String(results.candidateId) !== String(candidate._id)) {
                return res.status(403).json({ message: 'Forbidden: pairing does not belong to this account.' });
            }
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.status(500).json({message: 'An error occured when trying to collect Candidate+Job pairing ' + id});
    }
});

const getContactById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({message: 'A Contact ID must be supplied.'});
    }
    try
    {
        if (req.user?.email) return res.status(403).json({ message: 'Forbidden.' });
        const results = await Contacts.findById(id).lean().exec();
        if(!results) {
            return res.status(404).json({message: 'No contact found.'});
        }
        res.json(results)
    }
    catch(Error)
    {
        console.error(Error);
        res.status(500).json({message: 'An error occured when trying to collect Contact ' + id});
    }
});

const getContactJobPairingById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({message: 'A Contact+Job pairing ID must be supplied.'});
    }
    try
    {
        if (req.user?.email) return res.status(403).json({ message: 'Forbidden.' });
        const results = await ContactJobPairings.findById(id).lean().exec();
        if(!results) {
            return res.status(404).json({message: 'No Contact+Job pairing found.'});
        }
        res.json(results);
    }
    catch(Error)
    {
        console.error(Error);
        res.status(500).json({message: 'An error occured when trying to collect Contact+Job Pairing ' + id});
    }
});

const updateCandidateSkills = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { skills } = req.body || {};

    if (!id) {
        return res.status(400).json({ message: 'Candidate ID must be supplied.' });
    }
    if (!skills) {
        return res.status(400).json({ message: 'Skills must be supplied.' });
    }

    const normalizedSkills = Array.isArray(skills)
        ? skills.map((s) => String(s).trim()).filter(Boolean)
        : String(skills).split(',').map((s) => s.trim()).filter(Boolean);

    try {
        const existing = await Candidates.findById(id).select('email').lean().exec();
        if (!existing) {
            return res.status(404).json({ message: 'Candidate not found.' });
        }
        if (req.user?.email && String(existing.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account.' });
        }

        const candidate = await Candidates.findByIdAndUpdate(
            id,
            { skills: normalizedSkills },
            { new: true }
        );
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found.' });
        }

        let applyQueueUpdated = 0;
        if (candidate.email) {
            const ApplyQueue = mongoose.models.ApplyQueue ||
                mongoose.model('ApplyQueue', new mongoose.Schema({}, { strict: false, collection: 'jobseeker.applyqueue' }));
            const result = await ApplyQueue.updateMany(
                { email: candidate.email },
                { $set: { candidate_skills: normalizedSkills, updated_at: new Date().toISOString() } }
            );
            applyQueueUpdated = result.modifiedCount || 0;
        }

        let pairing = { updated: false };
        try {
            pairing = await pairCandidateJobs(candidate._id);
        } catch (err) {
            pairing = { updated: false, reason: err.message };
        }

        res.json({ candidate, applyQueueUpdated, pairing });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update candidate skills.' });
    }
});

const pairCandidateJobsHandler = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { limit, minScore } = req.body || {};
    if (!id) return res.status(400).json({ message: 'Candidate ID must be supplied.' });

    try {
        const candidate = await Candidates.findById(id).select('email').lean().exec();
        if (!candidate) return res.status(404).json({ message: 'Candidate not found.' });
        if (req.user?.email && String(candidate.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account.' });
        }
        const result = await pairCandidateJobs(id, { limit, minScore });
        return res.json(result);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ message: err.message || 'Failed to pair candidate jobs.' });
    }
});

const pairAllCandidatesHandler = asyncHandler(async (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL || '';
    if (!adminEmail || String(req.user?.email || '').toLowerCase() !== adminEmail.toLowerCase()) {
        return res.status(403).json({ message: 'Admin access required.' });
    }
    const { limit, minScore } = req.body || {};
    const results = await pairAllCandidates({ limit, minScore });
    res.json({ candidates: results.length, results });
});

const updateCandidateResume = asyncHandler(async (req, res) => {
    const email = req.user?.email || req.body?.email;
    const file = req.file;

    if (!email) {
        return res.status(400).json({ message: 'Email must be supplied.' });
    }
    if (!file) {
        return res.status(400).json({ message: 'Resume file must be supplied.' });
    }

    const candidate = await Candidates.findOne({ email: String(email).toLowerCase() });
    if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found.' });
    }
    if (req.user?.email && String(candidate.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account.' });
    }

    // Only count an existing resume if a real URL or non-empty object (not the default `{}`) exists
    const hasExistingResume = !!(candidate.resumeLink || (candidate.resume && candidate.resume.url));
    if (hasExistingResume) {
        const creditBalance = Number.isFinite(candidate.tokenBalance) ? candidate.tokenBalance
            : Number.isFinite(candidate.creditsBalance) ? candidate.creditsBalance
                : 0;
        if (creditBalance < 3) {
            return res.status(402).json({ message: 'Insufficient credits. Re-uploading a resume costs 3 credits.' });
        }
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${candidate._id}-${Date.now()}${ext || ''}`;

    let resumeLink;
    if (r2Configured()) {
        resumeLink = await uploadToR2(`resumes/${safeName}`, file.buffer, file.mimetype);
    } else {
        const uploadDir = path.join(__dirname, '../../uploads/resumes');
        fs.mkdirSync(uploadDir, { recursive: true });
        const targetPath = path.join(uploadDir, safeName);
        fs.writeFileSync(targetPath, file.buffer);
        resumeLink = `${PUBLIC_SERVER_URL}/uploads/resumes/${safeName}`;
    }

    const resumeMeta = {
        filename: safeName,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: resumeLink
    };

    const nextTokenBalance = Number.isFinite(candidate.tokenBalance)
        ? Math.max(0, (candidate.tokenBalance || 0) - 3)
        : candidate.tokenBalance;
    const nextCreditsBalance = Number.isFinite(candidate.creditsBalance)
        ? Math.max(0, (candidate.creditsBalance || 0) - 3)
        : candidate.creditsBalance;

    // ── Step 1: Extract raw text from the file ───────────────────────────────
    let extractedText = '';
    try {
        const fileBuffer = file.buffer;
        if (ext === '.pdf') {
            extractedText = await extractPdfText(fileBuffer);
        } else if (ext === '.docx' || ext === '.doc') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedText = result.value || '';
        } else if (ext === '.rtf') {
            // Strip RTF control codes to get readable plain text
            const raw = fileBuffer.toString('latin1');
            extractedText = raw
                .replace(/\\pard[^\\]*/gi, '\n')
                .replace(/\\'[0-9a-f]{2}/gi, '')
                .replace(/\\[a-z]+\-?\d*\s?/gi, '')
                .replace(/[{}\\]/g, '')
                .replace(/\r?\n\s*\r?\n/g, '\n\n')
                .replace(/[ \t]+/g, ' ')
                .trim();
        } else if (ext === '.txt') {
            extractedText = fileBuffer.toString('utf-8');
        }
    } catch (extractErr) {
        console.warn('Resume text extraction failed (non-fatal):', extractErr.message);
    }

    // ── Step 2: AI-powered structured parsing ─────────────────────────────────
    // Use OpenAI to reliably extract structured fields regardless of resume format
    let aiParsed = null;
    if (extractedText && process.env.OPENAI_API_KEY) {
        try {
            const aiResponse = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a resume parser. Extract structured data from the resume text and return ONLY valid JSON with these exact keys:
- firstName: string (first name only)
- lastName: string (last name only, may be empty)
- phone: string (phone number, empty if not found)
- targetRole: string (most recent job title or stated career goal)
- skills: array of strings (technical and professional skills)
- workExperience: string (all work history, each job separated by a blank line, include company, title, dates, and responsibilities)
- education: string (all education entries, each separated by a blank line, include school, degree, dates)
- summary: string (professional summary or objective if present, otherwise empty string)
- location: string (city and state/country if found, otherwise empty)
- inferredKeywords: array of up to 20 strings — the most important professional keywords from this resume (job titles held, industries, key technologies, domain terms). These are used for job matching so be specific and diverse.`
                        },
                        {
                            role: 'user',
                            content: extractedText.slice(0, 12000)
                        }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: 2000,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );
            aiParsed = JSON.parse(aiResponse.data.choices[0].message.content);
        } catch (aiErr) {
            console.warn('AI resume parsing failed, falling back to regex:', aiErr.message);
        }
    }

    // ── Step 3: Merge AI results with regex fallback ───────────────────────────
    const { workExperience: regexWork, education: regexEdu } = deriveResumeFields(extractedText);
    const regexSkills = extractSkillsFromText(extractedText);
    const regexRole = extractTargetRoleFromText(extractedText);
    const regexPhone = extractedText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]?.trim() || '';
    const regexEmail = extractedText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0]?.trim() || '';
    const regexLocation = (() => {
        const m = extractedText.match(/\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})\b/)
        return m ? { locationName: `${m[1].trim()}, ${m[2]}`, city: m[1].trim(), state: m[2] } : null
    })()
    const nameLines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5)
    const nameLine = nameLines.find(l => /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(l))
    const regexFirstName = nameLine ? nameLine.split(/\s+/)[0] : ''
    const regexLastName = nameLine ? nameLine.split(/\s+/).slice(1).join(' ') : ''
    const filenameName = inferNameFromFilename(file.originalname || '')

    const finalWork = aiParsed?.workExperience || regexWork;
    const finalEdu = aiParsed?.education || regexEdu;
    const aiSkills = Array.isArray(aiParsed?.skills) ? aiParsed.skills : [];
    const aiInferredKeywords = Array.isArray(aiParsed?.inferredKeywords) ? aiParsed.inferredKeywords : [];
    const finalRole = cleanTextValue(aiParsed?.targetRole || regexRole || '');
    const finalPhone = cleanTextValue(aiParsed?.phone || regexPhone || '');
    const finalFirstName = cleanTextValue(aiParsed?.firstName || regexFirstName || filenameName.firstName || '');
    const finalLastName = cleanTextValue(aiParsed?.lastName || regexLastName || filenameName.lastName || '');
    const finalSummary = cleanTextValue(aiParsed?.summary || '');
    const finalEmail = regexEmail;
    const finalLocation = (() => {
        if (aiParsed?.location) {
            const locationText = cleanTextValue(aiParsed.location);
            const parts = locationText.split(',').map(s => s.trim());
            return parts[0] ? { locationName: locationText, city: parts[0], state: parts[1] || '' } : null;
        }
        return regexLocation;
    })();

    const setFields = {
        resumeLink,
        resume: resumeMeta,
        resume_text: extractedText,
        resume_hash: '',
        resume_updated_at: new Date(),
    };
    // Always update work experience and education from the latest resume
    if (finalWork) setFields.work_experience = finalWork;
    if (finalEdu) setFields.education = finalEdu;
    if (finalSummary) setFields.summary = finalSummary;
    // Update skills: always merge AI-found skills; only set from regex if candidate has none
    if (aiSkills.length > 0) {
        const existingSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
        setFields.skills = [...new Set([...existingSkills, ...aiSkills])];
    } else if (regexSkills.length > 0 && (!candidate.skills || candidate.skills.length === 0)) {
        setFields.skills = regexSkills;
    }
    // Only set these if not already filled in
    if (finalRole && (!candidate.targetRoles || candidate.targetRoles.length === 0)) setFields.targetRoles = [finalRole];
    if (finalPhone && !candidate.phone) setFields.phone = finalPhone;
    if (finalFirstName && !candidate.firstName) setFields.firstName = finalFirstName;
    if (finalLastName && !candidate.lastName) setFields.lastName = finalLastName;
    if (finalLocation && (!candidate.location || candidate.location.length === 0)) setFields.location = [finalLocation];
    if (finalEmail && finalEmail !== candidate.email && !candidate.email) setFields.email = finalEmail;
    // Always overwrite inferredKeywords — they reflect the latest resume content
    if (aiInferredKeywords.length > 0) setFields.inferredKeywords = aiInferredKeywords;
    if (hasExistingResume && Number.isFinite(candidate.tokenBalance)) {
        setFields.tokenBalance = nextTokenBalance;
        setFields.tokensUsed = (candidate.tokensUsed || 0) + 3;
    }
    if (hasExistingResume && Number.isFinite(candidate.creditsBalance)) {
        setFields.creditsBalance = nextCreditsBalance;
        setFields.creditsUsed = (candidate.creditsUsed || 0) + 3;
    }

    await Candidates.updateOne({ _id: candidate._id }, { $set: setFields });

    // Fetch fresh from DB so the response always reflects what was actually saved,
    // rather than relying on Object.assign to update the Mongoose document in memory.
    const updatedCandidate = await Candidates.findOne({ _id: candidate._id }).lean().exec() || candidate;

    if (RESUME_EXTRACT_WEBHOOK) {
        try {
            await fetch(RESUME_EXTRACT_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: updatedCandidate.email,
                    resume_url: resumeLink
                })
            });
        } catch (err) {
            console.warn('Resume extract webhook failed', err.message || err);
        }
    }

    let pairing = { updated: false };
    try {
        pairing = await pairCandidateJobs(updatedCandidate._id);
    } catch (err) {
        pairing = { updated: false, reason: err.message };
    }

    const extractionOk = !!(aiParsed || finalWork || finalEdu || aiSkills.length);
    if (!extractionOk) {
        console.warn('[updateCandidateResume] Profile fields could not be extracted.',
            `textExtracted=${!!extractedText}`,
            `aiParsed=${!!aiParsed}`,
            `openaiKey=${!!process.env.OPENAI_API_KEY}`
        );
    }

    res.json({
        candidate: updatedCandidate,
        extracted: {
            textExtracted: !!extractedText,
            aiParsed: !!aiParsed,
            fieldsPopulated: extractionOk,
        },
        credits: {
            tokenBalance: updatedCandidate.tokenBalance,
            tokensUsed: updatedCandidate.tokensUsed,
            creditsBalance: updatedCandidate.creditsBalance,
            creditsUsed: updatedCandidate.creditsUsed
        },
        pairing
    });
});

// ── Shared OpenAI helper ─────────────────────────────────────────────────────
const parseSignupResume = asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ message: 'Resume file must be supplied.' });
    }

    const parsed = await parseResumeFile(file);
    const skills = parsed.aiSkills.length > 0 ? parsed.aiSkills : parsed.regexSkills;

    res.json({
        fields: {
            firstName: parsed.finalFirstName,
            lastName: parsed.finalLastName,
            email: parsed.finalEmail,
            phone: parsed.finalPhone,
            location: parsed.finalLocation?.locationName || '',
            targetRole: parsed.finalRole,
            skills,
            workExperience: parsed.finalWork,
            education: parsed.finalEdu,
            summary: parsed.finalSummary,
        },
        extracted: {
            textExtracted: !!parsed.extractedText,
            aiParsed: !!parsed.aiParsed,
            fieldsPopulated: parsed.extractionOk,
        },
    });
});

const updateCandidateCoverLetter = asyncHandler(async (req, res) => {
    const email = req.user?.email || req.body?.email;
    const file = req.file;

    if (!email) {
        return res.status(400).json({ message: 'Email must be supplied.' });
    }
    if (!file) {
        return res.status(400).json({ message: 'Cover letter file must be supplied.' });
    }

    const candidate = await Candidates.findOne({ email: String(email).toLowerCase() });
    if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found.' });
    }
    if (req.user?.email && String(candidate.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account.' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${candidate._id}-${Date.now()}${ext || ''}`;

    let coverLetterLink;
    if (r2Configured()) {
        coverLetterLink = await uploadToR2(`cover-letters/${safeName}`, file.buffer, file.mimetype);
    } else {
        const uploadDir = path.join(__dirname, '../../uploads/cover-letters');
        fs.mkdirSync(uploadDir, { recursive: true });
        const targetPath = path.join(uploadDir, safeName);
        fs.writeFileSync(targetPath, file.buffer);
        coverLetterLink = `${PUBLIC_SERVER_URL}/uploads/cover-letters/${safeName}`;
    }

    const coverLetterMeta = {
        filename: safeName,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: coverLetterLink
    };

    candidate.coverLetterLink = coverLetterLink;
    candidate.coverLetter = coverLetterMeta;
    candidate.coverLetter_updated_at = new Date();
    await candidate.save();

    res.json({ candidate });
});

const RESUME_SECTION_HEADERS = new Set([
    'SUMMARY',
    'PROFESSIONAL SUMMARY',
    'PROFILE',
    'WORK EXPERIENCE',
    'PROFESSIONAL EXPERIENCE',
    'RELEVANT EXPERIENCE',
    'EXPERIENCE',
    'EDUCATION',
    'CERTIFICATIONS',
    'CERTIFICATION',
    'LICENSES',
    'PROJECTS',
    'SELECTED PROJECTS',
    'CORE COMPETENCIES',
    'TECHNICAL SKILLS',
    'SKILLS',
    'TOOLS',
    'AWARDS',
    'VOLUNTEERING',
    'PUBLICATIONS',
])

const RESUME_METRIC_RE = /\b(\$[\d,]+(?:\.\d+)?[kKmMbB]?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?x|\d[\d,]*(?:\.\d+)?\s*(?:\+|years?|months?|weeks?|days?|users?|clients?|customers?|projects?|campaigns?|teams?|people|stakeholders?|applications?|roles?|interviews?|recruiters?|leads?|hires?|hours?|minutes?|revenue|growth|increase|decrease|faster|costs?|savings?))\b/g
const RESUME_BULLET_RE = /^[-*\u2022]\s+/

function isResumeSectionHeader(line) {
    const trimmed = line.trim().replace(/\s+/g, ' ')
    const normalized = trimmed.toUpperCase()
    // Test original case in regex — only truly ALL-CAPS lines qualify as headers
    return RESUME_SECTION_HEADERS.has(normalized)
        || (/^[A-Z][A-Z0-9\s/&()+.,'-]{2,}$/.test(trimmed) && trimmed.length <= 40 && !/\d{4}/.test(trimmed))
}

function isKnownResumeSectionHeader(line) {
    return RESUME_SECTION_HEADERS.has(line.trim().replace(/\s+/g, ' ').toUpperCase())
}

function isResumeBullet(line) {
    return RESUME_BULLET_RE.test(line.trim())
}

function stripResumeBullet(line) {
    return line.trim().replace(RESUME_BULLET_RE, '')
}

function isLikelyResumeRoleLine(line) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length > 140 || /[.!?]$/.test(trimmed)) return false
    return /\s\|\s/.test(trimmed) || /\b(19|20)\d{2}\b/.test(trimmed) || /\b(Present|Current)\b/i.test(trimmed)
}

function applyResumeHtmlEmphasis(value) {
    return value.replace(RESUME_METRIC_RE, '<strong>$1</strong>')
}

function markdownToEmailHtml(text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const lines = text.split('\n')
    const out = []
    let inList = false
    for (const raw of lines) {
        const line = raw.trimEnd()
        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            if (inList) { out.push('</ul>'); inList = false }
            out.push('<hr style="border:none;border-top:1px solid #e4e8ee;margin:14px 0;">')
            continue
        }
        // Bullet point
        if (/^[-•]\s+/.test(line)) {
            if (!inList) { out.push('<ul style="margin:4px 0 4px 0;padding-left:20px;">'); inList = true }
            const bulletText = esc(line.replace(/^[-•]\s+/, ''))
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
            out.push(`<li style="margin:2px 0;font-size:14px;line-height:1.7;color:#2D2D2D;">${bulletText}</li>`)
            continue
        }
        if (inList) { out.push('</ul>'); inList = false }
        // Blank line
        if (!line.trim()) { out.push('<div style="height:8px;"></div>'); continue }
        // ALL CAPS section header (short line, mostly uppercase letters)
        const trimmed = line.trim()
        if (/^[A-Z][A-Z\s\/&\-]{2,}$/.test(trimmed) && trimmed.length <= 40) {
            out.push(`<div style="font-weight:700;font-size:12px;letter-spacing:0.1em;color:#306770;margin-top:20px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e4e8ee;">${esc(trimmed)}</div>`)
            continue
        }
        // Regular line — apply inline formatting
        const formatted = esc(line)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
        out.push(`<div style="font-size:14px;line-height:1.7;color:#2D2D2D;">${formatted}</div>`)
    }
    if (inList) out.push('</ul>')
    return out.join('\n')
}

function styledDocumentTextToEmailHtml(text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const lines = text.split('\n')
    const out = []
    let inList = false

    for (const raw of lines) {
        const line = raw.trimEnd()
        const trimmed = line.trim()

        if (/^---+$/.test(trimmed)) {
            if (inList) { out.push('</ul>'); inList = false }
            out.push('<hr style="border:none;border-top:1px solid #e4e8ee;margin:14px 0;">')
            continue
        }

        if (isResumeBullet(line)) {
            if (!inList) { out.push('<ul style="margin:4px 0 4px 0;padding-left:20px;">'); inList = true }
            const bulletText = applyResumeHtmlEmphasis(esc(stripResumeBullet(line)))
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
            out.push(`<li style="margin:2px 0;font-size:14px;line-height:1.7;color:#2D2D2D;">${bulletText}</li>`)
            continue
        }

        if (inList) { out.push('</ul>'); inList = false }
        if (!trimmed) { out.push('<div style="height:8px;"></div>'); continue }

        if (isResumeSectionHeader(trimmed)) {
            out.push(`<div style="font-weight:700;font-size:12px;letter-spacing:0.1em;color:#306770;margin-top:20px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e4e8ee;">${esc(trimmed)}</div>`)
            continue
        }

        const formatted = applyResumeHtmlEmphasis(esc(line))
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')

        if (isLikelyResumeRoleLine(line)) {
            out.push(`<div style="font-weight:700;font-size:14px;line-height:1.7;color:#1A1A2E;">${formatted}</div>`)
            continue
        }

        out.push(`<div style="font-size:14px;line-height:1.7;color:#2D2D2D;">${formatted}</div>`)
    }

    if (inList) out.push('</ul>')
    return out.join('\n')
}

function styledDocumentTextToAttachmentHtml(text) {
    return styledDocumentTextToEmailHtml(text).replace(/color:#306770/g, 'color:#111111')
}

function buildDocumentEmailHtml({ greeting, docLabel, jobTitle, company, content, hasAttachment }) {
    const PRIMARY = '#306770'
    const BG = '#F2F4F8'
    const htmlContent = styledDocumentTextToEmailHtml(content || '')
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:'Manrope',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td style="padding-bottom:28px;">
          <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#1A1A2E;font-family:'Manrope',Arial,sans-serif;line-height:1.2;">
            Hi ${greeting}, here is your ${docLabel}.
          </h1>
          <p style="margin:0;font-size:15px;color:#555;font-family:'Manrope',Arial,sans-serif;">
            Tailored for <strong style="color:#1A1A2E;">${jobTitle}</strong> at <strong style="color:#1A1A2E;">${company}</strong>
          </p>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E4E8EE;">
          <div style="font-family:Arial,sans-serif;">${htmlContent}</div>
        </td></tr>
        ${hasAttachment ? `
        <tr><td style="padding-top:16px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#888;font-family:'Manrope',Arial,sans-serif;">
            Your ${docLabel} is attached to this email — open or save it directly from here.
          </p>
        </td></tr>` : ''}
        <tr><td style="padding-top:36px;text-align:center;border-top:1px solid #E4E8EE;margin-top:24px;">
          <p style="margin:0;font-size:13px;color:#999;font-family:'Manrope',Arial,sans-serif;">
            Good luck with your application!<br>
            <strong style="color:${PRIMARY};">Wander/Work Team</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function normalizeCustomDocumentFormat(value) {
    return String(value || '').trim().toLowerCase() === 'doc' ? 'doc' : 'pdf'
}

function safeDocumentFilename(value, fallback = 'document') {
    const slug = String(value || fallback)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
    return slug || fallback
}

function buildWordDocBuffer(content, title) {
    const esc = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    @page { margin: 0.75in; }
    body { font-family: Arial, sans-serif; color: #1A1A2E; font-size: 11pt; line-height: 1.45; }
    ul { margin-top: 4px; margin-bottom: 4px; }
    li { margin-bottom: 3px; }
  </style>
</head>
<body>
${styledDocumentTextToAttachmentHtml(content || '')}
</body>
</html>`
    return Buffer.from(html, 'utf8')
}

function normalizePdfText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
}

function wrapPdfLines(text, maxChars = 92) {
    const lines = []
    for (const rawLine of normalizePdfText(text).split('\n')) {
        let line = rawLine.trimEnd()
        if (!line.trim()) {
            lines.push('')
            continue
        }
        while (line.length > maxChars) {
            let splitAt = line.lastIndexOf(' ', maxChars)
            if (splitAt < 40) splitAt = maxChars
            lines.push(line.slice(0, splitAt).trimEnd())
            line = line.slice(splitAt).trimStart()
        }
        lines.push(line)
    }
    return lines
}

function pdfEscape(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildPdfBuffer(content, documentType = 'resume') {
    const isResume = documentType === 'resume'
    const allLines = wrapPdfLines(content)
    const maxLinesPerPage = 48
    const pages = []
    for (let i = 0; i < Math.max(allLines.length, 1); i += maxLinesPerPage) {
        pages.push(allLines.slice(i, i + maxLinesPerPage))
    }

    const objects = [null]
    const addObject = (body) => { objects.push(body); return objects.length - 1 }

    const fontRegId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
    const pageIds = []
    let isFirstPage = true

    for (const pageLines of pages) {
        const streamLines = ['BT', '/F1 10 Tf', '72 742 Td', '14 TL']
        let nameWritten = !isFirstPage

        for (const line of pageLines) {
            if (!line.trim()) { streamLines.push('T*'); continue }

            if (isResume && !nameWritten) {
                // First non-empty line = name: bold, 16pt, space below
                streamLines.push('/F2 16 Tf', `(${pdfEscape(line)}) Tj`, 'T*', 'T*', '/F1 10 Tf')
                nameWritten = true
                continue
            }
            if (!isResume) nameWritten = true

            if (isResume && isResumeSectionHeader(line)) {
                streamLines.push('T*', `/F2 10 Tf`, `(${pdfEscape(line)}) Tj`, 'T*', '/F1 10 Tf')
                continue
            }

            streamLines.push(`(${pdfEscape(line)}) Tj`, 'T*')
        }
        streamLines.push('ET')
        isFirstPage = false

        const stream = streamLines.join('\n')
        const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
        const pageId = addObject(`<< /Type /Page /Parent __PAGES_ID__ 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`)
        pageIds.push(pageId)
    }

    const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)
    const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    for (let id = 1; id < objects.length; id++) {
        offsets[id] = Buffer.byteLength(pdf, 'latin1')
        pdf += `${id} 0 obj\n${String(objects[id]).replace(/__PAGES_ID__/g, String(pagesId))}\nendobj\n`
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1')
    pdf += `xref\n0 ${objects.length}\n`
    pdf += '0000000000 65535 f \n'
    for (let id = 1; id < objects.length; id++) {
        pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    return Buffer.from(pdf, 'latin1')
}

async function callOpenAI(systemPrompt, userPrompt, maxTokens = 1500) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return null
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: maxTokens,
            },
            { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 }
        )
        return response.data?.choices?.[0]?.message?.content?.trim() || null
    } catch (e) {
        console.warn('OpenAI call failed:', e.message)
        return null
    }
}

const submitCustomRequest = asyncHandler(async (req, res) => {
    const payload = req.body || {};
    // JWT email takes precedence — client-supplied email is only a fallback for dev/testing
    const email = cleanTextValue(req.user?.email || payload.email)
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const { firstName, lastName, jobId, jobTitle, company, jobUrl, resume, coverLetter } = payload;
    const fileFormat = normalizeCustomDocumentFormat(payload.fileFormat || payload.documentFormat || payload.outputFormat);
    const DOCUMENT_TOKEN_COST = 2;
    const totalCost = (resume ? DOCUMENT_TOKEN_COST : 0) + (coverLetter ? DOCUMENT_TOKEN_COST : 0);
    if (totalCost === 0) return res.status(400).json({ message: 'No items requested.' });

    const sgApiKey = process.env.SENDGRID_API_KEY
    if (!sgApiKey || sgApiKey === 'SG.placeholder') {
        console.error('[CustomRequest] SendGrid not configured - SENDGRID_API_KEY required')
        return res.status(503).json({ message: 'Email delivery is unavailable. No credits were charged.' })
    }

    // Atomic token check + deduction — same pattern as recruiter sendEmail
    const prevCandidate = await Candidates.findOneAndUpdate(
        {
            email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            tokenBalance: { $gte: totalCost },
        },
        { $inc: { tokenBalance: -totalCost, tokensUsed: totalCost } },
        { new: false }
    )

    if (!prevCandidate) {
        const exists = await Candidates.exists({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } })
        return res.status(exists ? 402 : 404).json({
            message: exists ? 'Insufficient tokens' : 'Candidate not found',
        })
    }

    const tokensRemaining = (prevCandidate.tokenBalance ?? totalCost) - totalCost

    // Fetch job description from MongoDB for better AI context
    let jobDescription = ''
    let jobDoc = null
    if (jobId) {
        try {
            jobDoc = await Jobs.findById(String(jobId)).lean().catch(() => null)
                ?? await Jobs.findOne({ job_code: String(jobId) }).lean()
            if (jobDoc) jobDescription = jobDoc.description || jobDoc.summary || jobDoc.shortDescription || ''
        } catch {}
    }

    const candidateName = `${prevCandidate.firstName || firstName || ''} ${prevCandidate.lastName || lastName || ''}`.trim()
    const candidateGreeting = prevCandidate.firstName || firstName || 'there'
    const skillsList = [...(prevCandidate.skills || []), ...(prevCandidate.skills_2 || [])].filter(Boolean).slice(0, 20).join(', ')
    const rolesList = (prevCandidate.targetRoles || []).slice(0, 5).join(', ')
    const resumeText = prevCandidate.resume_text || ''

    // Collect real contact details so the AI never needs to use placeholders
    const candidatePhone = prevCandidate.phone || ''
    const candidateLocation = formatCandidateLocation(prevCandidate.location?.[0])
    const candidateContactEmail = cleanTextValue(prevCandidate.contactEmail || prevCandidate.email || email)
    const candidatePortfolio = prevCandidate.urls?.find((u) => u.urlName === 'Portfolio')?.urlAddress || ''
    const candidateGitHub = prevCandidate.urls?.find((u) => u.urlName === 'GitHub')?.urlAddress || ''
    const contactBlock = [
        candidateName,
        candidateContactEmail,
        candidatePhone,
        candidateLocation,
        candidatePortfolio,
        candidateGitHub,
    ].filter(Boolean).join('\n')

    // Use structured fields first; fall back to deriving from resume_text if empty
    let workExperience = prevCandidate.work_experience || ''
    let education = prevCandidate.education || ''
    if (resumeText && (!workExperience || !education)) {
        const derived = deriveResumeFields(resumeText)
        if (!workExperience && derived.workExperience) workExperience = derived.workExperience
        if (!education && derived.education) education = derived.education
        // Persist derived fields so future requests don't re-derive
        if (derived.workExperience || derived.education) {
            Candidates.updateOne({ _id: prevCandidate._id }, { $set: { work_experience: workExperience, education } }).catch(() => {})
        }
    }

    const jobContext = `Job Title: ${jobTitle}\nCompany: ${company}${jobDescription ? '\n\nJob Description:\n' + jobDescription.slice(0, 3000) : ''}`
    const candidateContext = [
        `== CANDIDATE CONTACT INFO (copy verbatim into resume header — never use brackets or placeholders) ==`,
        contactBlock,
        `\nTarget roles: ${rolesList}`,
        `Skills: ${skillsList}`,
        workExperience ? `\n== WORK EXPERIENCE (use this section exactly — real employers, titles, and dates) ==\n${workExperience.slice(0, 3000)}` : '',
        education ? `\n== EDUCATION (use this section exactly) ==\n${education.slice(0, 1000)}` : '',
        resumeText && !workExperience ? `\n== FULL RESUME TEXT ==\n${resumeText.slice(0, 4000)}` : '',
    ].filter(Boolean).join('\n')

    // Post-process: strip every [bracket placeholder] the AI might still emit
    const fillPlaceholders = (text) => {
        if (!text) return text
        return text
            .replace(/\[Your (E-?mail)\]/gi, candidateContactEmail || '')
            .replace(/\[Your Phone( Number)?\]/gi, candidatePhone || '')
            .replace(/\[City,?\s*State,?\s*(Zip)?\]/gi, candidateLocation || '')
            .replace(/\[Your Address\]/gi, candidateLocation || '')
            .replace(/\[LinkedIn( Profile| URL)?\]/gi, '')
            .replace(/\[Portfolio( URL)?\]/gi, candidatePortfolio || '')
            .replace(/\[GitHub( URL)?\]/gi, candidateGitHub || '')
            // Remove any remaining [bracket placeholder] lines entirely
            .replace(/^\s*\[.*?\]\s*$/gm, '')
            // Collapse 3+ blank lines to 2
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    const stripLinkedInContact = (text) => {
        if (!text) return text
        return text
            .split('\n')
            .filter((line) => {
                const t = line.trim()
                return !/(linkedin\.com|^\s*linkedin\s*(profile|url)?\s*:?\s*$)/i.test(t)
                    && !/^https?:\/\/(www\.)?linkedin\.com/i.test(t)
            })
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }

    const ensureSectionSpacing = (text) => {
        if (!text) return text
        return text
            .split('\n')
            .reduce((acc, line, i, arr) => {
                acc.push(line)
                // Add blank line after section headers if next line is not blank
                if (isResumeSectionHeader(line.trim()) && i + 1 < arr.length && arr[i + 1].trim()) {
                    acc.push('')
                }
                return acc
            }, [])
            .join('\n')
    }

    // RTF builder — opens natively in Word, Pages, Google Docs
    const textToRtf = (text, options = {}) => {
        const isResume = options.documentType === 'resume'
        const rtfEsc = (s) => s
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0)}?`)

        const rtfWithMarkdownEmphasis = (value) => rtfEsc(value)
                .replace(/\*\*(.+?)\*\*/g, (_, m) => `{\\b ${m}}`)
                .replace(/\*(.+?)\*/g, (_, m) => `{\\i ${m}}`)

        const rtfWithMetricBold = (value) => {
            const metricRe = new RegExp(RESUME_METRIC_RE.source, 'g')
            let output = ''
            let lastIndex = 0
            value.replace(metricRe, (match, _metric, offset) => {
                output += rtfEsc(value.slice(lastIndex, offset))
                output += `{\\b ${rtfEsc(match)}}`
                lastIndex = offset + match.length
                return match
            })
            output += rtfEsc(value.slice(lastIndex))
            return output
        }

        let lines
        if (!isResume) {
            lines = text.split('\n').map((line) => `\\pard\\sa120\\sl276\\slmult1 ${rtfWithMarkdownEmphasis(line)}\\par`).join('\n')
        } else {
            let hasStyledName = false
            let seenSection = false
            lines = text.split('\n').map((raw) => {
                const line = raw.trimEnd()
                const trimmed = line.trim()

                if (!trimmed) return '\\pard\\sa80\\par'
                if (/^---+$/.test(trimmed)) return '\\pard\\brdrb\\brdrs\\brdrw10\\brsp40\\sa120\\par'

                if (!hasStyledName && !seenSection && !isKnownResumeSectionHeader(trimmed)) {
                    hasStyledName = true
                    return `\\pard\\sa200\\sl300\\slmult1\\cf3\\b\\fs40 ${rtfEsc(trimmed)}\\b0\\cf2\\fs22\\par`
                }

                if (isResumeSectionHeader(trimmed)) {
                    seenSection = true
                    return `\\pard\\brdrb\\brdrs\\brdrw10\\brsp40\\sa160\\sl276\\slmult1\\cf3\\b\\fs22 ${rtfEsc(trimmed)}\\b0\\cf2\\fs22\\par`
                }

                if (!seenSection) {
                    return `\\pard\\sa80\\sl240\\slmult1\\fs20 ${rtfEsc(trimmed)}\\fs22\\par`
                }

                if (isResumeBullet(line)) {
                    return `\\pard\\fi-240\\li360\\sa80\\sl276\\slmult1 - ${rtfWithMetricBold(stripResumeBullet(line))}\\par`
                }

                const body = rtfWithMetricBold(trimmed)
                if (isLikelyResumeRoleLine(trimmed)) {
                    return `\\pard\\sa80\\sl276\\slmult1\\b ${body}\\b0\\par`
                }

                return `\\pard\\sa80\\sl276\\slmult1 ${body}\\par`
            }).join('\n')
        }

        return `{\\rtf1\\ansi\\ansicpg1252\\deff0` +
            `{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}` +
            `{\\colortbl ;\\red48\\green103\\blue112;\\red45\\green45\\blue45;\\red0\\green0\\blue0;}` +
            `\\margl1080\\margr1080\\margt900\\margb900\\f0\\fs22\\cf2 ` +
            lines + `}`
    }

    // Generate AI content in parallel
    const [resumeRaw, coverLetterRaw] = await Promise.all([
        resume ? callOpenAI(
            `You are an expert resume writer producing ATS-optimized resumes. Write the candidate's complete tailored resume using ONLY the real data provided — never invent employers, dates, degrees, or any other details. If a data point is missing, omit that section entirely.

STRICT FORMATTING RULES — follow exactly:
- Do NOT use markdown. No asterisks (*), pound signs (#), underscores (_), or backticks.
- Section headers must be in ALL CAPS on their own line (e.g. WORK EXPERIENCE, EDUCATION, SUMMARY)
- Bullet points must start with a hyphen and space: "- "
- Separate sections with a single blank line
- Never use bracket placeholders like [Company Name] or [Your Degree]
- Do NOT include a SKILLS section. Skills should be woven naturally into the experience bullet points instead.

Tailor every bullet point to match the target job description — highlight specific skills and accomplishments that directly address the role's requirements.`,
            `${jobContext}\n\n${candidateContext}\n\nWrite the complete tailored resume. Every bullet point should connect the candidate's real experience to the requirements of this specific role. Use only real data from above. Do not add a SKILLS section.`,
            2000
        ) : Promise.resolve(null),
        coverLetter ? (() => {
            const safeCompany = cleanTextValue(company) || 'the company'
            const safeTitle = cleanTextValue(jobTitle) || 'this role'
            const openings = [
                `I'm interested in the ${safeTitle} position at ${safeCompany} because`,
                `${safeCompany} seems like a really great match for my background because`,
                `I think I bring real value to ${safeCompany} because`,
                `The mission of ${safeCompany} aligns with my skillset and background because`,
                `After coming across the ${safeTitle} opening at ${safeCompany}, I knew I had to reach out because`,
                `What draws me to ${safeCompany} is`,
                `Building my career around ${safeTitle.toLowerCase().replace(/^(senior|lead|principal)\s+/i, '')} work, ${safeCompany} stood out to me because`,
            ]
            const chosenOpening = openings[Math.floor(Math.random() * openings.length)]
            return callOpenAI(
                `You are a professional cover letter writer. Write a concise, tailored cover letter using the candidate's real background. Start with 'Dear Hiring Manager,' on the first line. The very first sentence of the body must begin with exactly: "${chosenOpening}" — then complete it naturally based on the job and candidate. Use 3-4 short paragraphs. No header block. Do not use placeholder text. Do not start with "I'm excited", "I am thrilled", or similar enthusiastic clichés. Plain text only.`,
                `${jobContext}\n\n${candidateContext}\n\nWrite the cover letter. Remember: begin the first body sentence with "${chosenOpening}"`,
                800
            )
        })() : Promise.resolve(null),
    ])

    const resumeContent = ensureSectionSpacing(sanitizeResumeHeader(
        stripLinkedInContact(fillPlaceholders(resumeRaw)),
        {
            location: candidateLocation,
            email: candidateContactEmail,
            phone: candidatePhone,
            contactLines: [
                candidateName,
                candidateContactEmail,
                candidatePhone,
                candidateLocation,
                candidatePortfolio,
                candidateGitHub,
            ],
            // Only stop at canonical resume sections. A generated all-caps name
            // (for example, "DARRIEN CARTER") is part of the duplicate contact
            // block and must be removed along with the rest of that block.
            isSectionHeader: isKnownResumeSectionHeader,
        }
    ))
    const coverLetterContent = sanitizeDocumentContact(
        stripLinkedInContact(fillPlaceholders(coverLetterRaw)),
        { email: candidateContactEmail, phone: candidatePhone }
    )
        ?.split('\n').filter(line => !/^---+$/.test(line.trim())).join('\n')

    const failedDocuments = [
        resume && !resumeContent ? 'resume' : '',
        coverLetter && !coverLetterContent ? 'cover letter' : '',
    ].filter(Boolean)

    if (failedDocuments.length) {
        await Candidates.updateOne(
            { _id: prevCandidate._id },
            { $inc: { tokenBalance: totalCost, tokensUsed: -totalCost } }
        )
        console.error(`[CustomRequest] Generation failed for ${failedDocuments.join(', ')}; credits refunded for ${email}`)
        return res.status(502).json({
            message: `We could not generate the requested ${failedDocuments.join(' and ')}. Your credits were refunded.`,
            generationFailed: failedDocuments,
            tokensRemaining: prevCandidate.tokenBalance ?? totalCost,
        })
    }

    let application = null
    if (jobDoc?._id && (resumeContent || coverLetterContent)) {
        application = await Applications.findOneAndUpdate(
            { jobId: jobDoc._id, candidateId: prevCandidate._id },
            {
                $set: {
                    preparedAt: new Date(),
                    status: 'prepared',
                    jobTitle: jobTitle || jobDoc.title || '',
                    company: company || jobDoc.company || '',
                    resume: resumeContent
                        ? {
                            type: 'generated',
                            content: resumeContent,
                            jobTitle: jobTitle || jobDoc.title || '',
                            company: company || jobDoc.company || '',
                            createdAt: new Date()
                        }
                        : {},
                    coverLetter: coverLetterContent || ''
                }
            },
            { new: true, upsert: true }
        )
    }

    // Send emails via SendGrid
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(sgApiKey)

        const FROM_EMAIL = { name: 'Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' }
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sephrim07@gmail.com'
        const safeCompany = safeDocumentFilename(company, 'company')
        const buildAttachments = ({ content, filenameBase, documentType, title }) => {
            const attachments = [{
                content: Buffer.from(textToRtf(content, { documentType })).toString('base64'),
                type: 'text/rtf',
                filename: `${filenameBase}.rtf`,
                disposition: 'attachment',
            }]

            if (fileFormat === 'doc') {
                attachments.push({
                    content: buildWordDocBuffer(content, title).toString('base64'),
                    type: 'application/msword',
                    filename: `${filenameBase}.doc`,
                    disposition: 'attachment',
                })
            } else {
                attachments.push({
                    content: buildPdfBuffer(content, documentType).toString('base64'),
                    type: 'application/pdf',
                    filename: `${filenameBase}.pdf`,
                    disposition: 'attachment',
                })
            }

            return attachments
        }
        const candidateSends = []

        if (resume) {
            const subject = `Your Resume for ${jobTitle} at ${company}`
            if (resumeContent) {
                candidateSends.push({
                    label: 'resume',
                    promise: sgMail.send({
                    from: FROM_EMAIL,
                    to: email,
                    subject,
                    html: buildDocumentEmailHtml({ greeting: candidateGreeting, docLabel: 'tailored resume', jobTitle, company, content: resumeContent, hasAttachment: true }),
                    attachments: buildAttachments({
                        content: resumeContent,
                        filenameBase: `resume-${safeCompany}`,
                        documentType: 'resume',
                        title: `Resume for ${jobTitle || 'Role'} at ${company || 'Company'}`,
                    }),
                    }),
                })
            }
        }

        if (coverLetter) {
            const subject = `Your Cover Letter for ${jobTitle} at ${company}`
            if (coverLetterContent) {
                candidateSends.push({
                    label: 'cover letter',
                    promise: sgMail.send({
                    from: FROM_EMAIL,
                    to: email,
                    subject,
                    html: buildDocumentEmailHtml({ greeting: candidateGreeting, docLabel: 'cover letter', jobTitle, company, content: coverLetterContent, hasAttachment: true }),
                    attachments: buildAttachments({
                        content: coverLetterContent,
                        filenameBase: `cover-letter-${safeCompany}`,
                        documentType: 'coverLetter',
                        title: `Cover Letter for ${jobTitle || 'Role'} at ${company || 'Company'}`,
                    }),
                    }),
                })
            }
        }

        const deliveryResults = await Promise.allSettled(candidateSends.map((item) => item.promise))
        const failedDeliveries = deliveryResults
            .map((result, index) => ({ result, label: candidateSends[index]?.label }))
            .filter(({ result }) => result.status === 'rejected')

        if (failedDeliveries.length) {
            await Candidates.updateOne(
                { _id: prevCandidate._id },
                { $inc: { tokenBalance: totalCost, tokensUsed: -totalCost } }
            )
            const failedLabels = failedDeliveries.map(({ label }) => label).filter(Boolean)
            const errorDetails = failedDeliveries
                .map(({ result, label }) => `${label}: ${result.reason?.response?.body ? JSON.stringify(result.reason.response.body) : result.reason?.message || result.reason}`)
                .join(' | ')
            console.error(`[CustomRequest] Email delivery failed for ${email}; credits refunded: ${errorDetails}`)
            return res.status(502).json({
                message: `Your materials were generated${application ? ' and saved to Messages' : ''}, but email delivery failed for ${failedLabels.join(' and ')}. Your credits were refunded.`,
                emailDelivery: { sent: false, failed: failedLabels },
                tokensRemaining: prevCandidate.tokenBalance ?? totalCost,
                application,
                fileFormat,
                includedFormats: ['rtf', fileFormat],
            })
        }

        const requested = [resume && 'Resume', coverLetter && 'Cover Letter'].filter(Boolean).join(' + ')
        const adminBody = [
            `Request: ${requested} | ${candidateName} <${email}>`,
            `Job: ${jobTitle} at ${company}`,
            `URL: ${jobUrl || 'N/A'}`,
            `Attachment format: RTF + ${fileFormat.toUpperCase()}`,
            `Tokens used: ${totalCost} | Remaining: ${tokensRemaining}`,
            resumeContent ? `\n== RESUME ==\n${resumeContent}` : '',
            coverLetterContent ? `\n== COVER LETTER ==\n${coverLetterContent}` : '',
        ].filter(Boolean).join('\n')
        const adminSend = sgMail.send({
            from: FROM_EMAIL,
            to: ADMIN_EMAIL,
            subject: `[Wander/Work] ${requested} Request from ${candidateName}`,
            text: adminBody,
        })

        try {
            await adminSend
        } catch (e) {
            console.warn('[CustomRequest] Admin notification failed:', e.message)
            // Still return ok — tokens were deducted, content was generated
        }

    return res.json({
        ok: true,
        tokensRemaining,
        application,
        fileFormat,
        includedFormats: ['rtf', fileFormat],
        emailDelivery: {
            sent: true,
            to: email,
            documents: candidateSends.map((item) => item.label),
        },
    })
});

const UpdateAllData = asyncHandler(async (req, res) => {
    const { data } = req.body || {};
    const userEmail = String(req.user?.email || '').toLowerCase();
    if (!userEmail) return res.status(401).json({ message: 'Authentication required.' });
    if (!data || typeof data !== 'object') return res.status(400).json({ message: 'data is required.' });

    const candidate = await Candidates.findOne({ email: userEmail }).lean().exec();
    if (!candidate) return res.status(404).json({ message: 'Candidate not found.' });
    const candidateId = candidate._id;
    const candidateIdString = String(candidateId);

    const editableCandidateFields = new Set([
        'firstName',
        'lastName',
        'contactEmail',
        'phone',
        'location',
        'targetRoles',
        'seniority',
        'skills',
        'urls',
        'resume',
        'resumeLink',
        'coverLetter',
        'coverLetterLink',
        'profileImage',
        'summary',
        'work_experience',
        'education',
    ]);

    let candidateUpdated = false;
    for (const patch of Array.isArray(data.Candidates) ? data.Candidates : []) {
        if (patch?._id && String(patch._id) !== candidateIdString) {
            return res.status(403).json({ message: 'Forbidden: candidate does not belong to this account.' });
        }
        if (patch?.email && String(patch.email).toLowerCase() !== userEmail) {
            return res.status(403).json({ message: 'Email changes are not allowed from this endpoint.' });
        }

        const setFields = {};
        for (const [key, value] of Object.entries(patch || {})) {
            if (editableCandidateFields.has(key)) setFields[key] = value;
        }
        if (Object.prototype.hasOwnProperty.call(setFields, 'contactEmail')) {
            setFields.contactEmail = cleanTextValue(setFields.contactEmail).toLowerCase();
            if (setFields.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setFields.contactEmail)) {
                return res.status(400).json({ message: 'Enter a valid contact email address.' });
            }
        }

        if (Object.keys(setFields).length) {
            await Candidates.updateOne({ _id: candidateId }, { $set: setFields });
            candidateUpdated = true;
        }
    }

    let applicationUpdates = 0;
    const allowedStatuses = new Set(['interested', 'not_interested', 'prepared', 'applied', 'dismissed']);
    for (const application of Array.isArray(data.Applications) ? data.Applications : []) {
        if (application?.candidateId && String(application.candidateId) !== candidateIdString) {
            return res.status(403).json({ message: 'Forbidden: application does not belong to this account.' });
        }
        if (!application?.jobId) continue;

        const status = allowedStatuses.has(application.status) ? application.status : 'interested';
        await Applications.findOneAndUpdate(
            { jobId: application.jobId, candidateId },
            {
                $set: {
                    status,
                    preparedAt: application.preparedAt ? new Date(application.preparedAt) : new Date(),
                },
                $setOnInsert: {
                    jobId: application.jobId,
                    candidateId,
                    resume: {},
                    coverLetter: '',
                },
            },
            { upsert: true }
        );
        applicationUpdates++;
    }

    let pairing = { updated: false };
    try {
        if (candidateUpdated) {
            pairing = { updated: true, results: [await pairCandidateJobs(candidateId)] };
        }
    } catch (err) {
        pairing = { updated: false, reason: err.message };
    }

    res.status(200).json({ message: 'Update process completed.', candidateUpdated, applicationUpdates, pairing });
});

const ImportData = asyncHandler(async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: 'data is required.' });

    const candidateList = Array.isArray(data.Candidates) ? data.Candidates : [];
    const jobList = Array.isArray(data.Jobs) ? data.Jobs : [];
    const contactList = Array.isArray(data.Contacts) ? data.Contacts : [];
    const applicationList = Array.isArray(data.Applications) ? data.Applications : [];
    const pairingList = Array.isArray(data.CandidateJobPairings) ? data.CandidateJobPairings : [];
    const contactPairingList = Array.isArray(data.ContactJobPairing) ? data.ContactJobPairing : [];

    await Promise.all(candidateList.map((c) =>
        Candidates.findOneAndUpdate(
            { email: c.email },
            { $set: { firstName: c.firstName, lastName: c.lastName, phone: c.phone, location: c.location, targetRoles: c.targetRoles, seniority: c.seniority, skills: c.skills, urls: c.urls, resume: c.resume, resumeLink: c.resumeLink, status: c.status, paidUntil: c.paidUntil, graceDays: c.graceDays, tokenBalance: c.tokenBalance, tokensUsed: c.tokensUsed, creditsBalance: c.creditsBalance, creditsUsed: c.creditsUsed }, $setOnInsert: { email: c.email } },
            { upsert: true }
        ).catch((e) => console.warn('ImportData candidate upsert failed:', e.message))
    ));

    await Promise.all(jobList.map((j) =>
        Jobs.findOneAndUpdate(
            { job_code: j.job_code },
            { $set: { title: j.title, company: j.company, salary: j.salary, location: j.location, url: j.url, jobType: j.jobType, date_posted: j.datePosted || j.date_posted, shortDescription: j.shortDescription, tags: j.tags } },
            { upsert: true }
        ).catch((e) => console.warn('ImportData job upsert failed:', e.message))
    ));

    await Promise.all(contactList.map((c) =>
        Contacts.findOneAndUpdate(
            { company: c.company, email: c.email },
            { $set: { name: c.name, title: c.title, source: c.source, lastVerified: c.lastVerified } },
            { upsert: true }
        ).catch((e) => console.warn('ImportData contact upsert failed:', e.message))
    ));

    const [candidates, jobs, contacts] = await Promise.all([
        Candidates.find().lean(),
        Jobs.find().lean(),
        Contacts.find().lean(),
    ]);

    await Promise.all(applicationList.map((a) => {
        const job = jobs.find((j) => j.job_code === a.jobId);
        const candidate = candidates.find((c) => c.email === a.email);
        if (!job || !candidate) return Promise.resolve();
        return Applications.findOneAndUpdate(
            { jobId: job._id, candidateId: candidate._id },
            { $setOnInsert: { jobId: job._id, candidateId: candidate._id, preparedAt: a.preparedAt, status: a.status, resume: a.resume, coverLetter: a.coverLetter } },
            { upsert: true }
        ).catch((e) => console.warn('ImportData application upsert failed:', e.message));
    }));

    await Promise.all(pairingList.map((p) => {
        const job = jobs.find((j) => j.job_id === p.job_id);
        const candidate = candidates.find((c) => c.email === p.email);
        if (!job || !candidate) return Promise.resolve();
        return CandidateJobPairings.findOneAndUpdate(
            { jobId: job._id, candidateId: candidate._id },
            { $set: { score: p.score } },
            { upsert: true }
        ).catch((e) => console.warn('ImportData pairing upsert failed:', e.message));
    }));

    await Promise.all(contactPairingList.map((p) => {
        const contact = contacts.find((c) => c.email === p.email);
        const job = jobs.find((j) => j.job_code === p.job_id);
        if (!contact || !job) return Promise.resolve();
        return ContactJobPairings.findOneAndUpdate(
            { jobId: job._id, contactId: contact._id },
            { $set: { confidence: p.confidence } },
            { upsert: true }
        ).catch((e) => console.warn('ImportData contact pairing upsert failed:', e.message));
    }));

    res.status(200).json({ message: 'Import process completed.' });
});


const sendPlanWelcomeEmail = asyncHandler(async (req, res) => {
    const { plan } = req.body || {};
    const email = String(req.user?.email || '').toLowerCase();
    if (!email || !plan) {
        return res.status(400).json({ message: 'email and plan are required.' });
    }
    if (!['pro', 'premium'].includes(plan.toLowerCase())) {
        return res.status(400).json({ message: 'plan must be "pro" or "premium".' });
    }

    const candidate = await Candidates.findOne({ email: String(email).toLowerCase() });
    const firstName = candidate?.firstName || '';

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sgMail = require('@sendgrid/mail');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { proWelcomeEmail, premiumWelcomeEmail } = require('../../utils/mail.templates');

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const template = plan.toLowerCase() === 'pro'
        ? proWelcomeEmail(firstName)
        : premiumWelcomeEmail(firstName);

    try {
        await sgMail.send({ to: email, ...template });
        res.json({ sent: true });
    } catch (err) {
        console.error('Welcome email failed:', err.response?.body || err.message);
        res.status(500).json({ message: 'Failed to send welcome email.', error: err.message });
    }
});

const INDEED_RE = /indeed|linkedin/i;
const SALARY_NUM_RE = /\d/;
const JUNK_SALARY_RE = /^(not listed|unlisted|competitive|tbd|negotiable|n\/a|see below|varies|open|flexible)$/i;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Non-ASCII chars common in European languages (German umlauts, French accents, Spanish ñ, etc.)
const NON_ENGLISH_CHARS_RE = /[äöüßéèêëàâçñïîùûœæøåãõ]/i;
// Common function words that only appear in German, French, Spanish, Italian, Dutch, Portuguese
const NON_ENGLISH_WORDS_RE = /\b(und|oder|mit|für|auf|bei|wir|sind|haben|wird|eine|nicht|aber|mehr|auch|nach|wenn|noch|kann|muss|über|unter|durch|statt|unsere|unser|ihrer|ihrer|bewirb|dich|stellenangebot|et|pour|avec|dans|sur|les|une|qui|par|notre|vous|nous|leur|des|offre|emploi|poste|empresa|trabajo|para|que|del|los|nuestro|con|desde|puesto|vaga|vagas|nosso|nossa|com|para|cargo|é|em|uma|och|eller|med|för|på|vid|är|har|bli|en|ett|og|til|av|er|som|vi|kan|dit|het|een|van|der|bij|zijn|naar|deze|wordt|worden|onze|per|con|nel|della|delle|degli|degli|lavoro|siamo|cerchiamo|offerta)\b/i;

function isLikelyEnglish(text) {
    if (!text) return true;
    const t = String(text);
    if (NON_ENGLISH_CHARS_RE.test(t)) return false;
    if (NON_ENGLISH_WORDS_RE.test(t)) return false;
    return true;
}

const FEATURED_JOBS_DEFAULT_LIMIT = 60;
const FEATURED_JOBS_MAX_LIMIT = 200;
const NEW_JOB_WINDOW_DAYS = 3;

const getJobStats = asyncHandler(async (_req, res) => {
    const all = await getAllJobsPure();
    const now = Date.now();
    const cutoff = now - NEW_JOB_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const newJobs = all.reduce((count, job) => {
        const postedAt = parseJobDate(job);
        return postedAt && postedAt >= cutoff && postedAt <= now ? count + 1 : count;
    }, 0);

    res.json({
        totalJobs: all.length,
        newJobs,
        windowDays: NEW_JOB_WINDOW_DAYS,
        generatedAt: new Date(now).toISOString(),
    });
});

const getFeaturedJobs = asyncHandler(async (req, res) => {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, FEATURED_JOBS_MAX_LIMIT)
        : FEATURED_JOBS_DEFAULT_LIMIT;

    const all = await getAllJobsPure();
    const now = Date.now();

    const scored = [];
    for (const job of all) {
        // Hard excludes: must have a real title, company, and URL
        const title = String(job.title || job.job_title || job.name || '').trim();
        const company = String(job.company || '').trim();
        if (!title || title === 'Untitled') continue;
        if (!company || company === 'Unknown') continue;
        if (!job.url && !job.apply_url && !job.applyUrl) continue;

        // English-only for the public guest feed
        const desc = String(job.description_short || job.shortDescription || job.description || '').trim();
        if (!isLikelyEnglish(title) || !isLikelyEnglish(desc)) continue;

        const src = String(job.source || '').toLowerCase();
        const salary = String(job.salary || '').trim();
        const hasSalary = salary && !JUNK_SALARY_RE.test(salary) && SALARY_NUM_RE.test(salary);

        let score = 0;
        if (hasSalary) score += 3;
        if (desc.length >= 250) score += 3;
        else if (desc.length >= 80) score += 2;
        else if (desc.length >= 20) score += 1;
        const skillCount = Array.isArray(job.skills) ? job.skills.length : 0;
        if (skillCount >= 3) score += 1;
        if (/greenhouse|lever|workday|ashby|smartrecruiters|icims|jobvite|breezy/i.test(src)) score += 2;

        // Recency bonus based on posting date (not a hard filter)
        const raw = job.date_posted || job.datePosted || job.postedAt || job.postedDate;
        if (raw) {
            const ts = new Date(raw).getTime();
            if (!Number.isNaN(ts)) {
                const daysOld = (now - ts) / (1000 * 60 * 60 * 24);
                if (daysOld <= 7) score += 2;
                else if (daysOld <= 30) score += 1;
            }
        }

        score += Math.random() * 0.5;
        scored.push({ job, score });
    }

    scored.sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, limit).map(({ job }) => job));
});

module.exports =
{
    getEverything,
    getAllCandidates,
    getAllJobs,
    getFeaturedJobs,
    getJobStats,
    _invalidateJobsCache,
    getAllApplications,
    getAllContacts,
    getAllCandidateJobPairings,
    getAllContactJobPairings,
    getCandidateById,
    getJobById,
    getApplicationById,
    getCandidateJobPariringById,
    getContactById,
    getContactJobPairingById,
    updateCandidateSkills,
    pairCandidateJobsHandler,
    pairAllCandidatesHandler,
    parseSignupResume,
    updateCandidateResume,
    updateCandidateCoverLetter,
    submitCustomRequest,
    UpdateAllData,
    ImportData,
    purgeJunkJobs,
    backfillCandidateResumeFields,
    sendPlanWelcomeEmail,
}

const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const router = express.Router()
const jobSeekerController = require('../../controllers/JobSeeker/jobSeekerController')
const { requireAuth } = require('../../middleware/requireAuth')
const { claimWeeklyToken } = require('../../services/weeklyTokenService')

const ALLOWED_RESUME_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const ALLOWED_DOCUMENT_MIMETYPES = new Set([
  ...ALLOWED_RESUME_MIMETYPES,
  'application/rtf',
  'text/rtf',
  'text/plain',
])
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    if (ALLOWED_RESUME_MIMETYPES.has(file.mimetype) || ['.pdf', '.docx'].includes(ext)) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only PDF and DOCX files are accepted.'), { status: 400 }))
    }
  },
})
const coverLetterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCUMENT_MIMETYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only PDF, DOCX, RTF, and TXT files are accepted.'), { status: 400 }))
    }
  },
})

router.route('/')
    .get(requireAuth, jobSeekerController.getEverything)

router.route('/candidate')
    .get(requireAuth, jobSeekerController.getAllCandidates)

// Static sub-paths must come before /:id to avoid being swallowed as the id param
router.route('/candidate/resume')
    .post(requireAuth, resumeUpload.single('resume'), jobSeekerController.updateCandidateResume)

router.route('/candidate/cover-letter')
    .post(requireAuth, coverLetterUpload.single('coverLetter'), jobSeekerController.updateCandidateCoverLetter)

router.route('/candidate/:id')
    .get(requireAuth, jobSeekerController.getCandidateById)

router.route('/candidate/:id/skills')
    .patch(requireAuth, jobSeekerController.updateCandidateSkills)

router.route('/candidate/:id/pair-jobs')
    .post(requireAuth, jobSeekerController.pairCandidateJobsHandler)

router.route('/pair-jobs')
    .post(requireAuth, jobSeekerController.pairAllCandidatesHandler)

router.route('/custom-request')
    .post(requireAuth, jobSeekerController.submitCustomRequest)

router.route('/featured-jobs')
    .get(jobSeekerController.getFeaturedJobs)

router.route('/job-stats')
    .get(jobSeekerController.getJobStats)

router.route('/job')
    .get(jobSeekerController.getAllJobs)

router.route('/job/:id')
    .get(jobSeekerController.getJobById)

router.route('/jobCandidatePairing')
    .get(requireAuth, jobSeekerController.getAllCandidateJobPairings)

router.route('/jobCandidatePairing/:id')
    .get(requireAuth, jobSeekerController.getCandidateJobPariringById)

router.route('/application')
    .get(requireAuth, jobSeekerController.getAllApplications)

router.route('/application/:id')
    .get(requireAuth, jobSeekerController.getApplicationById)

router.route('/contact')
    .get(requireAuth, jobSeekerController.getAllContacts)

router.route('/contact/:id')
    .get(requireAuth, jobSeekerController.getContactById)

router.route('/contactJobPairing')
    .get(requireAuth, jobSeekerController.getAllContactJobPairings)

router.route('/contactJobPairing/:id')
    .get(requireAuth, jobSeekerController.getContactJobPairingById)

router.route('/update')
    .patch(requireAuth, jobSeekerController.UpdateAllData)


router.route('/send-welcome-email')
    .post(requireAuth, jobSeekerController.sendPlanWelcomeEmail)

router.route('/claim-weekly-token')
    .post(async (req, res) => {
        const { email, token } = req.body || {};
        if (!email || !token) {
            return res.status(400).json({ success: false, error: 'email and token are required.' });
        }
        try {
            const result = await claimWeeklyToken(email, token);
            if (!result.success) return res.status(400).json(result);
            res.json(result);
        } catch (err) {
            console.error('[ClaimToken] Error:', err.message);
            res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
        }
    })

module.exports = router

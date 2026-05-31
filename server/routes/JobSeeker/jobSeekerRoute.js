const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const router = express.Router()
const jobSeekerController = require('../../controllers/JobSeeker/jobSeekerController')
const { optionalAuth, requireAuth } = require('../../middleware/requireAuth')
const { claimWeeklyToken } = require('../../services/weeklyTokenService')

const resumeUploadDir = path.join(__dirname, '../../uploads/resumes')
const coverLetterUploadDir = path.join(__dirname, '../../uploads/cover-letters')
fs.mkdirSync(resumeUploadDir, { recursive: true })
fs.mkdirSync(coverLetterUploadDir, { recursive: true })
const ALLOWED_RESUME_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const resumeUpload = multer({
  dest: resumeUploadDir,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_RESUME_MIMETYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only PDF and DOCX files are accepted.'), { status: 400 }))
    }
  },
})
const coverLetterUpload = multer({
  dest: coverLetterUploadDir
})

router.route('/')
    .get(requireAuth, jobSeekerController.getEverything)

router.route('/candidate')
    .get(jobSeekerController.getAllCandidates)

// Static sub-paths must come before /:id to avoid being swallowed as the id param
router.route('/candidate/resume')
    .post(resumeUpload.single('resume'), jobSeekerController.updateCandidateResume)

router.route('/candidate/cover-letter')
    .post(coverLetterUpload.single('coverLetter'), jobSeekerController.updateCandidateCoverLetter)

router.route('/candidate/:id')
    .get(jobSeekerController.getCandidateById)

router.route('/candidate/:id/skills')
    .patch(jobSeekerController.updateCandidateSkills)

router.route('/candidate/:id/pair-jobs')
    .post(jobSeekerController.pairCandidateJobsHandler)

router.route('/pair-jobs')
    .post(jobSeekerController.pairAllCandidatesHandler)

router.route('/custom-request')
    .post(optionalAuth, jobSeekerController.submitCustomRequest)

router.route('/job')
    .get(jobSeekerController.getAllJobs)

router.route('/job/:id')
    .get(jobSeekerController.getJobById)

router.route('/jobCandidatePairing')
    .get(jobSeekerController.getAllCandidateJobPairings)

router.route('/jobCandidatePairing/:id')
    .get(jobSeekerController.getCandidateJobPariringById)

router.route('/application')
    .get(jobSeekerController.getAllApplications)

router.route('/application/:id')
    .get(jobSeekerController.getApplicationById)

router.route('/contact')
    .get(jobSeekerController.getAllContacts)

router.route('/contact/:id')
    .get(jobSeekerController.getContactById)

router.route('/contactJobPairing')
    .get(jobSeekerController.getAllContactJobPairings)

router.route('/contactJobPairing/:id')
    .get(jobSeekerController.getContactJobPairingById)

router.route('/update')
    .patch(jobSeekerController.UpdateAllData)


router.route('/send-welcome-email')
    .post(jobSeekerController.sendPlanWelcomeEmail)

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

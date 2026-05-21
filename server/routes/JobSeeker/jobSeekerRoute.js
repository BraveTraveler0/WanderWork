const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const router = express.Router()
const jobSeekerController = require('../../controllers/JobSeeker/jobSeekerController')
const { optionalAuth, requireAuth } = require('../../middleware/requireAuth')

const resumeUploadDir = path.join(__dirname, '../../uploads/resumes')
const coverLetterUploadDir = path.join(__dirname, '../../uploads/cover-letters')
fs.mkdirSync(resumeUploadDir, { recursive: true })
fs.mkdirSync(coverLetterUploadDir, { recursive: true })
const resumeUpload = multer({
  dest: resumeUploadDir
})
const coverLetterUpload = multer({
  dest: coverLetterUploadDir
})

router.route('/')
    .get(optionalAuth, jobSeekerController.getEverything)

router.route('/candidate')
    .get(jobSeekerController.getAllCandidates)

router.route('/candidate/:id')
    .get(jobSeekerController.getCandidateById)

router.route('/candidate/:id/skills')
    .patch(jobSeekerController.updateCandidateSkills)

router.route('/candidate/:id/pair-jobs')
    .post(jobSeekerController.pairCandidateJobsHandler)

router.route('/pair-jobs')
    .post(jobSeekerController.pairAllCandidatesHandler)

router.route('/candidate/resume')
    .post(resumeUpload.single('resume'), jobSeekerController.updateCandidateResume)

router.route('/candidate/cover-letter')
    .post(coverLetterUpload.single('coverLetter'), jobSeekerController.updateCandidateCoverLetter)

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

// ── SMTP diagnostics — hit GET /api/jobseeker/test-email to verify connection ──
router.get('/test-email', async (req, res) => {
    const nodemailer = require('nodemailer')
    const smtpUser = process.env.EMAIL_SMTP_USER
    const smtpPass = process.env.EMAIL_SMTP_PASS
    if (!smtpUser || !smtpPass) {
        return res.status(500).json({ ok: false, error: 'EMAIL_SMTP_USER / EMAIL_SMTP_PASS not set in .env' })
    }
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_SMTP_PORT) || 587,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
    })
    try {
        await transporter.verify()
        const to = req.query.to || 'darrienccarter@gmail.com'
        await transporter.sendMail({
            from: `"Wanderwork Test" <${smtpUser}>`,
            to,
            subject: 'Wanderwork SMTP Test',
            text: `SMTP is working correctly. Sent from ${smtpUser} at ${new Date().toISOString()}`,
        })
        res.json({ ok: true, message: `Test email sent to ${to} from ${smtpUser}` })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

router.route('/send-welcome-email')
    .post(jobSeekerController.sendPlanWelcomeEmail)

module.exports = router

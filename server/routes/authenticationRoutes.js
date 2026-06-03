const express = require('express')
const multer = require('multer')
const path = require('path')
const router = express.Router()
const authenticationController = require('../controllers/authenticationController')
const jobSeekerController = require('../controllers/JobSeeker/jobSeekerController')
const User = require('../models/User')
const { requireAuth } = require('../middleware/requireAuth')

const ALLOWED_RESUME_MIMETYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const signupResumeUpload = multer({
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

router.route('/signup/parse-resume')
    .post(signupResumeUpload.single('resume'), jobSeekerController.parseSignupResume)

router.route('/signup')
    .post(authenticationController.createNewUser)

router.get('/signup/verify', async (req, res) => {
    try {
        const email = String(req.query.email || '').trim().toLowerCase();
        const { token } = req.query;

        if (!email || !token) {
            return res.status(400).json({ message: 'Invalid verification link.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.verificationToken || user.verificationToken !== token) {
            return res.status(400).json({ message: 'Invalid or expired verification link.' });
        }

        user.verified = true;
        user.verificationToken = null;
        await user.save();

        res.redirect(`https://wanderwork.io`);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

router.route('/refresh').post(requireAuth, authenticationController.refreshSession);
router.route('/startSession').post(requireAuth, authenticationController.startSession);
router.route('/endSession').post(requireAuth, authenticationController.endSession);

router.route('/login')
    .post(authenticationController.login)

router.route('/googlelogin')
    .post(authenticationController.googlelogin)

router.route('/delete')
    .delete(requireAuth, authenticationController.deleteUser)

router.route('/changePassword')
    .post(requireAuth, authenticationController.changePassword)

router.route('/forgotPassword')
    .post(authenticationController.forgotPassword)
router.route('/resetPassword')
    .post(authenticationController.resetPassword)
router.route('/loginSocial')
    .post(authenticationController.loginSocial)

module.exports = router

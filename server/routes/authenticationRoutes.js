const express = require('express')
const router = express.Router()
const authenticationController = require('../controllers/authenticationController')
const User = require('../models/User')
const { requireAuth } = require('../middleware/requireAuth')

router.route('/signup')
    .post(authenticationController.createNewUser)

router.get('/signup/verify', async (req, res) => {
    try {
        const { email, token } = req.query;

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
router.route('/endSession').post(authenticationController.endSession);

router.route('/login')
    .post(authenticationController.login)

router.route('/googlelogin')
    .post(authenticationController.googlelogin)

router.route('/delete')
    .delete(authenticationController.deleteUser)

router.route('/changePassword')
    .post(authenticationController.changePassword)

router.route('/forgotPassword')
    .post(authenticationController.forgotPassword)
router.route('/resetPassword')
    .post(authenticationController.resetPassword)
router.route('/loginSocial')
    .post(authenticationController.loginSocial)

module.exports = router
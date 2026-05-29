const express = require('express')
const router = express.Router()
const authenticationController = require('../controllers/authenticationController')
const User = require('../models/User')
const { requireAuth } = require('../middleware/requireAuth')

router.route('/signup')
    .post(authenticationController.createNewUser)

router.get('/signup/verify', async (req, res) => {
    try {
        const { email } = req.query;
        console.log(email)
          
        // Find the user by email
        const user = await User.findOne({ email });
          
        if (!user) {
        return res.status(404).json({ message: 'User not found' });
        }
          
            // Update user's verification status
        user.verified = true;
        await user.save();
    
        console.log("redirect")
          
            // Redirect the user to the interests page with user ID as a parameter
        res.redirect(`https://www.aonverse.com/auth/signup/interests`);
    
        console.log("did it redirect?")
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
const express = require('express')
const router = express.Router()
const usersController = require('../controllers/usersController')
const usersContextController = require('../controllers/usersContextController')
const mailerController = require('../controllers/mailerController')
const { requireAuth } = require('../middleware/requireAuth')

router.post('/convertWaitlist', usersContextController.getHandleWaitlistConversion)

router.route('/')
    .get(usersController.getAllUsers)
    .post(usersController.createNewUser)

router.get('/post/:id', usersContextController.getUserByIdPost)

router.route('/waitlist')
    .post(usersController.createNewMailer)

router.route('/bugreport')
    .post(mailerController.reportBug)

router.route('/career')
    .post(usersController.createCareerCandidate)

router.get('/:id', usersContextController.getUserById)

router.route('/search')
    .post(usersController.getUserByQuery)

router.route('/displayname')
    .patch(usersController.updateDisplayname)

router.route('/follow')
    .patch(usersController.updateFollowing)
router.route('/following/:id')
    .get(usersController.getFollowingUsers)

router.route('/unfollow')
    .patch(usersController.updateUnfollowing)
router.route('/support')
    .patch(usersController.updateSupporting)
router.route('/supporting/:id')
    .get(usersController.getSupportingUsers)

router.route('/unsupport')
    .patch(usersController.updateUnsupporting)

router.route('/qrcode')
    .patch(usersController.updateQrcode)

router.route('/bio')
    .patch(usersController.updateBio)

router.route('/postTut')
    .patch(usersController.updatePostTut)

router.route('/tutcomplete')
    .patch(usersController.tutcomplete)

router.route('/stars')
    .patch(usersController.updateStars)

router.route('/profpic')
    .patch(usersController.updateProfpic)

router.route('/background')
    .patch(usersController.updateBackgroundpic)

router.route('/join')
    .post(usersController.createNewMailer)

router.route('/bgColor')
    .patch(usersController.updateBgColor)

/*router.route('/aoncon2024/:id')
    .post(usersController.initAonCon2024)*/
router.route('/aoncon2024/update/:id')
    .post(usersController.updateEvents)
router.route('/aoncon2024/updateTutorial/:id')
    .post(usersController.updateEventTutorial)
    
router.patch('/:id', requireAuth, usersController.updateUser)
router.delete('/deleteAccount', requireAuth, usersController.deleteUser)

module.exports = router

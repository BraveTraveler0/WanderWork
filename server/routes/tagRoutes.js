const express = require('express')
const router = express.Router()
const usersController = require('../controllers/usersController')

router.route('/:tag')
    .get(usersController.getTagById)

router.route('/preferences/:id')
    .get(usersController.getUserTags)

router.route('/tagfollow')
    .patch(usersController.updateCreateTagFollowing)

router.route('/removetagfollow')
    .patch(usersController.removeTagsFromUser)

router.route('/removePreference/:id')
    .patch(usersController.removePreference)

module.exports = router
const express = require('express')
const router = express.Router()
const usersController = require('../controllers/usersController')
const usersContextController = require('../controllers/usersContextController')
const mailerController = require('../controllers/mailerController')
const { requireAuth } = require('../middleware/requireAuth')

router.get('/post/:id', usersContextController.getUserByIdPost)

router.route('/bugreport')
    .post(mailerController.reportBug)

router.route('/jointeam')
    .post(mailerController.joinTeam)

router.get('/:id', usersContextController.getUserById)

router.patch('/:id', requireAuth, usersController.updateUser)
router.delete('/deleteAccount', requireAuth, usersController.deleteUser)

module.exports = router

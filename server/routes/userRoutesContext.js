const express = require('express')
const router = express.Router()
const usersContextController = require('../controllers/usersContextController')

router.get('/:id', usersContextController.getUserById)
module.exports = router
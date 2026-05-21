const express = require('express')
const router = express.Router()
const notificationsController = require('../controllers/notificationsController')

router.route('/:id')
    .get(notificationsController.getNotificationById)

router.route('/updatenotifications')
    .patch(notificationsController.updateNotifications)

router.route('/createnotifications')
    .post(notificationsController.createNotification)

router.route('/deleteNotifications/:id')
    .delete(notificationsController.deleteNotifications)

module.exports = router
const express = require('express');
const eventsController = require('../controllers/eventController');

const router = express.Router();

// Event routes
router.route('/createEvent')
    .post(eventsController.createEvent);

router.get('/', eventsController.getAllEvents);

router.get('/:id', eventsController.getEventById);

// Mission-related routes
router.post('/:eventId/missions/complete', 
    eventsController.completeMission);

router.get('/:eventId/missions/progress', 
    eventsController.getUserMissionProgress);

// Code redemption
router.post('/:eventId/codes/redeem', 
    eventsController.redeemCode);

// User event statistics
router.get('/user/stats', 
    eventsController.getUserEventStats);

module.exports = router;
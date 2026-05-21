const express = require('express')
const router = express.Router()
const achievementsController = require('../controllers/achievementsController')

router.route('/')
    .get(achievementsController.getAllCrowns)

router.route('/:id')
    .get(achievementsController.getTrophyById)

router.route('/loginachiev')
    .patch(achievementsController.updateLoginAchiev)
router.route('/start')
    .patch(achievementsController.updateExpanseExplorerAchievement)

router.route('/loginachievcomplete')
    .patch(achievementsController.updateLightSeekerAchievement)

router.route('/rank/:timeScale')
    .get(achievementsController.getRankedPosts)

router.route('/rank/aoncon/:timeScale')
    .get(achievementsController.getAonconRankedPosts)

router.route('/displayCase')
    .patch(achievementsController.updateDisplayCase)

module.exports = router
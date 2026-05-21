const express = require('express')
const router = express.Router()
const votesControlor = require('../controllers/votesController')

router.route('/')
    .get(votesControlor.getAllVotes)
    .post(votesControlor.createVotes)
router.route('/:id')
    .delete(votesControlor.deleteVotes)
    .get(votesControlor.getVotesById)
    .post(votesControlor.getVotesById)

router.route('/voteStars')
    .patch(votesControlor.voteStars)

module.exports = router
const express = require('express')
const router = express.Router()
const voitingControlor = require('../controllers/voitingController')

router.route('/')
    .get(voitingControlor.getAllVoiting)
    

router.route('/create')
    .post(voitingControlor.createVoiting)
    
router.route('/:id')
    .get(voitingControlor.getVoitingbyId)
    .delete(voitingControlor.deleteVoiting)
    .patch(voitingControlor.updateRatings)

module.exports = router
const express = require('express');
const router = express.Router();
const xpController = require('../controllers/xpController');
const asyncHandler = require('express-async-handler');

router.route('/')
    .get(xpController.getAllLevels);

router.route('/:id')
    .get(asyncHandler(async (req, res)=>res.json(await xpController.getUserLevel(req.params.id))));

module.exports = router
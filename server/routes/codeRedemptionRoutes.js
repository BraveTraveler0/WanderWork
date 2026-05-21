const express = require('express');
const { getAllCodes,checkCode,activateCode } = require('../controllers/lookupCodesController');

const router = express.Router();

router.get('/check/:lookupCode', checkCode);
router.get('/redeem/:userId/:lookupCode', activateCode);
router.get('/', getAllCodes);

module.exports = router;
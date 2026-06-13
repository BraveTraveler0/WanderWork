const express = require('express');
const { getAllCodes, checkCode, activateCode } = require('../controllers/lookupCodesController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

// getAllCodes exposes all codes — admin only
router.get('/', requireAuth, (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
  next();
}, getAllCodes);

router.get('/check/:lookupCode', checkCode);
router.get('/redeem/:userId/:lookupCode', requireAuth, activateCode);

module.exports = router;
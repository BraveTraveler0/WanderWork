const express = require('express');
const { getAllSettings, getSetting, updateSetting } = require('../controllers/adminSettingsController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// GET all settings
router.get('/settings', requireAuth, requireAdmin, getAllSettings);

// GET a specific setting by key
router.get('/settings/:key', requireAuth, requireAdmin, getSetting);

// PUT (update) a specific setting by key
router.put('/settings/:key', requireAuth, requireAdmin, updateSetting);

module.exports = router;

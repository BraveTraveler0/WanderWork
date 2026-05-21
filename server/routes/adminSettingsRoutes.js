const express = require('express');
const { getAllSettings, getSetting, updateSetting } = require('../controllers/adminSettingsController');

const router = express.Router();

// GET all settings
router.get('/settings', getAllSettings);

// GET a specific setting by key
router.get('/settings/:key', getSetting);

// PUT (update) a specific setting by key
router.put('/settings/:key', updateSetting);

module.exports = router;
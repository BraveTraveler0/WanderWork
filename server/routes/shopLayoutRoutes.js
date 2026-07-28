const express = require('express');
const router = express.Router();
const {
    getShopLayout,
    saveShopLayout,
    deleteShopLayout,
    getPublicShopLayout,
    getListedShops
} = require('../controllers/shopLayoutController');
const { requireAuth } = require('../middleware/requireAuth');

// Public routes
router.get('/listed', getListedShops);
router.get('/public/:userId', getPublicShopLayout);
router.get('/:userId', getShopLayout);

// Private routes
router.post('/', requireAuth, saveShopLayout);
router.delete('/:userId', requireAuth, deleteShopLayout);

module.exports = router;
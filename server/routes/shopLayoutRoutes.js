const express = require('express');
const router = express.Router();
const {
    getShopLayout,
    saveShopLayout,
    deleteShopLayout,
    getPublicShopLayout,
    getListedShops
} = require('../controllers/shopLayoutController');

// Public routes
router.get('/listed', getListedShops);
router.get('/public/:userId', getPublicShopLayout);
router.get('/:userId', getShopLayout);

// Private routes (would need auth middleware in production)
router.post('/', saveShopLayout);
router.delete('/:userId', deleteShopLayout);

module.exports = router;
const express = require('express');
const router = express.Router();
const {
    getUserInventory,
    getInventoryItem,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    bulkUpdateQuantities,
    getMarketplaceInventory
} = require('../controllers/inventoryController');
const { requireAuth } = require('../middleware/requireAuth');

// Marketplace browsing is intentionally public; everything else is account data.
router.route('/marketplace')
    .get(getMarketplaceInventory);

router.use(requireAuth);

router.route('/:userId')
    .get(getUserInventory);

router.route('/item/:id')
    .get(getInventoryItem);

router.route('/')
    .post(createInventoryItem);

router.route('/:id')
    .patch(updateInventoryItem)
    .delete(deleteInventoryItem);

router.route('/bulk-update')
    .patch(bulkUpdateQuantities);

module.exports = router;
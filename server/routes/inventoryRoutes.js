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

// Routes
router.route('/marketplace')
    .get(getMarketplaceInventory);

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
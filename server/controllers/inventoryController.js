const Inventory = require('../models/inventory');
const asyncHandler = require('express-async-handler');

// @desc Get all inventory items for a user
// @route GET /inventory/:userId
// @access Private
const getUserInventory = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    const inventoryItems = await Inventory.find({ userId }).lean();

    res.json(inventoryItems);
});

// @desc Get single inventory item
// @route GET /inventory/item/:id
// @access Private
const getInventoryItem = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Inventory item ID is required' });
    }

    const inventoryItem = await Inventory.findById(id).lean();

    if (!inventoryItem) {
        return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json(inventoryItem);
});

// @desc Create new inventory item
// @route POST /inventory
// @access Private
const createInventoryItem = asyncHandler(async (req, res) => {
    const { userId, title, description, image, price, quantity, committed, sizes, listed, currency } = req.body;

    // Validate required fields
    if (!userId || !title || !description || !price || quantity === undefined) {
        return res.status(400).json({ 
            message: 'User ID, title, description, price, and quantity are required' 
        });
    }

    // Create the inventory item
    const inventoryItem = await Inventory.create({
        userId,
        title,
        description,
        image,
        price,
        currency: currency || 'USD',
        quantity,
        committed: committed || 0,
        sizes: sizes || [],
        listed: listed !== undefined ? listed : true
    });

    if (inventoryItem) {
        res.status(201).json({
            message: 'Inventory item created successfully',
            inventoryItem
        });
    } else {
        res.status(400).json({ message: 'Failed to create inventory item' });
    }
});

// @desc Update inventory item
// @route PATCH /inventory/:id
// @access Private
const updateInventoryItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, image, price, quantity, committed, sizes, listed, currency } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Inventory item ID is required' });
    }

    // Find the inventory item
    const inventoryItem = await Inventory.findById(id);

    if (!inventoryItem) {
        return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Update fields that are provided
    if (title !== undefined) inventoryItem.title = title;
    if (description !== undefined) inventoryItem.description = description;
    if (image !== undefined) inventoryItem.image = image;
    if (price !== undefined) inventoryItem.price = price;
    if (currency !== undefined) inventoryItem.currency = currency;
    if (quantity !== undefined) inventoryItem.quantity = quantity;
    if (committed !== undefined) inventoryItem.committed = committed;
    if (sizes !== undefined) inventoryItem.sizes = sizes;
    if (listed !== undefined) inventoryItem.listed = listed;

    const updatedItem = await inventoryItem.save();

    res.json({
        message: 'Inventory item updated successfully',
        inventoryItem: updatedItem
    });
});

// @desc Delete inventory item
// @route DELETE /inventory/:id
// @access Private
const deleteInventoryItem = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Inventory item ID is required' });
    }

    const inventoryItem = await Inventory.findById(id);

    if (!inventoryItem) {
        return res.status(404).json({ message: 'Inventory item not found' });
    }

    await inventoryItem.deleteOne();

    res.json({ 
        message: 'Inventory item deleted successfully',
        id: inventoryItem._id 
    });
});

// @desc Bulk update inventory quantities
// @route PATCH /inventory/bulk-update
// @access Private
const bulkUpdateQuantities = asyncHandler(async (req, res) => {
    const { updates } = req.body; // Array of { id, quantity, committed }

    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ message: 'Updates array is required' });
    }

    const results = [];
    
    for (const update of updates) {
        const { id, quantity, committed } = update;
        
        if (!id) continue;
        
        const inventoryItem = await Inventory.findById(id);
        if (!inventoryItem) continue;
        
        if (quantity !== undefined) inventoryItem.quantity = quantity;
        if (committed !== undefined) inventoryItem.committed = committed;
        
        await inventoryItem.save();
        results.push(inventoryItem);
    }

    res.json({
        message: 'Bulk update completed',
        updated: results.length,
        items: results
    });
});

// @desc Get all inventory items for marketplace (all users)
// @route GET /inventory/marketplace
// @access Public
const getMarketplaceInventory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const inventoryItems = await Inventory.find({ 
        quantity: { $gt: 0 }, 
        $or: [{ listed: true }, { listed: { $exists: false } }] 
    })
        .populate('userId', 'displayName slug')
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean();

    const total = await Inventory.countDocuments({ 
        quantity: { $gt: 0 }, 
        $or: [{ listed: true }, { listed: { $exists: false } }] 
    });

    res.json({
        items: inventoryItems,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

module.exports = {
    getUserInventory,
    getInventoryItem,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    bulkUpdateQuantities,
    getMarketplaceInventory
};
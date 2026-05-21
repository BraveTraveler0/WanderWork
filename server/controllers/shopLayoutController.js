const ShopLayout = require('../models/shopLayout');
const asyncHandler = require('express-async-handler');

// @desc Get shop layout for a user
// @route GET /shop-layout/:userId
// @access Public
const getShopLayout = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    const shopLayout = await ShopLayout.findOne({ userId }).lean();

    if (!shopLayout) {
        // Return empty layout if none exists
        return res.json({
            userId,
            elements: [],
            lastUpdated: new Date()
        });
    }

    res.json(shopLayout);
});

// @desc Save/Update shop layout for a user
// @route POST /shop-layout
// @access Private
const saveShopLayout = asyncHandler(async (req, res) => {
    const { userId, elements, isListed, shopTitle, shopDescription, bannerData } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    if (!Array.isArray(elements)) {
        return res.status(400).json({ message: 'Elements must be an array' });
    }

    // Validate elements structure
    for (const element of elements) {
        if (!element.id || !element.type || element.order === undefined) {
            return res.status(400).json({ 
                message: 'Each element must have id, type, and order' 
            });
        }
    }

    try {
        let shopLayout = await ShopLayout.findOne({ userId });

        if (shopLayout) {
            // Update existing layout
            shopLayout.elements = elements;
            shopLayout.isListed = isListed !== undefined ? isListed : shopLayout.isListed;
            shopLayout.shopTitle = shopTitle !== undefined ? shopTitle : shopLayout.shopTitle;
            shopLayout.shopDescription = shopDescription !== undefined ? shopDescription : shopLayout.shopDescription;
            shopLayout.bannerData = bannerData !== undefined ? bannerData : shopLayout.bannerData;
            shopLayout.lastUpdated = new Date();
        } else {
            // Create new layout
            shopLayout = new ShopLayout({
                userId,
                elements,
                isListed: isListed || false,
                shopTitle: shopTitle || '',
                shopDescription: shopDescription || '',
                bannerData: bannerData || {},
                lastUpdated: new Date()
            });
        }

        const savedLayout = await shopLayout.save();

        res.json({
            message: 'Shop layout saved successfully',
            layout: savedLayout
        });
    } catch (error) {
        console.error('Error saving shop layout:', error);
        res.status(500).json({ message: 'Failed to save shop layout' });
    }
});

// @desc Delete shop layout for a user
// @route DELETE /shop-layout/:userId
// @access Private
const deleteShopLayout = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    const shopLayout = await ShopLayout.findOne({ userId });

    if (!shopLayout) {
        return res.status(404).json({ message: 'Shop layout not found' });
    }

    await shopLayout.deleteOne();

    res.json({ 
        message: 'Shop layout deleted successfully',
        userId 
    });
});

// @desc Get public shop layout for a vendor (for buyers to view)
// @route GET /shop-layout/public/:userId
// @access Public
const getPublicShopLayout = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    // Only return shops that are explicitly listed
    const shopLayout = await ShopLayout.findOne({ 
        userId: userId,
        isListed: true 
    }).populate('userId', 'displayName slug profimage').lean();

    if (!shopLayout) {
        // Return 404 if shop not found or not listed
        return res.status(404).json({ 
            message: 'Shop not found or not publicly listed' 
        });
    }

    res.json(shopLayout);
});

// @desc Get all listed shops for marketplace
// @route GET /shop-layout/listed
// @access Public
const getListedShops = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    
    try {
        // Get only shops where isListed is explicitly true
        const shops = await ShopLayout.find({ 
            isListed: true,
            shopTitle: { $exists: true, $ne: '' } // Only include shops with titles
        })
        .populate('userId', 'displayName slug profimage')
        .sort({ lastUpdated: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

        const totalShops = await ShopLayout.countDocuments({ isListed: true });

        res.json({
            shops,
            totalPages: Math.ceil(totalShops / limit),
            currentPage: page,
            totalShops
        });
    } catch (error) {
        console.error('Error fetching listed shops:', error);
        res.status(500).json({ message: 'Failed to fetch listed shops' });
    }
});

module.exports = {
    getShopLayout,
    saveShopLayout,
    deleteShopLayout,
    getPublicShopLayout,
    getListedShops
};
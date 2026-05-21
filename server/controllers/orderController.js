const Order = require('../models/order');
const Inventory = require('../models/inventory');
const asyncHandler = require('express-async-handler');

// @desc Create new order
// @route POST /orders
// @access Private
const createOrder = asyncHandler(async (req, res) => {
    const { 
        buyerId, 
        sellerId, 
        items, 
        total, 
        currency, 
        shippingAddress, 
        paymentMethod 
    } = req.body;

    // Validate required fields
    if (!buyerId || !sellerId || !items || !items.length || !total || !shippingAddress) {
        return res.status(400).json({ 
            message: 'Buyer ID, seller ID, items, total, and shipping address are required' 
        });
    }

    // Validate inventory availability and update quantities
    const inventoryUpdates = [];
    for (const item of items) {
        const inventoryItem = await Inventory.findById(item.productId);
        
        if (!inventoryItem) {
            return res.status(404).json({ 
                message: `Product ${item.title} not found` 
            });
        }

        // Check if item has size, handle size-specific inventory
        if (item.size) {
            const sizeData = inventoryItem.sizes.find(s => s.size === item.size);
            if (!sizeData) {
                return res.status(404).json({ 
                    message: `Size ${item.size} not found for product ${item.title}` 
                });
            }
            
            if (sizeData.available < item.quantity) {
                return res.status(400).json({ 
                    message: `Insufficient quantity for ${item.title} in size ${item.size}. Available: ${sizeData.available}, Requested: ${item.quantity}` 
                });
            }

            inventoryUpdates.push({
                productId: item.productId,
                size: item.size,
                quantityToDeduct: item.quantity,
                hasSizes: true
            });
        } else {
            // Handle products without sizes (legacy support)
            if (inventoryItem.quantity < item.quantity) {
                return res.status(400).json({ 
                    message: `Insufficient quantity for ${item.title}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}` 
                });
            }

            inventoryUpdates.push({
                productId: item.productId,
                quantityToDeduct: item.quantity,
                hasSizes: false
            });
        }
    }

    // Create the order
    const order = await Order.create({
        buyerId,
        sellerId,
        items,
        total,
        currency: currency || 'USD',
        shippingAddress,
        paymentMethod: paymentMethod || 'card',
        status: 'pending'
    });

    // Update inventory quantities (deduct ordered items)
    for (const update of inventoryUpdates) {
        if (update.hasSizes) {
            // Update size-specific inventory
            await Inventory.findOneAndUpdate(
                { 
                    _id: update.productId,
                    "sizes.size": update.size 
                },
                { 
                    $inc: { 
                        "sizes.$.quantity": -update.quantityToDeduct,
                        "sizes.$.available": -update.quantityToDeduct
                    }
                }
            );
        } else {
            // Update product-level inventory (legacy support)
            await Inventory.findByIdAndUpdate(
                update.productId,
                { 
                    $inc: { 
                        quantity: -update.quantityToDeduct,
                        committed: update.quantityToDeduct 
                    }
                }
            );
        }
    }

    // Populate user details
    await order.populate([
        { path: 'buyerDetails', select: 'displayName email' },
        { path: 'sellerDetails', select: 'displayName email' }
    ]);

    res.status(201).json({
        message: 'Order created successfully',
        order
    });
});

// @desc Get buyer's orders
// @route GET /orders/buyer/:buyerId
// @access Private
const getBuyerOrders = asyncHandler(async (req, res) => {
    const { buyerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!buyerId) {
        return res.status(400).json({ message: 'Buyer ID is required' });
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find({ buyerId })
        .populate([
            { path: 'buyerDetails', select: 'displayName email' },
            { path: 'sellerDetails', select: 'displayName email' }
        ])
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean();

    const total = await Order.countDocuments({ buyerId });

    res.json({
        orders,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc Get seller's orders
// @route GET /orders/seller/:sellerId
// @access Private
const getSellerOrders = asyncHandler(async (req, res) => {
    const { sellerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!sellerId) {
        return res.status(400).json({ message: 'Seller ID is required' });
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find({ sellerId })
        .populate([
            { path: 'buyerDetails', select: 'displayName email' },
            { path: 'sellerDetails', select: 'displayName email' }
        ])
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean();

    const total = await Order.countDocuments({ sellerId });

    res.json({
        orders,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc Get single order
// @route GET /orders/:orderId
// @access Private
const getOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId)
        .populate([
            { path: 'buyerDetails', select: 'displayName email' },
            { path: 'sellerDetails', select: 'displayName email' }
        ])
        .lean();

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
});

// @desc Update order status
// @route PATCH /orders/:orderId/status
// @access Private
const updateOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { status, trackingNumber, notes } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required' });
    }

    if (!status) {
        return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['pending', 'packaging', 'shipping', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData = { status };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (notes) updateData.notes = notes;

    const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
    ).populate([
        { path: 'buyerDetails', select: 'displayName email' },
        { path: 'sellerDetails', select: 'displayName email' }
    ]);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
        message: 'Order status updated successfully',
        order
    });
});

// @desc Add message to order
// @route POST /orders/:orderId/messages
// @access Private
const addOrderMessage = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { senderId, senderName, message } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required' });
    }

    if (!senderId || !senderName || !message) {
        return res.status(400).json({ message: 'Sender ID, sender name, and message are required' });
    }

    const order = await Order.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    // Verify sender is either buyer or seller
    if (senderId !== order.buyerId.toString() && senderId !== order.sellerId.toString()) {
        return res.status(403).json({ message: 'Not authorized to message on this order' });
    }

    const newMessage = {
        senderId,
        senderName,
        message,
        timestamp: new Date()
    };

    order.messages.push(newMessage);
    await order.save();

    // Populate user details
    await order.populate([
        { path: 'buyerDetails', select: 'displayName email' },
        { path: 'sellerDetails', select: 'displayName email' }
    ]);

    res.json({
        message: 'Message added successfully',
        order: order.toObject()
    });
});

// @desc Cancel order
// @route PATCH /orders/:orderId/cancel
// @access Private
const cancelOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { userId, reason } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    // Verify user is either buyer or seller
    if (userId !== order.buyerId.toString() && userId !== order.sellerId.toString()) {
        return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    // Only allow cancellation if order hasn't shipped
    if (['shipping', 'delivered'].includes(order.status)) {
        return res.status(400).json({ message: 'Cannot cancel order that has already shipped' });
    }

    // Update order status
    order.status = 'cancelled';
    if (reason) {
        order.notes = reason;
    }
    await order.save();

    // Restore inventory quantities
    for (const item of order.items) {
        if (item.size) {
            // Restore size-specific inventory
            await Inventory.findOneAndUpdate(
                { 
                    _id: item.productId,
                    "sizes.size": item.size 
                },
                { 
                    $inc: { 
                        "sizes.$.quantity": item.quantity,
                        "sizes.$.available": item.quantity
                    }
                }
            );
        } else {
            // Restore product-level inventory (legacy support)
            await Inventory.findByIdAndUpdate(
                item.productId,
                { 
                    $inc: { 
                        quantity: item.quantity,
                        committed: -item.quantity 
                    }
                }
            );
        }
    }

    // Populate user details
    await order.populate([
        { path: 'buyerDetails', select: 'displayName email' },
        { path: 'sellerDetails', select: 'displayName email' }
    ]);

    res.json({
        message: 'Order cancelled successfully',
        order
    });
});

module.exports = {
    createOrder,
    getBuyerOrders,
    getSellerOrders,
    getOrder,
    updateOrderStatus,
    addOrderMessage,
    cancelOrder
};
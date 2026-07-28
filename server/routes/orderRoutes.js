const express = require('express');
const router = express.Router();
const {
    createOrder,
    getBuyerOrders,
    getSellerOrders,
    getOrder,
    updateOrderStatus,
    addOrderMessage,
    cancelOrder
} = require('../controllers/orderController');
const { requireAuth } = require('../middleware/requireAuth');

router.use(requireAuth);

// @route POST /orders
// @desc Create new order
// @access Private
router.post('/', createOrder);

// @route GET /orders/buyer/:buyerId
// @desc Get buyer's orders
// @access Private
router.get('/buyer/:buyerId', getBuyerOrders);

// @route GET /orders/seller/:sellerId
// @desc Get seller's orders
// @access Private
router.get('/seller/:sellerId', getSellerOrders);

// @route GET /orders/:orderId
// @desc Get single order
// @access Private
router.get('/:orderId', getOrder);

// @route PATCH /orders/:orderId/status
// @desc Update order status
// @access Private
router.patch('/:orderId/status', updateOrderStatus);

// @route POST /orders/:orderId/messages
// @desc Add message to order
// @access Private
router.post('/:orderId/messages', addOrderMessage);

// @route PATCH /orders/:orderId/cancel
// @desc Cancel order
// @access Private
router.patch('/:orderId/cancel', cancelOrder);

module.exports = router;
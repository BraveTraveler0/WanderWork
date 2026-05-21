const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    size: {
        type: String
    }
}, { _id: false });

const orderMessageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const shippingAddressSchema = new mongoose.Schema({
    street: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    zipCode: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        required: true,
        trim: true,
        default: 'US'
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [orderItemSchema],
    status: {
        type: String,
        enum: ['pending', 'packaging', 'shipping', 'delivered', 'cancelled'],
        default: 'pending'
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: ['USD', 'AON'],
        default: 'USD'
    },
    shippingAddress: shippingAddressSchema,
    messages: [orderMessageSchema],
    paymentMethod: {
        type: String,
        enum: ['card', 'paypal', 'crypto', 'stars'],
        default: 'card'
    },
    trackingNumber: {
        type: String
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'items.productId': 1 });

// Virtual to populate buyer details
orderSchema.virtual('buyerDetails', {
    ref: 'User',
    localField: 'buyerId',
    foreignField: '_id',
    justOne: true,
    select: 'displayName email'
});

// Virtual to populate seller details
orderSchema.virtual('sellerDetails', {
    ref: 'User',
    localField: 'sellerId',
    foreignField: '_id',
    justOne: true,
    select: 'displayName email'
});

// Ensure virtual fields are serialized
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', orderSchema);
const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: ['USD', 'AON'],
        default: 'USD'
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    committed: {
        type: Number,
        default: 0,
        min: 0
    },
    available: {
        type: Number,
        min: 0
    },
    sizes: [sizeSchema],
    listed: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Calculate available quantity automatically
inventorySchema.pre('save', function() {
    if (this.available === undefined) {
        this.available = this.quantity - this.committed;
    }
});

// Virtual for available quantity calculation
inventorySchema.virtual('calculatedAvailable').get(function() {
    return this.quantity - this.committed;
});

// Index for efficient user-based queries
inventorySchema.index({ userId: 1 });
inventorySchema.index({ userId: 1, title: 1 });

// Index for efficient marketplace queries (listed items with quantity > 0)
inventorySchema.index({ listed: 1, quantity: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
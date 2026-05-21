const mongoose = require('mongoose');

const elementSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['imageGrid', 'heading', 'carousel', 'media', 'cta', 'productShowcase', 'productGrid', 'customButton']
    },
    order: {
        type: Number,
        required: true,
        min: 0
    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const shopLayoutSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    elements: [elementSchema],
    isListed: {
        type: Boolean,
        default: false
    },
    shopTitle: {
        type: String,
        default: ''
    },
    shopDescription: {
        type: String,
        default: ''
    },
    bannerData: {
        backgroundImage: {
            type: String,
            default: ''
        },
        shopName: {
            type: String,
            default: ''
        },
        avatarImage: {
            type: String,
            default: ''
        },
        textColor: {
            type: String,
            default: '#FFFFFF'
        },
        fontSize: {
            type: Number,
            default: 36
        },
        overlayOpacity: {
            type: Number,
            default: 0.3
        }
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update lastUpdated on save
shopLayoutSchema.pre('save', function() {
    this.lastUpdated = new Date();
});

// Index for efficient user-based queries
shopLayoutSchema.index({ userId: 1 });
// Index for listed shops
shopLayoutSchema.index({ isListed: 1 });

module.exports = mongoose.model('ShopLayout', shopLayoutSchema);
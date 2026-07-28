const mongoose = require('mongoose')
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        default: "EXPLORER"
    },
    password: {
        type: String,
        required: true
    },
    event: {
        type: String
    },
    profimage: {
        type: String
    },
    backimage: {
        type: String
    },
    lastlogin: {
        type: Date,
        default: Date.now
    },
    consecutivelogins: {
        type: Number,
        default: 0
    },
    totalTimeOnline: {
        type: Number,
        default: 0
    },
    active: {
        type: Boolean,
        default: true
    },
    verified: {
        type: Boolean
    },
    verificationToken: {
        type: String,
        default: null
    },
    token: {
        type: String
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    loginLockUntil: {
        type: Date,
        default: null
    },
    loginLockLevel: {
        type: Number,
        default: 0
    },
    lastFailedLoginAt: {
        type: Date,
        default: null
    },
    stripeId: {
        type: String,
        default: null
    },
    plan: {
        type: String,
        enum: ['starter', 'pro', 'premium'],
        default: 'starter'
    },
    stripeSubscriptionId: {
        type: String,
        default: null
    },
    planExpiresAt: {
        type: Date,
        default: null
    },
    extensionKey: {
        type: String,
        default: null
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    notifications: {
        jobAlerts: {
            type: Boolean,
            default: true
        },
        weeklyDigest: {
            type: Boolean,
            default: true
        }
    },
    paymentProvider: {
        type: String,
        enum: ['stripe', 'paypal'],
        default: 'stripe'
    },
})

// Define the comparePassword method
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
      // Use bcrypt to compare the provided password (plaintext) with the hashed password (stored in the database)
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      throw error;
    }
  };

module.exports = mongoose.model('User', userSchema)

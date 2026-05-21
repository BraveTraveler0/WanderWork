const mongoose = require('mongoose')

const walletMethodSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        userId: {
            type: String,
            required: true

        },
        methodName: {
            type: String,
            required: true
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true
        }
    }
)

module.exports = mongoose.model('WalletMethod', walletMethodSchema)
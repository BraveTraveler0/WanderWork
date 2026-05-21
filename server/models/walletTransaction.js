const mongoose = require('mongoose')

const walletTransactionSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        methodId: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            require: true
        },
        type: {
            type: String,
            require: true
        }
    }
)

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema)
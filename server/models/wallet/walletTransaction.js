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
        method: {
            type: String,
            required: true,
        },
        currency: {
            type: String,
            required: true,
        },
        date: {
            type: String,
            require: true
        },
        type: {
            type: String,
            require: true
        },
        coPartyId: {
            type: String,
            required: false,
        },
        coPartyName: {
            type: String,
            required: true,
        },
    }
)

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema)
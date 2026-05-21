const mongoose = require('mongoose');
const Wallet = require('./wallet.js');

const electronicPaymentSchema = new mongoose.Schema(
    {
        service: {
            type: String,
            required: true,
        },
        balance: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
        }
    }
);

module.exports = Wallet.discriminator('electronicPayment', electronicPaymentSchema);
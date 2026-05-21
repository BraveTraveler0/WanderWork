const mongoose = require('mongoose');
const Wallet = require('./wallet.js');

const creditCardSchema = new mongoose.Schema(
    {
        network: {
            type: String,
            required: true,
        },
        cardNumber: {
            type: Number,
            required: true,
        },
        expMonth: {
            type: Number,
            required: true,
        },
        expYear: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
        }
    }
);

module.exports = Wallet.discriminator('creditCard', creditCardSchema);
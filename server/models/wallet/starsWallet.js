const mongoose = require('mongoose');
const Wallet = require('./wallet.js');

const starsSchema = new mongoose.Schema(
    {
        balance: {
            type: Number,
            required: true,
        },
    }
);

module.exports = Wallet.discriminator('stars', starsSchema);
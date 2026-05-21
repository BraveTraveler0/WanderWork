const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
        },
    }
);

module.exports = mongoose.model('Wallet', walletSchema);
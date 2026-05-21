const mongoose = require('mongoose');
const { use } = require('passport');

const userCodeRedemptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
  },
  codes: [
    {
      code: {
        type: String,
        required: true,
        trim: true,
      },
      active: {
        type: Boolean,
        default: false,
      },
    },
  ],
});

const userCodeRedemption = mongoose.model('userCodeRedemption', userCodeRedemptionSchema);

module.exports = userCodeRedemption;
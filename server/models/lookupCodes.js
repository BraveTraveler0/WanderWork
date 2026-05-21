const mongoose = require('mongoose');

const LookupCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
  },
  enabled: {
    type: Boolean,
    default: false,
  },
});

const LookupCode = mongoose.model('LookupCode', LookupCodeSchema);

module.exports = LookupCode;
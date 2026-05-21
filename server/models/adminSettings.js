const mongoose = require('mongoose');

const AdminSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
});

const AdminSetting = mongoose.model('AdminSetting', AdminSettingSchema);

module.exports = AdminSetting;
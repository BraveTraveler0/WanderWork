const AdminSettings = require('../models/adminSettings');

// Fetch all settings
const getAllSettings = async (req, res) => {
  try {
    const settings = await AdminSettings.find({});
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// Fetch a specific setting by key
const getSetting = async (req, res) => {
  const { key } = req.params;

  try {
    const setting = await AdminSettings.findOne({ key });
    if (!setting) {
      res.status(404).json({ message: `Setting with key '${key}' not found` });
      return;
    }
    res.status(200).json(setting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
};

// Update a specific setting by key
const updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  try {
    const updatedSetting = await AdminSettings.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true } // Create the setting if it doesn't exist
    );
    res.status(200).json(updatedSetting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

module.exports = {
  getAllSettings,
  getSetting,
  updateSetting,
};
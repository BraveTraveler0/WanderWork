const LookupCodes = require('../models/lookupCodes');
const User = require('../models/User')
const UserCodeRedemption = require('../models/userCodeRedemption');


// Fetch all codes
const getAllCodes = async (req, res) => {
  try {
    const codes = await LookupCodes.find({});
    res.status(200).json(codes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// Fetch a specific setting by code
const checkCode = async (req, res) => {
  const { lookupCode } = req.params;

  console.log(lookupCode)

  try {
    const code = await LookupCodes.findOne({ code: lookupCode });
    if (!code) {
      res.status(200).json({ message: `Code with key '${lookupCode}' not found`, enabled: false });
      return;
    }else if(code.enabled == true){
      res.status(200).json(code);
    }else{
      res.status(200).json({ message: `Code with '${lookupCode}' not enabled`, enabled: false });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch code' });
  }
};

const activateCode = async (req, res) => {
  let { userId, lookupCode } = req.params;
  lookupCode = lookupCode.replace(/\s+/g, '');

  try {

    const existingCode = await UserCodeRedemption.findOne({ userId, 'codes.code': lookupCode });

    if (existingCode && existingCode.codes.some(code => code.code === lookupCode && code.active)) {
      res.status(200).json({ message: 'Code is already active for this user', redeemed : true });
      return;
    }

    const existingUserCodeRedemption = await UserCodeRedemption.findOne({ userId });

    if (existingUserCodeRedemption) {
      existingUserCodeRedemption.codes.push({
      code: lookupCode,
      active: true,
      });
      await existingUserCodeRedemption.save();
      res.status(200).json(existingUserCodeRedemption);
    } else {
      const newUserCodeRedemption = new UserCodeRedemption({
      userId,
      codes: [{
        code: lookupCode,
        active: true,
      }],
      });
      await newUserCodeRedemption.save();
      res.status(200).json(newUserCodeRedemption);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch code' });
  }
};

module.exports = {
  getAllCodes,
  checkCode,
  activateCode
};
const User = require('../models/User')
const asyncHandler = require('express-async-handler');

const getAllLevels = asyncHandler(async (req, res) => {
    try {
        const users = await User.find();

        if (!votes?.length) {
            return res.status(400).json({ message: 'No users found' });
        }

        const levels = users.map((user)=> { return {id: user.id, level: user.level, xp: user.xp}});

        res.json(levels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching voiting' });
    }
});

const getUserLevel = async (id, res) => {
    try {
        const user = await User.findOne({ _id: id });

        if (!user) {
            return res.status(400).json({ message: 'User Not Found' });
        }

        return { level: user.level, xp: user.xp };
    } catch (error) {
        console.error(error);
    }
};

const updateUserLevel = async (xp, userId, achievement) => {
    const user = await User.findById(userId);

    if (!user) {
        return;
    }

    if (!user.xp) {
        user.xp = xp; // Note, this allows negative XP, which is important for keeping levels consistent while avoiding xp exploits
    } else {
        user.xp += xp;
    }

    user.level = Math.floor(Math.max(user.level, Math.floor(user.xp / 1000) + 1)); // Levels never go down
    // console.log("Attempting to update user xp: ", user.xp);
    const newUser = await user.save();
};

module.exports = {
    getAllLevels,
    getUserLevel,
    updateUserLevel,
}
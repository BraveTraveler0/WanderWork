const User = require('../models/User')
const asyncHandler = require('express-async-handler');

const getAllLevels = asyncHandler(async (req, res) => {
    try {
        const users = await User.find();

        if (!users?.length) {
            return res.status(400).json({ message: 'No users found' });
        }

        const levels = users.map((user)=> { return {id: user.id, level: user.level, xp: user.xp}});

        res.json(levels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching voiting' });
    }
});

const getUserLevel = async (id) => {
    try {
        const user = await User.findOne({ _id: id });

        if (!user) {
            return null;
        }

        return { level: user.level, xp: user.xp };
    } catch (error) {
        console.error(error);
        return null;
    }
};

// Fire-and-forget from postsController.js (like/star/post actions) with no await/catch
// at the call site, so this must never reject — an uncaught rejection here crashes the
// whole process (verified: Node's default unhandled-rejection behavior is to exit).
const updateUserLevel = async (xp, userId, achievement) => {
    try {
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
        await user.save();
    } catch (error) {
        console.error('[xp] updateUserLevel failed (non-fatal):', error);
    }
};

module.exports = {
    getAllLevels,
    getUserLevel,
    updateUserLevel,
}
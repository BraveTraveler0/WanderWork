const User = require('../models/User');
const asyncHandler = require('express-async-handler');

const getUserById = asyncHandler(async (req, res) => {
    const identifier = req.params.id; // Change identifier to id

    try {
        let user;

        // Check if the identifier is a valid ObjectId (assumes MongoDB ObjectId)
        if (/^[a-fA-F0-9]{24}$/.test(identifier)) {
            user = await User.findById(identifier).select('-password').lean();
        } else {
            // If it's not a valid ObjectId, try finding by slug
            user = await User.findOne({ slug: identifier }).select('-password').lean();
        }

        // If no user found
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

const getUserByIdPost = asyncHandler(async (req, res) => {
    try {
        const user = await User.findOne({ slug: req.params.id }).select('-password').lean();

        // If no user found
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = {
    getUserById,
    getUserByIdPost,
};

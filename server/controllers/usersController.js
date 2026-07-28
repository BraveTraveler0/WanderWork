const User = require('../models/User')
const asyncHandler = require('express-async-handler')

// @desc Update a user
// @route PATCH /users/:id
// @access Private
const updateUser = asyncHandler(async (req, res) => {
    const id = req.params.id || req.body?.id;
    const authId = req.user?._id || req.user?.id;
    const isAdmin = req.user?.isAdmin === true;

    if (!id) {
        return res.status(400).json({ message: 'User ID is required' })
    }
    if (!isAdmin && String(id) !== String(authId)) {
        return res.status(403).json({ message: 'Forbidden' })
    }

    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(404).json({ message: 'User not found' })
    }

    if (req.body?.email && String(req.body.email).toLowerCase() !== String(user.email || '').toLowerCase()) {
        return res.status(403).json({ message: 'Email changes are not allowed here' })
    }

    const allowedFields = [
        'displayName',
        'notifications',
        'paymentProvider',
    ];

    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
            user[field] = req.body[field];
        }
    }

    const updatedUser = await user.save()

    const sanitized = updatedUser.toObject();
    delete sanitized.password;
    res.json(sanitized)
})

// @desc Delete a user
// @route DELETE /users/deleteAccount
// @access Private
const deleteUser = asyncHandler(async (req, res) => {
    const { email, id, password } = req.body || {};

    if (req.user?.email) {
        const authEmail = String(req.user.email).trim().toLowerCase();
        const authId = req.user._id || req.user.id;
        const deletedUser = await User.findOneAndDelete({
            $or: [
                ...(authId ? [{ _id: authId }] : []),
                { email: authEmail },
            ],
        });

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        try {
            const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');
            await Candidates.deleteMany({ email: authEmail });
        } catch (error) {
            console.warn('Deleted user but failed to delete candidate profile:', error.message);
        }

        return res.json({ success: true, message: 'User deleted successfully' });
    }

    // Confirm data
    if (!id || !email || !password) {
        return res.status(400).json({ message: 'User ID, email, and password are required' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        // If user not found
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if password matches
        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        // Check if the id passed in matches the id of the user found
        if (user._id.toString() !== id) {
            return res.status(400).json({ message: 'Invalid user ID, please contact support' });
        }

        // Delete the user
        const deletedUser = await User.findOneAndDelete({ _id: id });

        if (!deletedUser) {
            return res.status(500).json({ message: 'Error deleting user' });
        }

        const reply = `Username ${deletedUser.displayName} with ID ${deletedUser._id} deleted`;
        res.json(reply);
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ message: 'Server Error', error });
    }
});

module.exports = {
    updateUser,
    deleteUser,
}

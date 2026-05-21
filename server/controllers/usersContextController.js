const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const sgMail = require('@sendgrid/mail');


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const generateTempPassword = async () => {
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);
    return { tempPassword, hashedTempPassword };
};

const sendTempPasswordEmail = async (email, tempPassword) => {
    const msg = {
        to: email,
        from: 'support@aontechnology.io',
        subject: 'Your Temporary Password',
        text: `Your temporary password is: ${tempPassword}. Please log in using this password and update your password immediately after logging in.`,
    };

    try {
        await sgMail.send(msg);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const updateUserWithTempPassword = async (userId, hashedTempPassword) => {
    await User.findByIdAndUpdate(userId, { tempPassword: hashedTempPassword });
};

const getHandleWaitlistConversion = async (req, res) => {
    const { userId } = req.body;

    try {
        const { tempPassword, hashedTempPassword } = await generateTempPassword();

        const user = await User.findById(userId);
        const userEmail = user.email;

        await sendTempPasswordEmail(userEmail, tempPassword);

        await updateUserWithTempPassword(userId, hashedTempPassword);

        res.status(200).json({ message: 'Temporary password sent successfully' });
    } catch (error) {
        console.error('Error converting waitlist user:', error);
        res.status(500).json({ message: 'Error converting waitlist user' });
    }
};

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
    console.log(req.params.id); // Access the id using req.params.id

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
    getHandleWaitlistConversion
};
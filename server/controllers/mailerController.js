const asyncHandler = require('express-async-handler')
const Mailer = require('../models/joinlist')
const sgMail = require('@sendgrid/mail')


const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(SENDGRID_API_KEY);

const reportBug = asyncHandler(async (req, res) => {
    const { email, bug, id } = req.body;

    if (!bug) {
        return res.status(400).json({ message: 'bug is required' });
    }

    try {
        // If email is provided, send only the bug report
        if (email) {
            const emailMessage = {
                to: 'support@aontechnology.io',
                from: 'support@aontechnology.io',
                subject: "Bug Report!",
                text: `${bug}. \nSender: ${email}\n`,
            };

            try {
                await sgMail.send(emailMessage);
                console.log('Email sent successfully');
                return res.status(201).json({ message: `Thank you! Your bug report has been received and we are investigating further!` });
            } catch (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email', error });
            }
        } else {
            // If email is not provided, send both bug report and ID
            const emailMessage = {
                to: 'support@aontechnology.io',
                from: 'support@aontechnology.io',
                subject: "Bug Report!",
                text: `\nBug: ${bug}\nUser ID: ${id}`,
            };

            try {
                await sgMail.send(emailMessage);
                console.log('Email sent successfully');
                return res.status(201).json({ message: `Thank you! Your bug report has been received and we are investigating further!` });
            } catch (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email', error });
            }
        }
    } catch (error) {
        console.error('Error processing bug report:', error);
        return res.status(500).json({ message: 'Server Error', error });
    }
});

// @desc Get all mailer users
// @route GET /users
// @access Private
const getAllMailer = asyncHandler(async (req, res) => {
    // Get all users from MongoDB
    const users = await Mailer.find()

    // If no users 
    if (!users?.length) {
        return res.status(400).json({ message: 'No users found' })
    }

    res.json(users)
})

// @desc Create new user
// @route POST /users
// @access Private
const createNewMailer = asyncHandler(async (req, res) => {
    const { name, email, roles } = req.body

    // Confirm data
    if (!name || !email || !Array.isArray(roles) || !roles.length) {
        return res.status(400).json({ message: 'All fields are required' })
    }

    // Check for duplicate username
    const duplicate = await Mailer.findOne({ username }).lean().exec()

    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate username' })
    }
    const userObject = { name, email, roles }

    // Create and store new user 
    const user = await Mailer.create(userObject)

    if (user) { //created 
        res.status(201).json({ message: `Thanks for joining the list ${name}, The journey begins here!` })
    } else {
        res.status(400).json({ message: 'Invalid user data received' })
    }
})


// @desc Delete a user
// @route DELETE /users
// @access Private
const deleteMailer = asyncHandler(async (req, res) => {
    const { id } = req.body

    // Confirm data
    if (!id) {
        return res.status(400).json({ message: 'User ID Required' })
    }


    // Does the user exist to delete?
    const user = await Mailer.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    const result = await user.deleteOne()

    const reply = `Username ${result.name} with ID ${result._id} deleted`

    res.json(reply)
})

module.exports = {
    getAllMailer,
    createNewMailer,
    deleteMailer,
    reportBug
}
const asyncHandler = require('express-async-handler')
const Mailer = require('../models/joinlist')
const sgMail = require('@sendgrid/mail')
const mongoose = require('mongoose')
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate.js')
const Applications = require('../models/JobSeeker/jobSeeker.Application.js')

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(SENDGRID_API_KEY);

const BUG_REPORT_EMAIL = 'darrienccarter@gmail.com';

const reportBug = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const email = body.email || '';
    const bug = body.bug || '';
    const id = body.id || '';

    if (!bug) {
        return res.status(400).json({ message: 'bug is required' });
    }

    // Always log to console as a fallback record
    console.log(`[BugReport] From: ${email || id || 'anonymous'} | Bug: ${bug}`);

    // Send email — failure is non-fatal, user always gets success
    try {
        const senderInfo = email ? `Sender: ${email}` : (id ? `User ID: ${id}` : 'Anonymous');
        const emailMessage = {
            to: BUG_REPORT_EMAIL,
            from: 'support@aontechnology.io',
            replyTo: email || BUG_REPORT_EMAIL,
            subject: 'Bug Report - WanderWork',
            text: `Bug Report\n\n${bug}\n\n${senderInfo}`,
        };
        await sgMail.send(emailMessage);
        console.log('[BugReport] Email sent successfully');
    } catch (emailErr) {
        console.error('[BugReport] Email send failed (non-fatal):', emailErr?.message || emailErr);
    }

    // Create system message in user's Messages tab — also non-fatal
    if (email) {
        try {
            const candidate = await Candidates.findOne({ email: String(email).toLowerCase() }, '_id').lean();
            if (candidate) {
                await Applications.create({
                    jobId: new mongoose.Types.ObjectId(),
                    candidateId: candidate._id,
                    preparedAt: new Date(),
                    status: 'system',
                    jobTitle: 'Bug Report Received',
                    company: 'WanderWork Support',
                    resume: {},
                    coverLetter: 'Thank you for reaching out! We received your bug report and our team will look into it right away. We are a small team, but we take every issue seriously and will get back to you within 24 to 48 hours. We appreciate you helping us make WanderWork better.',
                });
            }
        } catch (msgErr) {
            console.error('[BugReport] System message creation failed (non-fatal):', msgErr?.message || msgErr);
        }
    }

    return res.status(201).json({ message: 'Thank you! Your bug report has been received and we are investigating further!' });
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
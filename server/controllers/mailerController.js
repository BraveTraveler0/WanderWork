const asyncHandler = require('express-async-handler')
const sgMail = require('@sendgrid/mail')
const mongoose = require('mongoose')
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate.js')
const Applications = require('../models/JobSeeker/jobSeeker.Application.js')

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
sgMail.setApiKey(SENDGRID_API_KEY);

function getBugReportEmail() {
    const easternHour = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    ).getHours();
    // 11 PM (23:00) and later → night recipient
    return easternHour >= 23 ? 'dsdavisjr3@gmail.com' : 'darrienccarter@gmail.com';
}

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
        const recipient = getBugReportEmail();
        const emailMessage = {
            to: recipient,
            from: { name: 'Alice @ Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' },
            replyTo: email || recipient,
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

const joinTeam = asyncHandler(async (req, res) => {
    const { name = '', email = '', role = '', message = '' } = req.body || {};

    if (!name || !email || !role) {
        return res.status(400).json({ message: 'name, email, and role are required' });
    }

    console.log(`[JoinTeam] From: ${name} <${email}> | Role: ${role}`);

    try {
        await sgMail.send({
            to: 'darrienccarter@gmail.com',
            from: { name: 'Alice @ Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' },
            replyTo: email,
            subject: `Join Our Team Application - ${role}`,
            text: `New team application\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\n\nMessage:\n${message || '(none)'}`,
        });
    } catch (emailErr) {
        console.error('[JoinTeam] Email send failed (non-fatal):', emailErr?.message || emailErr);
    }

    return res.status(201).json({ message: 'Application received!' });
});

module.exports = {
    reportBug,
    joinTeam
}

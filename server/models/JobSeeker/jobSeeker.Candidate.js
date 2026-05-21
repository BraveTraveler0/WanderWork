const mongoose = require('mongoose')

const jobSeekerCandidateSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    profileImage: {
        type: String,
        required: false
    },
    phone: {
        type: String,
        required: true
    },
    location: [{
        locationName: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: false
        },
        state: {
            type: String,
            required: false
        },
        postalCode: {
            type: String,
            required: false
        }
    }],
    targetRoles: [String],
    seniority: [String],
    skills: [String],
    urls: [{
        urlName: {
            type: String,
            required: true
        },
        urlAddress: {
            type: String,
            required: true
        }
    }],
    resume: {
        type: Object,
        required: true
    },
    resumeLink: {
        type: String,
        required: false
    },
    coverLetter: {
        type: Object,
        required: false
    },
    coverLetterLink: {
        type: String,
        required: false
    },
    coverLetter_updated_at: {
        type: Date,
        required: false
    },
    resume_text: {
        type: String,
        required: false
    },
    resume_hash: {
        type: String,
        required: false
    },
    resume_updated_at: {
        type: Date,
        required: false
    },
    education: {
        type: String,
        required: false
    },
    work_experience: {
        type: String,
        required: false
    },
    skills_2: {
        type: [String],
        required: false
    },
    status: {
        type: String,
        required: true
    },
    paidUntil: {
        type: Date,
        required: true
    },
    graceDays: {
        type: Number,
        requred: false
    },
    tokenBalance: {
        type: Number,
        required: false
    },
    tokensUsed: {
        type: Number,
        required: false
    },
    creditsBalance: {
        type: Number,
        required: false
    },
    creditsUsed: {
        type: Number,
        required: false
    },
    plan: {
        type: String,
        enum: ['free', 'upgraded', 'premium'],
        default: 'free',
        required: false
    },
    recruiterContactsLeft: {
        type: Number,
        default: 10,
        required: false
    },
    recruiterContactsUpdatedAt: {
        type: Date,
        required: false
    }
})

module.exports = mongoose.model('JobSeeker.Candidates', jobSeekerCandidateSchema)

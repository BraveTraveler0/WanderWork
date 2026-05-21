const mongoose = require('mongoose')

const jobSeekerApplicationSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'JobSeeker.Job'
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'JobSeeker.Candidate'
    },
    preparedAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    jobTitle: {
        type: String,
        required: false
    },
    company: {
        type: String,
        required: false
    },
    resume: {
        type: Object,
        required: true
    },
    coverLetter: {
        type: String,
        required: true
    }
})

module.exports = mongoose.model('JobSeeker.Application', jobSeekerApplicationSchema)

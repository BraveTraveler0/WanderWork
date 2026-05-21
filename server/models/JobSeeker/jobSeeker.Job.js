const mongoose = require('mongoose')

const jobSeekerJobSchema = new mongoose.Schema({
    job_code: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    salary: {
        type: String,
        required: false
    },
    location: [{
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
        },
        country: {
            type: String,
            required: false
        }
    }],
    url: {
        type: String,
        required: true
    },
    jobType: {
        type: String,
        required: true
    },
    datePosted: {
        type: Date,
        required: true
    },
    shortDescription: {
        type: String,
        required: true
    },
    tags: []
})

module.exports = mongoose.model('JobSeeker.Jobs', jobSeekerJobSchema)
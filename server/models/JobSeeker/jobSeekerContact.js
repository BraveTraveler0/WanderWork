const mongoose = require('mongoose')

const jobSeekerContactSchema = new mongoose.Schema({
    company: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    source: {
        type: String,
        required: true
    },
    lastVerified: {
        type: Date,
        required: true
    }
})

module.exports = mongoose.model('JobSeeker.Contacts', jobSeekerContactSchema)
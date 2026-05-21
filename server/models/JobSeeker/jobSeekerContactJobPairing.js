const mongoose = require('mongoose')

const jobSeekerContactJobPairingSchema = new mongoose.Schema({
    contactId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'JobSeeker.Contact'
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'JobSeekeker.Job'
    },
    confidence: {
        type: Number,
        required: true
    }
})

module.exports = mongoose.model('JobSeeker.ContactJobPairing', jobSeekerContactJobPairingSchema)
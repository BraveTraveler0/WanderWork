const mongoose = require('mongoose')

const jobSeekerCandidateJobPairingSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'jobSeeker.Job',
        index: true,
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'jobSeeker.Candidates',
        index: true,
    },
    score: {
        type: Number,
        required: true
    },
    matchType: {
        type: String,
        enum: ['direct', 'adjacent', 'stretch'],
        required: false
    },
    matchedSkills: [String],
    reasons: [String],
    warnings: [String],
    reason: {
        type: String,
        required: false
    },
    roleScore: { type: Number, required: false },
    skillScore: { type: Number, required: false },
    bridgeScore: { type: Number, required: false },
    pairedAt: {
        type: Date,
        required: false
    },
    source: {
        type: String,
        required: false
    },
    algorithmVersion: {
        type: String,
        required: false
    },
})

jobSeekerCandidateJobPairingSchema.index({ candidateId: 1, jobId: 1 }, { unique: true })

module.exports = mongoose.model('JobSeeker.CandidateJobPairing', jobSeekerCandidateJobPairingSchema)

const mongoose = require('mongoose')

const votesSchema = new mongoose.Schema(
    {
        user_id: {
            type: String,
            required: true
        },
        voting_id: {
            type: String,
            required: true
        },
        createdDate: {
            type: Date,
            required: false,
            default: Date.now
        },
    }
)

const VotesModel = mongoose.model('Votes', votesSchema);

module.exports = VotesModel;

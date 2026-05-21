const mongoose = require('mongoose')

const groupsSchema = new mongoose.Schema({
    groupName: {
        type: String,
        required: true
    },
    groupBio: {
        type: String,
        default: "Who are you, brave traveler?"
    },
    qrcode: {
        type: String,
        default: ''
    },
    title: {
        type: String
    },
    profimage: {
        type: String
    },
    backimage: {
        type: String
    },
    admins : [
        {
            type: String,
            ref: 'User'
        }
    ],
    followers : [
        {
            type: String,
            ref: 'User'
        }
    ],
    supporters : [
        {
            type: String,
            ref: 'User'
        }
    ],
    active: {
        type: Boolean,
        default: true
    },
    NSFW: {
        type: Boolean,
        default: true
      },
    tags : [
    {
        type: String
    }
    ],
    bgColor: {
        type: String
    },
    token: {
        type: String
    },
    stripeId: {
        type: String,
        default: null
    }
})

module.exports = mongoose.model('Groups', groupsSchema)
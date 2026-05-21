const mongoose = require('mongoose')

const notificationsSchema = new mongoose.Schema({
  senderSlug: {
    type: String,
    required: true
  },
  senderProfImage: {
    type: String,
    required: true
  },
  senderDisplayName: {
    type: String,
    required: true
  },
  recipSlug: {
    type: String,
    required: true
  },
  postSlug: {
    type: String,
  },
  postImage: {
    type: String,
  },
  action: {
    type: String,
    required: true
  },
  actionImage: {
    type: String
  },
  actionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  postInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  starQuantity: {
    type: Number
  },
  donationQuantity: {
    type: Number
  },
  achievement: [{
    id: {
        type: String,
    },
    crown: {
        type: String,
        },
    goal: {
        type: String,
    },
    complete: {
        type: Number,
        default: 0
    }
  }],
  read: {
    type: Boolean,
    default: false
  }
})


module.exports = mongoose.model('Notifications', notificationsSchema)
const mongoose = require('mongoose')

const likesSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  likedMedia: {
    type: String,
    required: true
  },
  likeDate: {
    type: Date,
    required: true,
    default: Date.now
  }

})


module.exports = mongoose.model('Likes', likesSchema)
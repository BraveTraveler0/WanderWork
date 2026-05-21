const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  createdAt: {
      type: Date,
      default: Date.now
  },
  content: {
      type: String
  },
  commentRank: {
    type: Number,
    defualt: 0
  },
  commentStarDonator: [{
    type: String
  }],
  voteUpUsers: [{
    type: String
  }],
  voteDownUsers: [{
    type: String
  }],
  user: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Assuming 'User' is the model name
      required: true
    },
    displayName: {
        type: String,
        required: true
    },
    profileImage: {
        type: String,
        required: true
    }
}
});

module.exports = mongoose.model('Comment', commentSchema);
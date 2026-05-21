const mongoose = require('mongoose');

const rankedpostSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  rank: {
    type: Number
  },
  profileImage: {
    type: String
  },
  user: {
    type: String,
    required: true
  },
  postimage: {
    type: String
  },
  text: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  likesUsers: [{
    type: String
  }],
  stars: {
    type: Number,
    default: 0
  },
  starDonator: [{
    type: String
  }],
  comments: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  collaborator: [{
    slug: {
      type: String,
      required: true
    },
    displayName: {
      type: String,
      required: true
    }
  }],
  tags: [{
    id: {
      type: String,
      required: true
    },
    tag: {
      type: String,
      required: true
    }
  }],
  visibility: {
    type: String
  },
  NSFW: {
    type: Boolean,
    default: false
  },
  highestrank: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RankedPost', rankedpostSchema);
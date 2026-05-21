const mongoose = require('mongoose');
const User = require('../models/User');

const postSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  profileImage: {
    type: String
  },
  text: {
    type: String
  },
  postimage: {
      type: String
  },
  postImages: [{
    type: String
}],
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
  shares: {
    type: Number,
    default: 0
  },
  shareUsers: [{
    type: String
  }],
  highestrank: {
    type: Number
  },
  point:{
    type: Number
  },
  currentrank: {
    type: Number
  },
  stars: {
    type: Number,
    default: 0
  },
  starDonator: [{
    type: String
  }],
  comments: [{
    user: {
      displayName: {
        type: String,
      },
      profimage: {
        type: String
      },
      userId: {
        type: String,
      }
    },
    content: {
      type: String,
    },
    stars: {
      type: Number,
      default: 0
    },
    commentStarDonator: [{
      type: String
    }],
    commentRank: {
      type: Number,
      default: 0
    },
    voteUpUsers: [{
      type: String
    }],
    voteDownUsers: [{
      type: String
    }],
    created_at: {
    type: Date,
    default: Date.now
    },
    replies: [{
      user: {
        displayName: {
          type: String,
        },
        profimage: {
          type: String
        },
        userId: {
          type: String,
        }
      },
      content: {
        type: String,
      },
      stars: {
        type: Number,
        default: 0
      },
      commentStarDonator: [{
        type: String
      }],
      commentRank: {
        type: Number,
        default: 0
      },
      voteUpUsers: [{
        type: String
      }],
      voteDownUsers: [{
        type: String
      }],
      created_at: {
      type: Date,
      default: Date.now
      },
    }]
  }],
  collaborator: [{}],
  tags: [{
    id: {
      type: String,
    },
    tag: {
      type: String,
    }
  }],
  NSFW: {
    type: Boolean,
    default: false
  },
  Remix: {
    type: Boolean,
    default: false
  },
  Repost: {
    type: Boolean,
    default: false,
  },
  Paywall: {
    type: Number
  },
  visibility: {
    type: String,
    default: "all"
  },
  share: {
    type: Boolean,
    default: false
  },
  PostTime: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    default: "World News"
  }
});

module.exports = mongoose.model('Posts', postSchema);
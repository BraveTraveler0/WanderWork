const mongoose = require("mongoose");

const postRankSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
  },
  slug: {
    type: String,
    required: true
  },
  category: {
    type: String
  },
  tags: [
    {
      id: {
        type: String,
        required: true,
      },
      tag: {
        type: String,
        required: true,
      },
    },
  ],
  time_scale: {
    type: String,
  },
  point: {
    type: Number,
  },
  rank: {
    type: Number,
  },
  PostTime: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("PostRank", postRankSchema);

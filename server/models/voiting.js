const mongoose = require('mongoose');

const VoitingSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answers: [
    {
      id: {
        type: String,
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
      votes: {
        type: Number,
        default: 0,
      },
    },
  ],
  submittedBy: {
    type: Object,
    required: true,
  },
  openedAt: {
    type: Date,
    required: true,
  },
  closedAt: {
    type: Date,
  },
  myVote: {
    answerId: {
      type: String,
    },
    stars: {
      type: Number,
      default: 0,
    },
  },
});

const VoitingModel = mongoose.model('Voting', VoitingSchema);

module.exports = VoitingModel;

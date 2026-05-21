const mongoose = require('mongoose');

// First, define the Mission schema
const MissionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  stars: {
    type: String,
    required: true
  },
  starValue: {
    type: Number,
    required: false
  },
  type: {
    type: String,
    enum: ['contest', 'optin', 'hasPost', 'none'],
    default: 'none'
  },
  icon: {
    type: String
  },
  tag: {
    type: String,
    required: false
  },
  key: {
    type: Number,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const QuestSchema = new mongoose.Schema({
  quest1: {
    type: String,
    required: false
  },
  quest2: {
    type: String,
    required: false
  },
  quest3: {
    type: String,
    required: false
  },
  quest4: {
    type: String,
    required: false
  },
  quest5: {
    type: String,
    required: false
  },
  questImage: {
    type: String
  }
});

// Then update your Events schema to include missions
const eventsSchema = new mongoose.Schema({
    eventName: {
        type: String,
        required: true
    },
    eventBio: {
        type: String,
        default: "Who are you, brave traveler?"
    },
    callToAction: {
      type: String
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
    admins: [
        {
            type: String,
            ref: 'User'
        }
    ],
    followers: [
        {
            type: String,
            ref: 'User'
        }
    ],
    supporters: [
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
    tags: [
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
    },
    missions: [
      MissionSchema
    ],
    quest: {
      type: QuestSchema,
      required: false
  },
    codes: {
        type: Map,
        of: Number,
        default: {}
    },
    logos: [
      {
        type: String
      }
    ],
    eventStart: {
        type: Date
    },
    eventEnd: {
        type: Date
    }
});

const UserMissionSchema = new mongoose.Schema({
  userId: {
    type: String,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Events',
    required: true
  },
  missionKey: {
    type: Number,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  missionType: {
    type: String,
    enum: ['hasPost', 'contest', 'optin', 'other'],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add compound index to prevent duplicate entries
UserMissionSchema.index({ userId: 1, eventId: 1, missionKey: 1 }, { unique: true });

// Static method to get all completed missions for a user in an event
UserMissionSchema.statics.getUserEventProgress = async function(userId, eventId) {
  const missions = await this.find({ userId, eventId });
  const completedMissions = missions.filter(mission => mission.completed);
  
  return {
    missions,
    completedCount: completedMissions.length,
    isComplete: missions.length > 0 && missions.every(mission => mission.completed)
  };
};

const Events = mongoose.model('Events', eventsSchema);
const UserMission = mongoose.model('UserMission', UserMissionSchema);

module.exports = { Events, UserMission };
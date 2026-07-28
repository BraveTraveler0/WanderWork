const mongoose = require('mongoose')
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        default: "EXPLORER"
    },
    titleTut: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        default: "TRAVELER"
    },
    slug: {
        type: String
    },
    password: {
        type: String,
        required: true
    },
    event: {
        type: String
    },
    postTut: {
        type: Boolean,
        default: false
    },
    bio: {
        type: String,
        default: "Who are you, brave traveler?"
    },
    bioTut: {
        type: Boolean,
        default: false
    },
    profimage: {
        data: Buffer,
        contentType: String
    },
    qrcode: {
        type: String,
        default: ''
    },
    profImageTut: {
        type: Boolean,
        default: false
    },
    backImage: {
        data: Buffer,
        contentType: String
    },
    backImageTut: {
        type: Boolean,
        default: false
    },
    tutcomplete: {
        type: Boolean,
        default: false
    },
    tutview: {
        type: Boolean,
        default: true
    },
    stars: {
        type: Number,
        default: 0
    },
    achievements: [{
        id: {
            type: String,
            required: true
        },
        achievementId: {
            type: String,
            ref: 'Achievements'
        },
        goal: {
            type: String,
            required: true
        },
        progress: {
            type: Number,
            default: 0,
            required: true
        }
    }],
    displayCase: [{
        type: String
    }],
    following : [
        {
            type: String,
            ref: 'User'
        }
    ],
    supporting : [
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
    lastlogin: {
        type: Date,
        default: Date.now
      },
    consecutivelogins: {
        type: Number,
        default: 0
    },
    totalTimeOnline: {
        type: Number,
        default: 0
    },
    profimage: {
        type: String
      },
    backimage: {
        type: String
      },
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
    verified: {
        type: Boolean
    },
    verificationToken: {
        type: String,
        default: null
    },
    token: {
        type: String
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    loginLockUntil: {
        type: Date,
        default: null
    },
    loginLockLevel: {
        type: Number,
        default: 0
    },
    lastFailedLoginAt: {
        type: Date,
        default: null
    },
    xp: {
        type: Number,
        default: 0,
    },
    level: {
        type: Number,
        default: 1,
    },
    stripeId: {
        type: String,
        default: null
    },
    plan: {
        type: String,
        enum: ['starter', 'pro', 'premium'],
        default: 'starter'
    },
    stripeSubscriptionId: {
        type: String,
        default: null
    },
    planExpiresAt: {
        type: Date,
        default: null
    },
    xp: {
        type: Number,
        default: 0,
    },
    level: {
        type: Number,
        default: 1,
    },
    extensionKey: {
        type: String,
        default: null
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isMod: {
        type: Boolean,
        default: false
    },
    starsProgress: {
        reShareCount: {
            type: Number,
            default: 0,
        },
        likeGiveCount: {
            type: Number,
            default: 0,
        },
        likeReceiveCount: {
            type: Number,
            default: 0,
        },
        postCount: {
            type: Number,
            default: 0,
        },
        remixCount: {
            type: Number,
            default: 0,
        },
    },
    aoncon2024: [
        {
            cosplayVote: Boolean,
            smash: Boolean,
            raffle: Boolean,
            plushie: Boolean,
            sneaker: Boolean,
            art: Boolean,
            fashion: Boolean,
            love: Boolean,
            crackCode: Boolean,
            followBeltline: Boolean,
            followAon: Boolean,
            captureMoment: Boolean,
            dance: Boolean,
            nonCosplay: Boolean,
            date: {
                type: Date,
                default: Date.now
            }
        }
    ],
    aonconeventtut: [
        {
            profimage: Boolean,
            username: Boolean,
            color: Boolean,
            newperson: Boolean,
            igscreenshot: Boolean
        }
    ],
})

// Define the comparePassword method
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
      // Use bcrypt to compare the provided password (plaintext) with the hashed password (stored in the database)
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      throw error;
    }
  };

module.exports = mongoose.model('User', userSchema)

const mongoose = require('mongoose')

const joinlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
  }
})

joinlistSchema.pre('validate', function(next) {

    
      if (!this.role) {
        this.role = "mailer"
      }
    
  next()
})

module.exports = mongoose.model('joinlist', joinlistSchema)
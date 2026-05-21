const mongoose = require('mongoose')

const subscriberSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  subscribedToChannel: {
    type: String,
    required: true
  },
  subscribeDate: {
    type: Date,
    required: true,
    default: Date.now
  },
    subscribePrivacy: {
      type: String
    }

})



subscriberSchema.pre('validate', function(next) {
 
  if (!this.subscribePrivacy) {
    this.subscribePrivacy = "Public"
  }

  next()
})

module.exports = mongoose.model('Subscriber', subscriberSchema)
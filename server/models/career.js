const mongoose = require('mongoose')

const careerSchema = new mongoose.Schema({
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
  title: {
    type: String
  },
  salary: {
    type: String
  },
  comment: {
    type: String
  },
  resume: {
    type: String
  },
  role: {
    type: String,
  }
})

careerSchema.pre('validate', function(next) {

    
      if (!this.role) {
        this.role = "career"
      }
    
  next()
})

module.exports = mongoose.model('career', careerSchema)
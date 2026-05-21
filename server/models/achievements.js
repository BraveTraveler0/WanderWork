const mongoose = require('mongoose')

const achievementsSchema = new mongoose.Schema({
  image: {
    type: String
  
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
})


module.exports = mongoose.model('Achievements', achievementsSchema)
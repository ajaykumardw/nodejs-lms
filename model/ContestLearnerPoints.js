const mongoose = require('mongoose')

const contestLearnerSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  contest_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'contest_badge',
    required: true
  },
  leaderboard_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  module_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    default: null
  },
  activity_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    default: null
  },
  module_type_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    default: null
  },
  learner_point: {
    type: Number,
    required: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now()
  },
  updated_at: {
    type: Date,
    default: null
  }
})

module.exports = mongoose.model('contest_learner_point', contestLearnerSchema)

const mongoose = require('mongoose')

const LeaderboardConfigSchema = new mongoose.Schema(
  {
    label_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    value: {
      type: String,
      required: true
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: false,
      default: null
    },
    created_at: {
      type: Date,
      required: true,
      default: Date.now()
    },
    updated_at: {
      type: Date,
      required: false,
      default: null
    }
  },
  {
    collection: 'leaderboard_config'
  }
)

module.exports = mongoose.model('leaderboard_config', LeaderboardConfigSchema)

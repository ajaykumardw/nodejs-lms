const mongoose = require('mongoose')

const userContestBadgeEnroll = new mongoose.Schema(
  {
    contest_badge_id: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'contest_badge'
    },
    user_id: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'users'
    },
    created_by: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'users'
    },
    created_at: {
      type: Date,
      required: true,
      default: Date.now()
    }
  },
  {
    collection: 'user_contest_badge_enroll'
  }
)

module.exports = mongoose.model(
  'user_contest_badge_enroll',
  userContestBadgeEnroll
)

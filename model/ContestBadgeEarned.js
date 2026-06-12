const mongoose = require('mongoose')

const contestBadgeEarnedSchema = new mongoose.Schema(
  {
    contest_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'contest_badge',
      required: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },
    badges_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      default: null
    }
  },
  {
    collection: 'contest_badge_earned',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
)

module.exports = mongoose.model(
  'contest_badge_earned',
  contestBadgeEarnedSchema
)

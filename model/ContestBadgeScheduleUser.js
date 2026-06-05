const mongoose = require('mongoose')

const Schema = mongoose.Schema

const contestBadgeScheduleUserSchema = new Schema(
  {
    contest_badge_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'contest_badge'
    },
    type: {
      type: String, // VARCHAR(255)
      maxlength: 255, // Limit length to 255 characters
      required: true // type is required
    },
    type_id: {
      type: mongoose.Schema.Types.ObjectId, // BIGINT
      required: true, // type_id is required
      ref: 'users'
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId, // BIGINT
      required: true, // type_id is required
      ref: 'users'
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId, // BIGINT
      required: true, // company_id is required
      ref: 'users' // Reference to 'companies' collection
    },
    created_at: {
      type: Date, // TIMESTAMP
      required: true, // created_at is required
      default: Date.now // Default to current date/time
    },
    updated_at: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'contest_badge_schedule_user'
  }
)

module.exports = mongoose.model(
  'contest_badge_schedule_user',
  contestBadgeScheduleUserSchema
) // Model name 'ScheduleUser'

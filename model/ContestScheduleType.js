const mongoose = require('mongoose')

const Schema = mongoose.Schema

const contestBadgeScheduleTypeSchema = new Schema(
  {
    contest_badge_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'contest_badge'
    },
    type: {
      type: String,
      maxlength: 1, // "1"=Designation, "2"=Department, "3"=Group, "4"=Region, "5"=User
      required: true
    },
    type_id: {
      type: mongoose.Schema.Types.ObjectId, // ID of designation/department/group/region/user
      required: true
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId, // BIGINT
      required: true, // company_id is required
      ref: 'users' // Reference to 'companies' collection
    },
    created_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: null
    }
  },
  { collection: 'contest_badge_schedule_type' }
)

module.exports = mongoose.model(
  'contest_badge_schedule_type',
  contestBadgeScheduleTypeSchema
)

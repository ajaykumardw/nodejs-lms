const mongoose = require('mongoose')

const contestBadgeSchema = new mongoose.Schema(
  {
    contest_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },

    badge_id: [
      {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      }
    ],

    start_date: {
      type: Date,
      required: true
    },

    end_date: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.start_date
        },
        message: 'End date must be greater than start date'
      }
    },

    target_pair: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    status: {
      type: String,
      enum: ['0', '1'],
      default: '1',
      required: true
    },
    is_result_announced: {
      type: Boolean,
      default: false,
      required: false
    },
    completion_status: {
      type: String,
      default: 'Upcoming',
      required: false
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true
    },

    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      default: null
    }
  },
  {
    collection: 'contest_badge',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
)

contestBadgeSchema.virtual('user_contest_badge_enroll', {
  ref: 'user_contest_badge_enroll',
  localField: '_id',
  foreignField: 'contest_badge_id',
  justOne: false
})

contestBadgeSchema.set('toJSON', { virtuals: true, getters: true })
contestBadgeSchema.set('toObject', { virtuals: true, getters: true })

module.exports = mongoose.model('contest_badge', contestBadgeSchema)

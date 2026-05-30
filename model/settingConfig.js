const mongoose = require('mongoose')

const settingConfigSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      unique: true,
      required: true
    },
    certificate_setting_data_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      default: null
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
  {
    collection: 'setting_config'
  }
)

module.exports = mongoose.model('SettingConfig', settingConfigSchema)

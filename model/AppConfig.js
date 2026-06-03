const mongoose = require('mongoose')

const appConfigSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      unique: true,
      required: true,
      maxlength: 100
    },
    logoURL: {
      type: String,
      required: false,
      maxlength: 100
    },
    title: {
      type: String,
      required: false,
      maxlength: 100
    },
    content: {
      type: String,
      required: false,
      maxlength: 100
    },
    content2: {
      type: String,
      required: false,
      maxlength: 100
    },
    frameImage: [
      {
        type: String,
        required: false,
        maxlength: 100
      }
    ],
    signatureURL: {
      type: String,
      required: false,
      maxlength: 100
    },
    default_email_layout: {
      type: String,
      required: false,
      maxlength: 10000
    },
    notification_data: [
      {
        type: {
          type: String,
          maxlength: 255,
          required: false
        },
        default_footer: {
          type: String,
          required: false,
          maxlength: 1000
        },
        default_logo: {
          type: String,
          maxlength: 255,
          required: false
        },
        category: [
          {
            name: {
              type: String,
              maxlength: 255,
              required: false
            }
          }
        ],
        default_message: {
          type: String,
          maxlength: 6000,
          required: false
        }
      }
    ],
    placeholder_data: [
      {
        name: {
          type: String,
          required: false,
          maxlength: 255
        },
        variable: [
          {
            name: {
              type: String,
              required: false,
              maxlength: 255
            }
          }
        ]
      }
    ],
    module_data: [
      {
        title: {
          type: String,
          required: true,
          maxlength: 255
        },
        description: {
          type: String,
          required: true,
          maxlength: 1000
        },
        image_url: {
          type: String,
          required: true,
          maxlength: 1000
        }
      }
    ],
    live_session: [
      {
        title: {
          type: String,
          required: true
        }
      }
    ],
    activity_data: [
      {
        title: {
          type: String,
          required: true,
          maxlength: 255
        },
        description: {
          type: String,
          required: true,
          maxlength: 5000
        },
        svg_content: {
          type: String,
          required: true,
          maxlength: 5000
        },
        status: {
          type: Boolean,
          required: true,
          default: true
        }
      }
    ],
    certificate_setting_data: [
      {
        title: {
          type: String,
          required: true
        }
      }
    ],
    leadership_data: [
      {
        title: {
          type: String,
          required: true,
          maxlength: 255
        },
        label_data: [
          {
            label: {
              type: String,
              required: true,
              maxlength: 255
            },
            value: {
              type: String,
              required: true,
              maxlength: 255
            }
          }
        ]
      }
    ]
  },
  {
    collection: 'app_config'
  }
)

module.exports = mongoose.model('app_config', appConfigSchema)

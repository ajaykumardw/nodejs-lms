const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    template_name: {
        type: String,
        required: true,
        maxLength: 255
    },
    notification_type: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    category_type: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
    },
    default_select: {
        type: Boolean,
        required: true,
        default: true
    },
    subject: {
        type: String,
        required: true,
        maxLength: 255
    },
    message: {
        type: String,
        required: true,
        maxLength: 5000
    },
    footer: {
        type: String,
        required: true,
        maxLength: 1000
    },
    user_input: [{
        subject: {
            type: String,
            required: false,
            maxLength: 255
        },
        message: {
            type: String,
            required: false,
            maxLength: 5000
        },
        footer: {
            type: String,
            required: false,
            maxLength: 1000
        },
        default_select: {
            type: Boolean,
            required: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        }
    }],
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    created_at: {
        type: Date,
        default: Date.now,
        required: true
    },
    updated_at: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    collection: 'notification_template'
});

module.exports = mongoose.model('Notification', notificationSchema);

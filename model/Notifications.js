const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    template_name: {
        type: String,
        required: true,
        maxlength: 255
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
    header_logo: {
        type: String,
        maxlength: 1000,
        required: true
    },
    header_logo_align: {
        type: String,
        maxlength: 10,
        required: true
    },
    show_footer_logo: {
        type: Boolean,
        default: false,
    },
    footer_logo: {
        type: String,
        maxlength: 1000,
        required: false
    },
    footer_logo_align: {
        type: String,
        maxlength: 10,
        required: false
    },
    subject: {
        type: String,
        required: true,
        maxlength: 255
    },
    message: {
        type: String,
        required: true,
        maxlength: 5000
    },
    footer: {
        type: String,
        required: true,
        maxlength: 1000
    },
    user_input: [{
        subject: {
            type: String,
            required: false,
            maxlength: 255
        },
        message: {
            type: String,
            required: false,
            maxlength: 5000
        },
        footer: {
            type: String,
            required: false,
            maxlength: 1000
        },
        default_select: {
            type: Boolean,
            required: true,
        },
        header_logo: {
            type: String,
            maxlength: 1000,
            required: true
        },
        header_logo_align: {
            type: String,
            maxlength: 10,
            required: true
        },
        show_footer_logo: {
            type: Boolean,
            default: false,
        },
        footer_logo: {
            type: String,
            maxlength: 1000,
            required: false
        },
        footer_logo_align: {
            type: String,
            maxlength: 10,
            required: false
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

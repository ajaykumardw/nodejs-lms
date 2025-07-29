const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
    type: {
        type: String,
        unique: true,
        required: true,
        maxLength: 100
    },
    logoURL: {
        type: String,
        required: false,
        maxLength: 100
    },
    title: {
        type: String,
        required: false,
        maxLength: 100
    },
    content: {
        type: String,
        required: false,
        maxLength: 100
    },
    content2: {
        type: String,
        required: false,
        maxLength: 100
    },
    frameImage: [{
        type: String,
        required: false,
        maxLength: 100
    }],
    signatureURL: {
        type: String,
        required: false,
        maxLength: 100
    },
    notification_data: [{
        type: {
            type: String,
            maxLength: 255,
            required: false
        },
        default_footer: {
            type: String,
            required: false,
            maxLength: 1000
        },
        default_logo: {
            type: String,
            maxLength: 255,
            required: false
        },
        category: [{
            name: {
                type: String,
                maxLength: 255,
                required: false
            }
        }],
        default_message: {
            type: String,
            maxLength: 6000,
            required: false
        }
    }],
    placeholder_data: [{
        name: {
            type: String,
            required: false,
            maxLength: 255,
        },
        variable: [
            {
                name: {
                    type: String,
                    required: false,
                    maxLength: 255,
                },
            },
        ],
    }],
    module_data: [{
        title: {
            type: String,
            required: true,
            maxLength: 255
        },
        description: {
            type: String,
            required: true,
            maxLength: 1000
        },
        image_url: {
            type: String,
            required: true,
            maxLength: 1000
        }
    }],
    live_session: [{
        title: {
            type: String,
            required: true
        }
    }],
    activity_data: [{
        title: {
            type: String,
            required: true,
            maxLength: 255
        },
        description: {
            type: String,
            required: true,
            maxLength: 5000
        },
        svg_content: {
            type: String,
            required: true,
            maxLength: 5000,
        },
        status: {
            type: Boolean,
            required: true,
            default: true
        }
    }]
}, {
    collection: 'app_config'
});

module.exports = mongoose.model('app_config', appConfigSchema);

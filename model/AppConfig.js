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
    }]
}, {
    collection: 'app_config'
});

module.exports = mongoose.model('app_config', appConfigSchema);

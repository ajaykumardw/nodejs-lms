const mongoose = require('mongoose')

const appConfigSchema = new mongoose.Schema({
    type: {
        type: String,
        unique: true,
        required: true,
        maxLength: 100
    },
    logoURL: {
        type: String,
        required: true,
        mexLength: 100
    },
    title: {
        type: String,
        required: true,
        maxLength: 100
    },
    content: {
        type: String,
        required: true,
        maxLength: 100
    },
    content2: {
        type: String,
        required: true,
        maxLength: 100
    },
    frameImage: [{
        type: String,
        required: false,
        maxLength: 100,
    }],
    signatureURL: {
        type: String,
        required: false,
        maxLength: 100,
    },
}, {
    collection: 'app_config'
})

module.exports = mongoose.model('app_config', appConfigSchema)
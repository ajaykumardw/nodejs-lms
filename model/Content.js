const mongoose = require('mongoose')

const contentSchema = new mongoose.Schema({
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module"
    },
    title: {
        type: String,
        required: true,
        maxlength: 255,
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    image_url: {
        type: String,
        required: true,
        maxlength: 255,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now(),
    },
    updated_at: {
        type: Date,
        required: false,
    }
})

module.exports = mongoose.model('Content', contentSchema)
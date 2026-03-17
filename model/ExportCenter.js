const mongoose = require('mongoose')

const exportCenter = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "users"
    },
    report_type: {
        type: String,
        required: true,
        maxlength: 255
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
    },
    file_path: {
        type: String,
        required: false,
        maxlength: 255
    },
    progress_percent: {
        type: Number,
        default: 0
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    created_at: {
        type: Date,
        default: Date.now(),
    },
    updated_at: {
        type: Date,
        default: Date.now(),
    }
}, {
    collection: "export_center"
})

module.exports = mongoose.model('export_center', exportCenter)
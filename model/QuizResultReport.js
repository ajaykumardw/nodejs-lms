const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const quizReportSchema = new Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    log_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "ActivityLog"
    },
    activity_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    question_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    is_correct: {
        type: Boolean,
        required: true,
        default: false
    },
    selected_option_no: [{
        type: String,
    }],
    mark: {
        type: String,
    },
    total_mark: {
        type: String
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    created_at: {
        type: Date,
        required: true,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        required: false,
    },
});

module.exports = mongoose.model('quiz_result_report', quizReportSchema); // Model name 'Question'
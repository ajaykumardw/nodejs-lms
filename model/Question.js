const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const questionSchema = new Schema({
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    activity_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    question_type: {
        type: String,
        maxlength: 50,
        required: false
    },
    question: {
        type: String,
        maxlength: 5000,
        required: true,
    },
    option1: {
        type: String,
    },
    option2: {
        type: String,
    },
    option3: {
        type: String,
    },
    option4: {
        type: String,
    },
    option5: {
        type: String,
    },
    option6: {
        type: String,
    },
    section: {
        type: String,
        maxlength: 10,
        required: true,
    },
    use_answer_explanation: {
        type: Boolean,
        required: true,
        default: false,
    },
    correct_answer: [{
        type: String,
        required: true,
    }],
    score: {
        type: String,
        maxlength: 10,
        required: true,
    },
    diffculty: {
        type: String,
        maxlength: 1,
        default: "1",
        required: true,
    },
    answer_explanation: {
        type: String,
        maxlength: 500,
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

module.exports = mongoose.model('questions', questionSchema); // Model name 'Question'
const mongoose = require("mongoose");

const batchAssignmentSubmissionSchema = new mongoose.Schema({
    post_read_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch_session_post_read",
        required: true,
        index: true,
    },
    session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch_session",
        required: true,
        index: true,
    },
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch",
        required: true,
        index: true,
    },
    learner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true,
    },
    submission_text: {
        type: String,
        trim: true,
        default: "",
    },
    submission_file_url: {
        type: String,
        trim: true,
        default: "",
    },
    submitted_at: {
        type: Date,
        default: Date.now,
    },
    score: {
        type: Number,
        min: 0,
        max: 5,
        default: null,
    },
    graded_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        default: null,
    },
    graded_at: {
        type: Date,
        default: null,
    },
    status: {
        type: String,
        enum: ["submitted", "graded", "pending"],
        default: "submitted",
        index: true,
    },
}, {
    collection: "batch_assignment_submission",
    timestamps: true,
});

batchAssignmentSubmissionSchema.index(
    { post_read_id: 1, learner_id: 1 },
    { unique: true }
);

module.exports = mongoose.model("batch_assignment_submission", batchAssignmentSubmissionSchema);
const mongoose = require("mongoose");

const batchSessionPreReadProgressSchema = new mongoose.Schema({
    pre_read_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch_session_pre_read",
        required: true,
        index: true,
    },
    session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch_session",
        required: true,
        index: true,
    },
    learner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true,
    },
    completed: {
        type: Boolean,
        default: false,
    },
    completed_at: {
        type: Date,
        default: null,
    },
}, {
    collection: "batch_session_pre_read_progress",
    timestamps: true,
});

batchSessionPreReadProgressSchema.index(
    { pre_read_id: 1, learner_id: 1 },
    { unique: true }
);

module.exports = mongoose.model("batch_session_pre_read_progress", batchSessionPreReadProgressSchema);

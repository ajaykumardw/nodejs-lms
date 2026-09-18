const mongoose = require("mongoose");

const batchSessionPostReadSchema = new mongoose.Schema({
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
    title: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ["reflection", "reading", "assignment", "quiz"],
        default: "assignment",
    },
    description: {
        type: String,
        trim: true,
        default: "",
    },
    duration_label: {
        type: String,
        trim: true,
        default: "",
    },
    due_date: {
        type: Date,
        default: null,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
}, {
    collection: "batch_session_post_read",
    timestamps: true,
});

module.exports = mongoose.model("batch_session_post_read", batchSessionPostReadSchema);
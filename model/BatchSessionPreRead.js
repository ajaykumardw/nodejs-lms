const mongoose = require("mongoose");

const batchSessionPreReadSchema = new mongoose.Schema({
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
        enum: ["article", "video", "worksheet", "pdf", "other"],
        default: "article",
    },
    resource_url: {
        type: String,
        trim: true,
        default: "",
    },
    duration_label: {
        type: String, // e.g. "10 min read", "14 min"
        trim: true,
        default: "",
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
}, {
    collection: "batch_session_pre_read",
    timestamps: true,
});

module.exports = mongoose.model("batch_session_pre_read", batchSessionPreReadSchema);
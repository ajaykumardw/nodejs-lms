const mongoose = require("mongoose");

const batchSessionNoteSchema = new mongoose.Schema({
    session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch_session",
        required: true,
        unique: true,
        index: true,
    },
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch",
        required: true,
        index: true,
    },
    topics_covered: {
        type: [String],
        default: [],
    },
    outcome_notes: {
        type: String,
        trim: true,
        default: "",
    },
    completed: {
        type: Boolean,
        default: false,
    },
    completed_at: {
        type: Date,
        default: null,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
}, {
    collection: "batch_session_note",
    timestamps: true,
});

module.exports = mongoose.model("batch_session_note", batchSessionNoteSchema);
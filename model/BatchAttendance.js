const mongoose = require("mongoose");

const batchSessionAttendanceSchema = new mongoose.Schema({
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
    status: {
        type: String,
        enum: ["present", "late", "absent", "pending"],
        default: "pending",
        index: true,
    },
    marked_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        default: null,
    },
    marked_at: {
        type: Date,
        default: null,
    },
    remarks: {
        type: String,
        trim: true,
        default: "",
    },
}, {
    collection: "batch_session_attendance",
    timestamps: true,
});

batchSessionAttendanceSchema.index(
    { session_id: 1, learner_id: 1 },
    { unique: true }
);

module.exports = mongoose.model("batch_session_attendance", batchSessionAttendanceSchema);
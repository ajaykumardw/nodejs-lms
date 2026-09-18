const mongoose = require("mongoose");

const batchSessionMaterialSchema = new mongoose.Schema({
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
        enum: ["pdf", "slides", "video", "link", "doc", "other"],
        default: "other",
    },
    file_url: {
        type: String,
        trim: true,
        default: "",
    },
    file_size: {
        type: Number, // bytes
        default: 0,
    },
    uploaded_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
}, {
    collection: "batch_session_material",
    timestamps: true,
});

batchSessionMaterialSchema.index({ session_id: 1, createdAt: -1 });

module.exports = mongoose.model("batch_session_material", batchSessionMaterialSchema);
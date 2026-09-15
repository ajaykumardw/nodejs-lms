const mongoose = require("mongoose");
const batchLearnerSchema = new mongoose.Schema({
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
        enum: ["nominated", "not_responded", "confirmed", "declined",],
        default: "nominated",
        index: true,
    },
    nominated_at: {
        type: Date,
        default: Date.now,
    },
    responded_at: {
        type: Date,
        default: null,
    },
    confirmed_at: {
        type: Date,
        default: null,
    },
    declined_at: {
        type: Date,
        default: null,
    },
    status_changed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
}, {
    collection: "batch_learner",
    timestamps: true,
});

batchLearnerSchema.index({
    batch_id: 1,
    learner_id: 1,
}, {
    unique: true,
});

module.exports = mongoose.model("batch_learner", batchLearnerSchema);
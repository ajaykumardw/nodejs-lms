const mongoose = require("mongoose");

const batchSessionSchema = new mongoose.Schema({
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch",
        required: true,
        index: true,
    },
    session_date: {
        type: Date,
        required: true,
    },
    start_time: {
        type: String,
        required: true,
    },
    end_time: {
        type: String,
        required: true,
    },
    venue: {
        type: String,
        trim: true,
        default: "",
    },
    session_number: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["scheduled", "completed", "cancelled",],
        default: "scheduled",
    },
}, {
    collection: "batch_session",
    timestamps: true,
});

batchSessionSchema.virtual("trainers", {
    ref: "batch_session_trainer",
    localField: "_id",
    foreignField: "session_id",
});

batchSessionSchema.set("toObject", {
    virtuals: true,
});

batchSessionSchema.set("toJSON", {
    virtuals: true,
});

batchSessionSchema.index({
    batch_id: 1,
    session_number: 1,
});
module.exports = mongoose.model("batch_session", batchSessionSchema);
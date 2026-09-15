const mongoose = require("mongoose");

const batchSessionTrainerSchema = new mongoose.Schema({
    session_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "batch_session",
        required: true,
        index: true,
    },
    trainer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true,
    },
    assigned_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        default: null,
    },
}, {
    collection: "batch_session_trainer",
    timestamps: true,
});

batchSessionTrainerSchema.index({
    session_id: 1,
    trainer_id: 1,
}, {
    unique: true,
});


module.exports = mongoose.model("batch_session_trainer", batchSessionTrainerSchema);
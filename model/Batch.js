const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema({
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module",
        required: true,
        index: true,
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255,
    },
    type: {
        type: String,
        enum: ["nominated", "defined"],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ["draft", "open", "in_progress", "completed", "cancelled",],
        default: "draft",
        index: true,
    },
    capacity: {
        type: Number,
        min: 1,
        default: null
    },
    close_by: {
        type: Date,
        default: null,
    },
    start_date: {
        type: Date,
        default: null,
    },
    end_date: {
        type: Date,
        default: null,
    },
    venue: {
        type: String,
        trim: true,
        default: "",
    },
    cost_per_learner: {
        type: Number,
        min: 0,
        default: 0,
    },
    attachment: {
        file_name: {
            type: String,
            default: "",
        },
        file_url: {
            type: String,
            default: "",
        },
        file_type: {
            type: String,
            default: "",
        },
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        default: null,
    },
}, {
    collection: "batch",
    timestamps: true,
});

batchSchema.virtual("sessions", {
    ref: "batch_session",
    localField: "_id",
    foreignField: "batch_id",
});

batchSchema.virtual("learners", {
    ref: "batch_learner",
    localField: "_id",
    foreignField: "batch_id",
});

batchSchema.index({
    module_id: 1,
    type: 1,
});

batchSchema.set("toObject", {
    virtuals: true,
});

batchSchema.set("toJSON", {
    virtuals: true,
});

module.exports = mongoose.model("batch", batchSchema);
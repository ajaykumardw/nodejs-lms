const mongoose = require("mongoose");

const moduleReminderSchema = new mongoose.Schema(
    {
        module_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Module",
            required: true,
            index: true,
        },

        event: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        ccBuddyTrainer: {
            type: Boolean,
            default: false,
        },

        ccReportingManager: {
            type: Boolean,
            default: false,
        },

        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },

        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000,
        },

        frequency: {
            type: String,
            required: true,
            enum: ["once", "recurring",],
        },

        repeatDays: {
            type: Number,
            required: false,
            min: 0,
        },

        daysBefore: {
            type: Number,
            required: false,
            min: 0,
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
    },
    {
        collection: "module_reminder",
        timestamps: true,
    }
);

module.exports = mongoose.model("module_reminder", moduleReminderSchema);
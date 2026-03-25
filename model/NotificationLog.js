const mongoose = require("mongoose");

const schema = mongoose.Schema;

const notificationLogSchema = new schema({
    attemptNo: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    schedule_date: {
        type: Date,
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "users"
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    template_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "notification_template",
        required: true
    },
    template_name: {
        type: String,
        maxLength: 255,
        required: true
    },
    created_at: {
        type: Date,
        required: true,
        default: Date.now()
    },
    updated_at: {
        type: Date,
        required: false,
        default: Date.now()
    }
}, {
    collection: "notification_log"
});

module.exports = mongoose.model("notificationLog", notificationLogSchema)
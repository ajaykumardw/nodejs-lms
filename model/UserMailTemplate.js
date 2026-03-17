const mongoose = require("mongoose")

const userMailTemplateSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    type: {
        type: String,
        required: true
    }, // 1 for user registration, 2 for forgot password, 3 for scheduling content, 4 for Reminder of course date completion
    template_name: {
        type: String,
        required: true,
        unique: true
    },
    subject: {
        type: String,
        maxlength: 255,
        required: true
    },
    body: {
        type: String,
        maxlength: 10000,
        required: true
    },
    is_edit: {
        type: Boolean,
        enum: [true, false],
        default: false
    },
    status: {
        type: Boolean,
        enum: [true, false],
        default: false
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    created_at: {
        type: Date,
        required: true,
        default: Date.now
    },
    updated_at: {
        type: Date,
        required: true,
        default: Date.now
    }
}, {
    collection: "user_mail_template"
})

module.exports = mongoose.model("UserMailTemplate", userMailTemplateSchema)
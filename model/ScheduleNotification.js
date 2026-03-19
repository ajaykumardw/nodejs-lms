const mongoose = require('mongoose')

const scheduleNotificationSchema = new mongoose.Schema({
    template_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "notification_template"
    },
    module_id: [{
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "modules"
    }],
    user_id: [{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    }],
    attemptNo: {
        type: Number,
        required: true,
        default: 1
    },
    title: {
        type: String,
        maxLength: 255,
    },
    notification_type: {
        type: mongoose.Schema.Types.ObjectId, // 1 = Email,  2 = APP Push Notification, 3 = SMS, 4= WhatsApp Notification
        required: true,
    },
    repeat_type: {
        type: String,
        required: true,
    },
    schedule_type: {
        type: String,
        required: true,
    },
    schedule_target: {
        type: Number, // 1= All, 2= User, 3= Group, 4= Designation, 5= Department, 6= Region, 7= Zone, 8= Participation Type
        required: true
    },
    audience: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function (value) {
                return (
                    typeof value === "string" ||
                    (Array.isArray(value) && value.every(v => typeof v === "string"))
                );
            },
            message: "Audience must be a string or an array of strings"
        }
    },
    schedule_user_id: [{
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "users"
    }],
    schedule_days: {
        type: String,
        required: false,
        default: null
    },
    is_send: {
        type: Boolean,
        default: false
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    updated_at: {
        type: Date,
        default: null
    }
}, {
    collection: 'schedule_notification'
})

module.exports = mongoose.model('ScheduleNotification', scheduleNotificationSchema)
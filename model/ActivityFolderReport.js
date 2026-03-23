const mongoose = require('mongoose')

const UserActivityLog = new mongoose.Schema({
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Module"
    },
    program_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Program"
    },
    current_attempt: {
        type: Number,
        required: true,
        default: 1,
    },
    content_folder_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "ContentFolder"
    },
    activity_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Activity"
    },
    module_type_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    progress_status: {
        type: String,
        required: true,
        default: "1"
    },
    view_page_no: [{
        type: String,
        default: null,
    }],
    total_page_no: {
        type: String,
        default: "1"
    },
    current_page_no: {
        type: String,
        default: null,
    },
    total_video_time: {
        type: String,
        default: null,
    },
    current_video_time: {
        type: String,
        default: null,
    },
    viewed_video_time: {
        type: String,
        default: null,
    },
    is_completed: {
        type: Boolean,
        default: false,
    },
    is_reattempt_left: {
        type: Boolean,
        default: true,
    },
    attempt_left: {
        type: String,
        required: false
    },
    is_passed: {
        type: Boolean,
        default: false,
    },
    mark_percentage: {
        type: String,
        default: "0"
    },
    completion_percentage: {
        type: String,
        default: "0"
    },
    passed_at_time: {
        type: Date,
        required: false,
        default: null
    },
    start_activity_time: {
        type: Date,
        required: false,
        default: null
    },
    end_activity_time: {
        type: Date,
        required: false,
        default: null
    },
    completed_at_time: {
        type: Date,
        required: false,
        default: null
    },
    scorm_data: {
        exit: {
            type: String,
            default: null
        },
        scoreRaw: {
            type: Number,
            default: 0
        },
        passed_at_time: {
            type: Date,
            default: null
        },
        scoreMin: {
            type: Number,
            default: 0
        },
        scoreMax: {
            type: Number,
            default: 0
        },
        lessonStatus: {
            type: String,
            default: null
        },
        sessionTime: {
            type: Date,
            default: null
        },
        totalTime: {
            type: Date,
            default: null
        },
        suspendData: {
            type: String,
            default: null
        },
        lastSlide: {
            type: String,
            default: null
        },
        lastTime: {
            type: Date,
            default: null
        }
    },
    is_notification_send: {
        type: Boolean,
        default: false
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId
    },
    created_at: {
        type: Date,
        default: Date.now()
    },
    upated_at: {
        type: Date,
        default: null
    }
}, {
    collection: "activity_logs"
})


module.exports = mongoose.model("ActivityLog", UserActivityLog)
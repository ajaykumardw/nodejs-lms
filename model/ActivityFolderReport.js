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
    view_page_no: [{
        type: String,
    }],
    total_page_no: {
        type: String,
        default: "1"
    },
    current_page_no: {
        type: String,
    },
    total_video_time: {
        type: String,
    },
    current_video_time: {
        type: String,
    },
    viewed_video_time: {
        type: String,
    },
    completion_percentage: {
        type: String,
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
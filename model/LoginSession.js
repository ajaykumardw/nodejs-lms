const mongoose = require("mongoose")

const logSessionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "users"
    },
    session_type: {
        type: String,
        required: true,
        default: "1"
    },
    ip_address: {
        type: String,
        maxlength: 255,
        required: true
    },
    activity_time: {
        type: Date,
        required: true,
    }
}, {
    collection: "log_session"
})

module.exports = mongoose.model('logSession', logSessionSchema)
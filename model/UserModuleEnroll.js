const mongoose = require('mongoose')

const userModuleEnroll = new mongoose.Schema({
    module_id: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "Module"
    },
    schedule_id: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "program_schedules"
    },
    user_id: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "users"
    },
    created_by: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "users"
    },
    created_at: {
        type: Date,
        required: true,
        default: Date.now()
    }
}, {
    collection: "user_module_enroll"
})

module.exports = mongoose.model("userModuleEnroll", userModuleEnroll)
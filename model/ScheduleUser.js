const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const scheduleUserSchema = new Schema({
    company_id: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT
        required: true, // company_id is required
        ref: 'users', // Reference to 'companies' collection
    },
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Module"
    },
    schedule_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "program_schedules"
    },
    type: {
        type: String, // VARCHAR(255)
        maxlength: 255, // Limit length to 255 characters
        required: true, // type is required
    },
    type_id: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT
        required: true, // type_id is required
        ref: "users"
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT
        required: true, // type_id is required
        ref: "users"
    },
    created_at: {
        type: Date, // TIMESTAMP
        required: true, // created_at is required
        default: Date.now, // Default to current date/time
    },
}, {
    collection: "schedule_users"
});

module.exports = mongoose.model('schedule_user', scheduleUserSchema); // Model name 'ScheduleUser'

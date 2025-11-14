const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const scheduleTypeSchema = new Schema({
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "companies"
    },
    schedule_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "program_schedules"
    },
    type: {
        type: String,
        maxlength: 1, // "1"=Designation, "2"=Department, "3"=Group, "4"=Region, "5"=User
        required: true,
    },
    type_id: {
        type: mongoose.Schema.Types.ObjectId, // ID of designation/department/group/region/user
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: null
    }
}, { collection: "schedule_type" });


module.exports = mongoose.model('schedule_type', scheduleTypeSchema);

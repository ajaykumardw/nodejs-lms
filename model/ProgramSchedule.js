const mongoose = require('mongoose');

const ProgramScheduleSchema = new mongoose.Schema({
    program_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    content_folder_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    activity_id: [
        {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    ],
    company_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    pushEnrollmentSetting: { type: Number, required: true, default: 3 },
    selfEnrollmentSetting: { type: Number, required: true, default: 3 },
    lockModule: { type: Boolean, required: true, default: false },
    dueType: { type: String, enum: ["fixed", "relative"], required: true },
    dueDate: { type: String, default: null },
    dueDays: { type: String, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: null },
}, { collection: "program_schedules" });

module.exports = mongoose.model("program_schedules", ProgramScheduleSchema);

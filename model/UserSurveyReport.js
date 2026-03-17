const mongoose = require('mongoose')

const userSurveyReportSchema = new mongoose.Schema({
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module",
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    survey_data: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: null
    }
}, {
    collection: "user_survey_report"
})

module.exports = mongoose.model('UserSurveyReport', userSurveyReportSchema)

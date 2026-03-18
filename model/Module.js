const mongoose = require('mongoose');
const schema = mongoose.Schema;

const moduleSchema = new schema({
    content_folder_id: {
        type: schema.Types.ObjectId,
        ref: "ContentFolder",
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 255,
    },
    description: {
        type: String,
        required: true,
        maxlength: 5000,
    },
    presenter_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: false,
        default: null
    },
    start_live_time: {
        type: Date,
        required: false,
        default: null
    },
    end_live_time: {
        type: Date,
        required: false ,
        default: null
    },
    image_url: {
        type: String,
        required: true,
        maxlength: 255
    },
    live_session_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    module_type_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    is_survey_done: {
        type: Boolean,
        required: true,
        default: false
    },
    is_survey_completed: {
        type: Boolean,
        required: true,
        default: false
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    collection: "modules"
});

moduleSchema.virtual('activity_logs', {
    ref: 'ActivityLog',
    localField: '_id',
    foreignField: 'module_id'
});

moduleSchema.virtual("moduleSetting", {
    ref: "ModuleSetting",
    localField: "_id",
    foreignField: "moduleId",
    justOne: true
})

moduleSchema.virtual("moduleSurvey", {
    ref: "ModuleSurvey",
    localField: "_id",
    foreignField: "moduleId",
})

moduleSchema.set('toObject', { virtuals: true })
moduleSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Module', moduleSchema);
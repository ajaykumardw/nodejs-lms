const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: false,
        maxLength: 255
    },
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Module'
    },
    module_type_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    document_data: {
        title: {
            type: String,
            maxLength: 255
        },
        page_no: {
            type: String,
            maxLength: 255
        },
        image_url: {
            type: String,
            maxLength: 255
        },
        downloadable: {
            type: Boolean,
            default: false
        },
        shareable: {
            type: Boolean,
            default: false
        }
    },
    video_data: {
        title: {
            type: String,
            maxLength: 255
        },
        video_url: {
            type: String,
            maxLength: 255
        }
    },
    youtube_data: {
        title: {
            type: String,
            maxLength: 255
        },
        video_url: {
            type: String,
            maxLength: 255
        }
    },
    scrom_data: {
        title: {
            type: String,
            maxLength: 255
        },
        content_url: {
            type: String,
            maxLength: 255
        }
    },
    quiz_data: {
        title: {
            type: String,
            maxLength: 255
        },
        question_data: [{
            title: {
                type: String,
                required: true,
                maxLength: 255
            },
            explanation: {
                type: String,
                required: true,
                maxLength: 500
            },
            mark: {
                type: Number,
                required: true
            },
            question_level: {
                type: Number,
                required: true
            },
            option: [{
                title: {
                    type: String,
                    required: true,
                    maxLength: 255
                }
            }]
        }]
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
    collection: 'activity'
});

activitySchema.virtual('logs', {
    ref: 'ActivityLog',
    localField: '_id',
    foreignField: 'activity_id'
});

activitySchema.virtual('questions', {
    ref: 'questions',
    localField: '_id',
    foreignField: 'activity_id'
});

activitySchema.virtual("quiz_reports", {
    ref: "quiz_result_report",
    localField: "_id",
    foreignField: "activity_id"
});

activitySchema.set('toObject', {
    virtuals: true
});
activitySchema.set('toJSON', {
    virtuals: true
});

module.exports = mongoose.model('Activity', activitySchema);
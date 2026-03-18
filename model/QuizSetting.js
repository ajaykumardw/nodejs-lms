const mongoose = require("mongoose")

const quizSettingSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    activity_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    module_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    questionsView: {
        type: String,
        required: true,
        default: "all",
        maxlength: 255
    },
    orderSetting: {
        type: String,
        required: true,
        default: "sameOrder",
        maxlength: 255
    },
    passCriteria: {
        type: Number,
        default: 1
    },
    reattempts: {
        type: String,
        default: "0"
    },
    timing: {
        type: {
            type: String,
            maxlength: 255,
            default: "notTimed"
        },
        duration: {
            type: Number,
            default: 1,
        },
        forwardNav: {
            type: Boolean,
            default: false,
        }
    },
    marking: {
        easy: {
            correct: {
                type: Number,
                default: 1,
            },
            wrong: {
                type: Number,
                default: 0,
            }
        },
        medium: {
            correct: {
                type: Number,
                default: 2,
            },
            wrong: {
                type: Number,
                default: 0,
            }
        },
        difficult: {
            correct: {
                type: Number,
                default: 3,
            },
            wrong: {
                type: Number,
                default: 0,
            }
        }
    },
    otherSettings: {
        allowSkipQuestions: {
            type: Boolean,
            default: false,
        },
        completeOnlyIfPassed: {
            type: Boolean,
            default: false,
        },
        hideResults: {
            type: Boolean,
            default: false,
        },
        isMandatory: {
            type: Boolean,
            default: false,
        },
        revealAnswers: {
            type: Boolean,
            default: false,
        },
        revealCorrectness: {
            type: Boolean,
            default: false,
        }
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'users',
    },
    created_at: {
        type: Date,
        required: true,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        required: false,
    },
})

module.exports = mongoose.model('quiz_setting', quizSettingSchema); // Model name 'Question
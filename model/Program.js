const mongoose = require('mongoose')

const programSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        maxLength: 255,
    },
    description: {
        type: String,
        required: true,
        maxLength: 1000,
    },
    image_url: {
        type: String,
        required: true,
        maxLength: 255,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now(),
    },
    updated_at: {
        type: Date,
        required: false,
    }
}, {
    collection: "programs",
})

programSchema.virtual('content_folders', {
    ref: 'ContentFolder',
    localField: '_id',
    foreignField: 'program_id',
    justOne: false,
});

programSchema.set('toObject', { virtuals: true });
programSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Program', programSchema)
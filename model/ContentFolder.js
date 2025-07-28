const mongoose = require('mongoose')

const contentFolderSchema = new mongoose.Schema({
    program_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Program"
    },
    title: {
        type: String,
        required: true,
        maxLength: 255,
    },
    description: {
        type: String,
        required: true,
        maxLength: 255,
    },
    image_url: {
        type: String,
        required: true,
        maxLength: 255,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now()
    }
}, {
    collection: "content_folder"
})

contentFolderSchema.virtual('modules', {
    localField: '_id', 
    foreignField: ''
})

contentFolderSchema.set('toObject', { virtuals: true })
contentFolderSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model("ContentFolder", contentFolderSchema)
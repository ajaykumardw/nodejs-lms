const mongoose = require('mongoose');
const schema = mongoose.Schema;

const moduleSchema = new schema(
    {
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
        image_url: {
            type: String,
            required: true,
            maxLength: 255
        },
        live_session_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: false
        },
        module_type_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
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
    },
    {
        collection: "modules"
    });

module.exports = mongoose.model('Module', moduleSchema);

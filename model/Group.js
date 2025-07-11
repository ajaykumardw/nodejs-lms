const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const groupSchema = new Schema({
    name: {
        type: String,
        maxlength: 255, // Limit the length of the name
        required: true, // name is required
    },
    description: {
        type: String,
        maxlength: 1000, // Maximum length for TEXT
        required: false, // description is optional
    },
    autoAssign: {
        type: Boolean,
        default: false
    },
    status: {
        type: Boolean,
        required: true, // status is required
    },
    userId: [{
        type: String,
        required: true
    }],
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // company_id is required
        ref: 'users', // Assuming there's a 'companies' collection to reference
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    created_at: {
        type: Date,
        required: false, // created_at is optional
        default: Date.now(), // Set the default to the current date/time
    },
    updated_at: {
        type: Date,
        required: false, // updated_at is optional
    },
});

module.exports = mongoose.model('groups', groupSchema); // Model name 'Group'

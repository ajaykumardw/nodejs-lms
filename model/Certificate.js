const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const certificateSchema = new Schema({
    templateName: {
        type: String,
        maxlength: 255, // Limit the length to 255 characters
        required: true, // name is required
    },
    logoURL: {
        type: String,
        maxlength: 5000,
        default: 'demo39.svg',
        required: false,
    },
    title: {
        type: String,
        maxlength: 255,
        required: true,
    },
    content: {
        type: String,
        maxlength: 255, // Maximum length for LONGTEXT
        required: true, // template is required
    },
    content2: {
        type: String,
        maxlength: 255, // Maximum length for LONGTEXT
        required: true, // template is required
    },
    backgroundImage: {
        type: String,
        maxlength: 5000, // Limit the length to 255 characters
        default: 'bg1.jpg',
        required: false, // name is required
    },
    signatureContent: {
        type: String,
        maxlength: 255, // Limit the length to 255 characters
        required: false, // name is required
    },
    signatureName: {
        type: String,
        maxlength: 255, // Limit the length to 255 characters
        required: false, // name is required
    },
    signatureContent: {
        type: String,
        maxlength: 255, // Limit the length to 255 characters
        required: false, // name is required
    },
    signatureURL: {
        type: String,
        maxlength: 5000, // Limit the length to 255 characters
        required: false, // name is required
    },
    signatureName2: {
        type: String,
        maxlength: 255, // Limit the length to 255 characters
        required: false, // name is required
    },
    signatureContent2: {
        type: String,
        maxlength: 255, // Limit the length to 255 characters
        required: false, // name is required
    },
    signatureURL2: {
        type: String,
        maxlength: 5000,
        required: false,
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // company_id is required
        ref: 'users', // Reference to 'companies' collection
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true, // created_by is required
        ref: 'users', // Reference to 'users' collection (assuming there's a users collection)
    },
    created_at: {
        type: Date,
        required: true, // created_at is required
        default: Date.now, // Default to current date/time
    },
    updated_at: {
        type: Date,
        required: false, // updated_at is optional
    },
});

module.exports = mongoose.model('certificates', certificateSchema); // Model name 'Certificate'

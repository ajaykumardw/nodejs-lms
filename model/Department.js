const mongoose = require('mongoose')

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 50,
    },
    status: {
        type: Boolean,
        required: false,
        default: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT 
        required: true, // created_by is required
        ref: 'users', // Reference to 'users' collection
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT 
        required: true, // company_id is required
        ref: 'users', // Reference to 'companies' collection
    },
    created_at: {
        type: Date, // DATETIME 
        required: true, // created_at is required
        default: Date.now, // Default to current date/time
    },
    updated_at: {
        type: Date, // TIMESTAMP 
        required: false, // updated_at is optional
    },
})

module.exports = mongoose.model('department', departmentSchema)
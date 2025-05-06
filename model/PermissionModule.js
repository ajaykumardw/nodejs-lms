const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const permissionModuleSchema = new Schema({
    name: {
        type: String, // VARCHAR(255) 
        maxlength: 255, // Limit the length to 255 characters
        required: true, // name is required
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT 
        required: true, // company_id is required
        ref: 'users', // Reference to 'companies' collection
    },
    status: {
        type: Boolean,
        required: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId, // BIGINT 
        required: true, // created_by is required
        ref: 'users', // Reference to 'users' collection (assuming there's a 'users' collection)
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
    permission: {
        items: [{
            permission_module_id: {
                type: mongoose.Schema.Types.ObjectId, // BIGINT 
                required: true, // permission_module_id is required
                ref: 'permission_modules', // Reference to 'permission_modules' collection
            },
            name: {
                type: String, // VARCHAR(255) 
                maxlength: 255, // Limit the length to 255 characters
                required: true, // name is required
            },
            slug: {
                type: String, // VARCHAR(255) 
                maxlength: 255, // Limit the length to 255 characters
                required: true, // slug is required
            },
            created_by: {
                type: mongoose.Schema.Types.ObjectId, // BIGINT 
                required: true, // created_by is required
                ref: 'users', // Reference to 'users' collection
            },
            created_at: {
                type: Date, // DATETIME 
                required: true, // created_at is required
                default: Date.now, // Default to current date/time
            },
            updated_at: {
                type: Date, // TIMESTAMP 
                required: false, // updated_at is optional
            }
        }]
    }
});

module.exports = mongoose.model('permission_modules', permissionModuleSchema); // Model name 'PermissionModule'

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const packageTypeSchema = new Schema({
    name: {
        type: String, // VARCHAR 
        minlength: 4,
        maxlength: 25, // Limit for VARCHAR(255)
        required: true, // Name is required
    },
    status: {
        type: Boolean,
        required: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    package: {
        items: [
            {
                name: {
                    type: String,
                    maxlength: 255, // Limit for VARCHAR(255)
                    required: true, // Name is required
                },
                description: {
                    type: String,
                    maxlength: 65535, // Maximum length for LONGTEXT (though MongoDB will store it as a large string)
                    required: false, // Assuming description is optional
                },
                package_type_id: {
                    type: Number,
                    required: false, // Can be null
                    ref: "package_types",
                },
                status: {
                    type: String,
                    enum: ['active', 'inactive'], // Only these two values are allowed
                    required: true, // Status is required
                },
                amount: {
                    type: Number,
                    required: false, // Amount is optional (can be null)
                },
                created_at: {
                    type: Date,
                    required: false, // Created date is optional
                    default: Date.now()
                },
                updated_at: {
                    type: Date,
                    required: false, // Updated date is optional
                },
            }
        ],
    }
});

module.exports = mongoose.model('package_types', packageTypeSchema); // Model name 'Package'

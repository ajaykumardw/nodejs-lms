const mongoose = require('mongoose');

const schema = mongoose.Schema;

const roleSchema = new schema({
    company_id: {
        type: schema.Types.ObjectId,
        required: true,
        ref: "users"
    },
    name: {
        type: String,
        required: true,
        maxlength: 255,
    },
    description: {
        type: String,
        required: true,
        maxlength: 5000,
    },
    type: {
        type: Boolean,
        required: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    // permission: {}
});

module.exports = mongoose.model('roles', roleSchema);
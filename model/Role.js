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
    // permission: {}
});

module.exports = mongoose.model('roles', roleSchema);
const mongoose = require('mongoose')

const schema = mongoose.Schema;

const roleUserSchema = new schema({
    role_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "roles",
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
});

module.exports = mongoose.model('role_user', roleUserSchema);
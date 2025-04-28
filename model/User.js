const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    company_id: {
        type: Schema.Types.ObjectId, // Same note: use String or Number if needed
        required: false,
        ref: "users",
    },
    first_name: {
        type: String,
        required: true,
        maxlength: 255
    },
    last_name: {
        type: String,
        maxlength: 255
    },
    email: {
        type: String,
        maxlength: 255
    },
    phone: {
        type: String,
        maxlength: 255
    },
    status: {
        type: Boolean,
    },
    dob: {
        type: Date
    },
    address: {
        type: String
    },
    country_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "countries",
    },
    state_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "states"
    },
    city_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cities"
    },
    photo: {
        type: String
    },
    is_verified: {
        type: Boolean
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    },
    deleted_at: {
        type: Date
    },
    created_by: {
        type: Number
    },
    master_company_id: {
        type: mongoose.Schema.Types.ObjectId, // Again, consider String or Number
        ref: "users"
    },
    parent_company_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    },
});

module.exports = mongoose.model("users", userSchema);

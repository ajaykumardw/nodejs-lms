const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    company_id: {
        type: Schema.Types.ObjectId, // Same note: use String or Number if needed
        required: true,
        ref: "users",
    },
    first_name: {
        type: String,
        required: true,
        maxlength: 255,
    },
    last_name: {
        type: String,
        maxlength: 255,
        required: true,
    },
    email: {
        type: String,
        maxlength: 255,
        required: true,
    },
    password: {
        type: String,
        maxlength: 255,
        required: true,
    },
    phone: {
        type: String,
        maxlength: 255,
        required: true,
    },
    status: {
        type: Boolean,
        default: 0,
    },
    dob: {
        type: Date,
        required: true,
    },
    address: {
        type: String,
        maxlength: 4000,
    },
    country_id: {
        type: Schema.Types.ObjectId,
        ref: "countries",
    },
    state_id: {
        type: Schema.Types.ObjectId,
        ref: "states"
    },
    city_id: {
        type: Schema.Types.ObjectId,
        ref: "cities"
    },
    photo: {
        type: String,
        maxlength: 255
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
        type: Number,
        ref: "users",
        required: true,
    },
    master_company_id: {
        type: Schema.Types.ObjectId, // Again, consider String or Number
        ref: "users",
        required: true,
    },
    parent_company_id: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
});

module.exports = mongoose.model("users", userSchema);

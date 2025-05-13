const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const userSchema = new Schema({
    company_id: {
        type: Schema.Types.Mixed,
        required: true,
        ref: "users",
        validate: {
            validator: v => Types.ObjectId.isValid(v) || typeof v === 'number',
            message: props => `${props.value} is not a valid ObjectId or number`,
        },
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
    company_name: {
        type: String,
        maxlength: 255,
        required: false
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
    address: {
        type: String,
        maxlength: 4000,
    },
    pincode: {
        type: String,
        required: true,
        minLength: 6,
        maxlength: 10
    },
    package_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "package"
    },
    country_id: {
        type: String,
        ref: "countries",
        required: true,
    },
    state_id: {
        type: String,
        required: true,
    },
    city_id: {
        type: String,
        required: true,
    },
    gst_no: {
        type: String,
        required: false,
    },
    pan_no: {
        type: String,
        required: false,
    },
    website: {
        type: String,
        required: false,
    },
    photo: {
        type: String,
        // maxlength: 255
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
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    master_company_id: {
        type: Schema.Types.Mixed,
        ref: "users",
        required: true,
        validate: {
            validator: v => Types.ObjectId.isValid(v) || typeof v === 'number',
            message: props => `${props.value} is not a valid ObjectId or number`,
        },
    },
    parent_company_id: {
        type: Schema.Types.Mixed,
        ref: "users",
        required: true,
        validate: {
            validator: v => Types.ObjectId.isValid(v) || typeof v === 'number',
            message: props => `${props.value} is not a valid ObjectId or number`,
        },
    },
});

module.exports = mongoose.model("users", userSchema);

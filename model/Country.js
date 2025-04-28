const mongoose = require('mongoose')

const Schema = mongoose.Schema;

const countrySchema = new Schema({
    name: {
        type: String,
        required: true,
        maxlength: 255,
    },
    short_name: {
        type: String,
        required: true,
        maxlength: 255
    }
});

module.exports = mongoose.model("countries", countrySchema);
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const stateSchema = new Schema({
    name: {
        type: String,
        required: true,
        maxlength: 255,
    },
});

module.exports('states', stateSchema)
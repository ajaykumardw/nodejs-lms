const mongoose = require('mongoose')

const schema = mongoose.Schema;

const citySchema = new schema({
    name: {
        type: String,
        required: true,
        maxlength: 255,
    },
});

module.exports('cities', citySchema)
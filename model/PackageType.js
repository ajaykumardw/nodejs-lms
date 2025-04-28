const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const packageTypeSchema = new Schema({
    name: {
        type: String, // VARCHAR 
        maxlength: 255, // Limit for VARCHAR(255)
        required: true, // Name is required
    },
});

module.exports = mongoose.model('package_types', packageTypeSchema); // Model name 'Package'

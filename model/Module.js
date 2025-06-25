const mongoose = require('mongoose');
const schema = mongoose.Schema;

const cards = new mongoose.Schema({
    title: {
      type: String,
      required: true,
    },
    value: {
        type: String,
        required: true,
    },
    content: {
        type: mongoose.Schema.Types.Mixed, // flexible structure per content_type
        default: {}
      },
    created_at: {
        type: Date, 
        default: Date.now
    },
  }, { _id: true });


  const settings = new mongoose.Schema({
    leaderboard_points: {
      type: String,
      required: false
    }
  }, { _id: false });

const moduleSchema = new schema({
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "users"
    },
    title: {
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
        type: Number,
        required: false,
        ref: "module_types"
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "categories"
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft', 'published'],
        required: false
    },
    duration: {
        type: Number, 
        required: false
    },
    certificate_id: {
        type: Number, 
        required: false,
        ref: "certificates"
    },
    created_by: {
        type: Number, 
        required: false
    },
    created_at: {
        type: Date, 
        default: Date.now
    },
    updated_at: {
        type: Date, 
        default: Date.now
    },
    cards: [cards], // Array of cards
    settings: settings, // Array of cards
});

module.exports = mongoose.model('modules', moduleSchema);

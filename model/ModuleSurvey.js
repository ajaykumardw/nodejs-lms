const mongoose = require('mongoose');
const { Schema } = mongoose;

const moduleSurveySchema = new Schema({
    moduleId: { type: Schema.Types.ObjectId, ref: 'modules', required: true },
    question: { type: String, required: true, maxlength: 500 },
    questionsType: { type: String, required: true },
    mandatory: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('ModuleSurvey', moduleSurveySchema);    
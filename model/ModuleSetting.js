const mongoose = require('mongoose');
const { Schema } = mongoose;

const moduleSettingSchema = new Schema({
    moduleId: { type: Schema.Types.ObjectId, ref: 'modules', required: true },
    orderType: { type: String, required: true, maxlength: 50 },
    feedbackSurveyEnabled: { type: Boolean, default: false },
    mandatory: { type: Boolean, default: false },
    certificateEnabled: { type: Boolean, default: false },
    selectedCertificateId: { type: Schema.Types.ObjectId, ref: 'certificates' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ModuleSetting', moduleSettingSchema);
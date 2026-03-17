const ModuleSetting = require("../../model/ModuleSetting");
const { successResponse } = require("../../util/response");

exports.getModuleSettingAPI = async (req, res, next) => {
    try {
        const { moduleId } = req.params;
        const userId = req.userId;


        const moduleSetting = await ModuleSetting.findOne({
            moduleId,
            createdBy: userId
        });

        return successResponse(res, "Module settings retrieved successfully", moduleSetting || {});

    }
    catch (error) {

        next(error);
    }
}

exports.postModuleSettingAPI = async (req, res, next) => {
    try {
        const { moduleId } = req.params;
        const { orderType, selectedCertificateId, certificateEnabled, feedbackSurveyEnabled, mandatory } = req.body;
        const userId = req.userId;

        const existingSetting = await ModuleSetting.findOne({
            moduleId,
            createdBy: userId
        });

        if (existingSetting) {
            await ModuleSetting.findOneAndUpdate({
                moduleId,
                createdBy: userId
            }, {
                learner_order: orderType,
                certificate_id: certificateEnabled ? selectedCertificateId : null,
                updatedAt: Date.now(),
                moduleId,
                orderType,
                selectedCertificateId,
                certificateEnabled,
                feedbackSurveyEnabled,
                mandatory,
                createdBy: userId
            })
        } else {
            const newSetting = new ModuleSetting({
                learner_order: orderType,
                certificate_id: certificateEnabled ? selectedCertificateId : null,
                updatedAt: Date.now(),
                moduleId,
                orderType,
                selectedCertificateId,
                certificateEnabled,
                feedbackSurveyEnabled,
                mandatory,
                createdBy: userId
            })

            await newSetting.save();
        }

        return successResponse(res, "Module settings saved successfully");

    } catch (error) {
        next(error);
    }
}
const UserMailTemplate = require("../../model/UserMailTemplate");
const { successResponse } = require("../../util/response");

exports.getMailTemplateController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const templates = await UserMailTemplate.find({
            created_by: userId,
            user_id: userId
        })

        return successResponse(res, "Moil template fetched successfully", templates)

    } catch (error) {
        next(error)
    }
}

exports.postMailTemplateController = async (req, res, next) => {
    try {
    } catch (error) {
        next(error)
    }
}

exports.putMailTemplateController = async (req, res, next) => {
    try {
    } catch (error) {
        next(error)
    }
}
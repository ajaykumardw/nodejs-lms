const User = require("../../model/User")
const Module = require("../../model/Module")
const UserSurveyReport = require("../../model/UserSurveyReport");
const { errorResponse, successResponse } = require("../../util/response");

exports.getSurveyDetail = async (req, res, next) => {
    try {

        const { moduleId } = req?.params;
        const userId = req?.userId;

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user.created_by;

        const module = await Module.findOne({
            _id: moduleId,
            created_by: masterId
        })
            .populate('moduleSurvey')
            .populate('moduleSetting')

        if (!module) {
            return errorResponse(res, "Module does not exist", {}, 404)
        }

        return successResponse(res, "Module fetched successfully", module)

    } catch (error) {
        next(error)
    }
}

exports.postSuveyDetail = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const { moduleId } = req?.params;

        const { data } = req?.body;

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user.created_by;

        const userSurvey = await UserSurveyReport.findOne({
            user_id: userId,
            module_id: moduleId
        })

        if (userSurvey) {

            await UserSurveyReport.findOneAndUpdate({
                user_id: userId,
                module_id: moduleId
            }, {
                created_by: userId,
                survey_data: data
            })

        } else {

            const user_survey = new UserSurveyReport({
                module_id: moduleId,
                user_id: userId,
                survey_data: data,
                created_by: userId
            })

            await user_survey.save();

        }

        await Module.findOneAndUpdate({
            _id: moduleId,
            created_by: masterId
        }, {
            is_survey_done: true,
            is_survey_completed: true
        })

        return successResponse(res, "Survey completed for user")

    } catch (error) {
        next(error)
    }
}
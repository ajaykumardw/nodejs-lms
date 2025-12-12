const QuizSetting = require("../../model/QuizSetting");
const { successResponse } = require("../../util/response");

exports.getQuizSettingData = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const moduleId = req?.params?.mId;
        const activityId = req?.params?.aId;

        const quizSetting = await QuizSetting.findOne({
            module_id: moduleId,
            activity_id: activityId,
            user_id: userId,
            created_by: userId,
        })

        return successResponse(res, "Quiz fetched successfully", quizSetting)

    } catch (error) {
        next(error)
    }
}

exports.postQuizSettingController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const data = req?.body;

        const moduleId = req?.params?.mId;
        const activityId = req?.params?.aId;


        const quizSetting = await QuizSetting.findOne({
            module_id: moduleId,
            activity_id: activityId,
            user_id: userId,
            created_by: userId,
        })

        if (!quizSetting) {

            const quiz_setting = new QuizSetting({
                user_id: userId,
                activity_id: activityId,
                module_id: moduleId,
                created_by: userId,
                ...data
            })

            await quiz_setting.save()

        } else {

            await QuizSetting.findOneAndUpdate({
                user_id: userId,
                activity_id: activityId,
                module_id: moduleId,
                created_by: userId,
            }, {
                ...data
            })

        }

        return successResponse(res, "Quiz saved successfully", {})

    } catch (error) {
        next(error)
    }
}
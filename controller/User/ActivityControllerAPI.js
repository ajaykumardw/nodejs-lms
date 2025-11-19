const Activity = require("../../model/Activity")
const User = require("../../model/User")
const Module = require("../../model/Module");
const {
    successResponse
} = require("../../util/response");

exports.getActivityData = async (req, res, next) => {
    try {

        const id = req?.params?.id;
        const userId = req?.userId

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user?.master_company_id;

        const module = await Module.findById(id)

        const activity = await Activity.find({
            module_id: id,
            created_by: masterId,
        })

        return successResponse(res, "Activity fetched successfully", {
            moduleInfo: module,
            activities: activity
        })

    } catch (error) {
        next(error)
    }
}

exports.getFetchActivity = async (req, res, next) => {
    try {

        const id = req.params.id;

        const userId = req?.userId;

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user?.master_company_id;

        const activity = await Activity.findOne({
            _id: id,
            created_by: masterId,
        })

        return successResponse(res, "Activity fetched", activity)

    } catch (error) {
        next(error)
    }
}
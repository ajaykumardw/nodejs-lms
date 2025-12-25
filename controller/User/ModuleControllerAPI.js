const User = require('../../model/User')
const Module = require("../../model/Module");
const ContentFolder = require("../../model/ContentFolder");

const {
    errorResponse,
    successResponse
} = require('../../util/response');

exports.getModuleAPIController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user?.master_company_id;

        const id = req?.params?.id;

        const contentFolder = await ContentFolder.findById(id)
            .populate('activity_logs');

        const module = await Module.find({
            content_folder_id: id,
            created_by: masterId
        }).populate('activity_logs');

        if (!module) {
            return errorResponse(res, "Module does not exist", {}, 404)
        }

        return successResponse(res, "Module fetched successfully", {
            courseDetails: contentFolder,
            courses: module
        })

    } catch (error) {
        next(error)
    }
}
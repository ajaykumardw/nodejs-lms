const Activity = require("../../model/Activity")
const User = require("../../model/User")
const Module = require("../../model/Module");
const ContentFolder = require('../../model/ContentFolder')
const ActivityFolderReport = require('../../model/ActivityFolderReport')

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
            created_by: masterId
        }).populate('logs');

        return successResponse(res, "Activity fetched", activity)

    } catch (error) {
        next(error)
    }
}

exports.postReportController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const activityId = req?.params?.activityId;
        const moduleId = req?.params?.moduleId;
        const contentFolderId = req?.params?.contentFolderId;
        const moduleTypeId = req?.params?.moduleTypeId;

        const {
            currentPage,
            totalPages,
            viewedPages
        } = req.body

        const contentFolder = await ContentFolder.findById(contentFolderId)

        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            created_by: userId,
            activity_id: activityId
        })

        const viewed = viewedPages.length;

        const perComplete = (Number(viewed) / Number(totalPages)) * 100

        if (!activityReport) {

            const activity_report = new ActivityFolderReport({
                user_id: userId,
                program_id: contentFolder.program_id,
                created_by: userId,
                activity_id: activityId,
                module_id: moduleId,
                content_folder_id: contentFolderId,
                module_type_id: moduleTypeId,
                completion_percentage: perComplete,
                total_page_no: totalPages,
                current_page_no: currentPage,
                view_page_no: viewedPages
            })

            await activity_report.save()

        } else {

            await ActivityFolderReport.findOneAndUpdate({
                user_id: userId,
                created_by: userId,
                activity_id: activityId
            }, {
                user_id: userId,
                program_id: contentFolder.program_id,
                created_by: userId,
                activity_id: activityId,
                module_id: moduleId,
                content_folder_id: contentFolderId,
                module_type_id: moduleTypeId,
                completion_percentage: perComplete,
                total_page_no: totalPages,
                current_page_no: currentPage,
                view_page_no: viewedPages
            })

        }

        return successResponse(res, "Activity report successfull", viewedPages)

    } catch (error) {
        next(error)
    }
}
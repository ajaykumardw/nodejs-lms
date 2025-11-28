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
        }).populate('logs');

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
            viewedPages,
            currentVideoTime,
            totalVideoTime,
            viewedVideoTime
        } = req.body

        const contentFolder = await ContentFolder.findById(contentFolderId)

        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            created_by: userId,
            activity_id: activityId
        })

        let perComplete;

        if (moduleTypeId == "688723af5dd97f4ccae68834") {

            const viewed = viewedPages.length;

            perComplete = (Number(viewed) / Number(totalPages)) * 100
        } else if (moduleTypeId == "688723af5dd97f4ccae68836" || moduleTypeId == "688723af5dd97f4ccae68835") {
            const roundedViewed = Math.round(Number(viewedVideoTime));

            perComplete = Number(totalVideoTime) > 0 ?
                (roundedViewed / Number(totalVideoTime)) * 100 :
                0;
        }


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
                view_page_no: viewedPages,
                viewed_video_time: Math.round(Number(viewedVideoTime)),
                current_video_time: Math.round(Number(currentVideoTime)),
                total_video_time: totalVideoTime

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
                view_page_no: viewedPages,
                viewed_video_time: Math.round(Number(viewedVideoTime)),
                current_video_time: Math.round(Number(currentVideoTime)),
                total_video_time: totalVideoTime
            })

        }

        return successResponse(res, "Activity report successfull", viewedPages)

    } catch (error) {
        next(error)
    }
}
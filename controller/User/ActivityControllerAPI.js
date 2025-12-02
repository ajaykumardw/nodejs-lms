const Activity = require("../../model/Activity")
const User = require("../../model/User")
const Question = require("../../model/Question")
const Module = require("../../model/Module");
const ContentFolder = require('../../model/ContentFolder')
const QuizReport = require('../../model/QuizResultReport')
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
            })
            .populate('logs')
            .populate('questions')
            .populate({
                path: "quiz_reports", // <-- virtual relation
                match: {
                    user_id: userId
                },
                populate: [{
                        path: "user_id",
                        select: "name email"
                    },
                    {
                        path: "question_id"
                    }
                ]
            });;


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
            viewedVideoTime,
        } = req.body;

        const contentFolder = await ContentFolder.findById(contentFolderId);

        let perComplete = 0;

        // Check if activity report exists
        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            activity_id: activityId
        });


        if (moduleTypeId == "688723af5dd97f4ccae68834") {
            const viewed = viewedPages?.length || 0;
            perComplete = totalPages > 0 ? (viewed / totalPages) * 100 : 0;
        }

        else if (
            moduleTypeId == "688723af5dd97f4ccae68836" ||
            moduleTypeId == "688723af5dd97f4ccae68835"
        ) {
            const roundedViewed = Math.round(Number(viewedVideoTime));
            perComplete =
                totalVideoTime > 0 ?
                (roundedViewed / Number(totalVideoTime)) * 100 :
                0;
        }

        else if (moduleTypeId == "68886902954c4d9dc7a379bd") {

            const quizData = Array.isArray(req.body) ? req.body : [];

            // Remove old attempts
            await QuizReport.deleteMany({
                user_id: userId,
                activity_id: activityId,
                module_id: moduleId
            });

            // Get total number of questions
            const questions = await Question.find({
                activity_id: activityId,
                module_id: moduleId
            });

            // FIXED: correct percentage calculation
            perComplete =
                questions.length > 0 ?
                (quizData.length / questions.length) * 100 :
                0;

            // Prepare new attempts
            const formattedAttempts = quizData.map((a) => ({
                user_id: userId,
                created_by: userId,
                activity_id: activityId,
                module_id: moduleId,
                question_id: a.question_id,
                is_correct: Boolean(a.is_correct),
                selected_option_no: String(a.selected_option_no ?? ""),
                mark: String(a.mark ?? "0"),
                created_at: new Date()
            }));

            // Insert all new attempts
            if (formattedAttempts.length > 0) {
                await QuizReport.insertMany(formattedAttempts);
            }
        }


        const reportData = {
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
            total_video_time: totalVideoTime,
        };

        if (!activityReport) {
            await new ActivityFolderReport(reportData).save();
        } else {
            await ActivityFolderReport.findOneAndUpdate({
                    user_id: userId,
                    activity_id: activityId
                },
                reportData
            );
        }

        return successResponse(res, "Activity report successful");

    } catch (error) {
        next(error);
    }
};
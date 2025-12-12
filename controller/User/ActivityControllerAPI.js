const Activity = require("../../model/Activity")
const User = require("../../model/User")
const Question = require("../../model/Question")
const Module = require("../../model/Module");
const ContentFolder = require('../../model/ContentFolder')
const QuizReport = require('../../model/QuizResultReport')
const QuizSetting = require("../../model/QuizSetting")
const ActivityFolderReport = require('../../model/ActivityFolderReport')

const {
    successResponse
} = require("../../util/response");


function parseScormData(scormData) {
    const parseTimeToSeconds = (scormTime) => {
        if (!scormTime) return 0;
        // SCORM 2004 format: "HHHH:MM:SS.ss"
        const parts = scormTime.split(":");
        if (parts.length !== 3) return 0;
        const [h, m, s] = parts;
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
    };

    return {
        exit: scormData["cmi.core.exit"] || scormData["cmi.exit"] || null,
        passed_at_time: scormData?.["cmi.core.lesson_status"] === "passed" ? Date.now() : null,
        lessonStatus: scormData["cmi.core.lesson_status"] || scormData["cmi.completion_status"] || null,
        scoreRaw: Number(scormData["cmi.core.score.raw"] || scormData["cmi.score.raw"] || 0),
        scoreMin: Number(scormData["cmi.core.score.min"] || scormData["cmi.score.min"] || 0),
        scoreMax: Number(scormData["cmi.core.score.max"] || scormData["cmi.score.max"] || 0),
        sessionTime: scormData?.["cmi.core.session_time"] ? parseTimeToSeconds(scormData["cmi.core.session_time"]) : null,
        totalTime: scormData?.["cmi.core.total_time"] ? parseTimeToSeconds(scormData["cmi.core.total_time"]) : null,
        suspendData: scormData?.["cmi.suspend_data"] || null,
        lastSlide: scormData["lastSlide"] || null,
        lastTime: scormData?.["lastTime"] ? parseTimeToSeconds(scormData["lastTime"]) : null,
    };
}


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
            .populate('QuizSetting')
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

        let passPercent = 0;

        let isPassed = false;

        // Check if activity report exists
        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            activity_id: activityId
        });

        const quizSetting = await QuizSetting.findOne({
            activity_id: activityId,
            module_id: moduleId
        })

        let totalReattempts = 0;

        if (activityReport) {

            totalReattempts = Number(activityReport?.attempt_left || 0)

        } else {

            totalReattempts = Number(quizSetting?.reattempts || 0);
        }

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

            const filteredQuizData = quizData.filter(
                (item) => Array.isArray(item.selected_option_no) && item.selected_option_no.length > 0
            );

            const answered = filteredQuizData.length;

            perComplete =
                questions.length > 0
                    ? (answered / questions.length) * 100
                    : 0;

            const totalMark = quizData.reduce((sum, item) => sum + Number(item.mark), 0);
            const totalTotalMark = quizData.reduce((sum, item) => sum + Number(item.total_mark), 0);

            // Calculate percentage
            passPercent = (totalMark / totalTotalMark) * 100;

            passPercent = passPercent < 0 ? 0 : (passPercent > 100 ? 100 : passPercent)

            const requiredPercent = quizSetting?.passCriteria || 1;

            isPassed = Number(passPercent) >= Number(requiredPercent)

            // Prepare new attempts
            const formattedAttempts = quizData.map((a) => ({
                user_id: userId,
                created_by: userId,
                activity_id: activityId,
                module_id: moduleId,
                question_id: a.question_id,
                total_mark: String(a.total_mark || 0),
                is_correct: Boolean(a.is_correct),
                selected_option_no: (a.selected_option_no || []).map(String),
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
            is_passed: isPassed,
            mark_percentage: passPercent,
            completion_percentage: perComplete,
            passed_at_time: isPassed ? Date.now() : null,
            completed_at_time: Number(perComplete).toFixed(1) >= 100 ? Date.now() : null,
            total_page_no: totalPages,
            current_page_no: currentPage,
            view_page_no: viewedPages,
            attempt_left: totalReattempts,
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

exports.postInsertReportController = async (req, res, next) => {
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

        // Check if activity report exists
        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            activity_id: activityId
        });

        const quizSetting = await QuizSetting.findOne({
            activity_id: activityId,
            module_id: moduleId
        })

        let perComplete = 0;

        let passPercent = 0;

        let isPassed = false;

        let quizCompleted = quizSetting?.otherSettings?.completeOnlyIfPassed ?? false;

        let totalReattempts = 0;

        if (activityReport) {

            totalReattempts = Number(activityReport?.attempt_left || 0)

        } else {

            totalReattempts = Number(quizSetting?.reattempts || 0);
        }

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

            const filteredQuizData = quizData.filter(
                (item) => Array.isArray(item.selected_option_no) && item.selected_option_no.length > 0
            );

            const answered = filteredQuizData.length;

            perComplete =
                questions.length > 0
                    ? (answered / questions.length) * 100
                    : 0;

            const totalMark = quizData.reduce((sum, item) => sum + Number(item.mark), 0);
            const totalTotalMark = quizData.reduce((sum, item) => sum + Number(item.total_mark), 0);

            // Calculate percentage
            passPercent = (totalMark / totalTotalMark) * 100;

            passPercent = passPercent < 0 ? 0 : (passPercent > 100 ? 100 : passPercent)

            const requiredPercent = quizSetting?.passCriteria || 1;

            isPassed = Number(passPercent) >= Number(requiredPercent)

            // Prepare new attempts
            const formattedAttempts = quizData.map((a) => ({
                user_id: userId,
                created_by: userId,
                activity_id: activityId,
                module_id: moduleId,
                question_id: a.question_id,
                is_correct: Boolean(a.is_correct),
                selected_option_no: (a.selected_option_no || []).map(String),
                total_mark: String(a.total_mark || 0),
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
            is_passed: isPassed,
            mark_percentage: passPercent,
            completion_percentage: perComplete,
            is_completed: quizCompleted ? isPassed : Number(perComplete).toFixed(1) >= 100,
            completed_at_time: Number(perComplete).toFixed(1) >= 100 ? Date.now() : null,
            passed_at_time: isPassed ? Date.now() : null,
            total_page_no: totalPages,
            current_page_no: currentPage,
            view_page_no: viewedPages,
            attempt_left: totalReattempts,
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

exports.getAttemptCheck = async (req, res, next) => {
    try {
        const userId = req?.userId;
        const { activityId, moduleId, contentFolderId, moduleTypeId } = req?.params;

        const [quizSetting, activityReport, contentFolder] = await Promise.all([
            QuizSetting.findOne({ activity_id: activityId, module_id: moduleId }),
            ActivityFolderReport.findOne({ user_id: userId, activity_id: activityId }),
            ContentFolder.findById(contentFolderId)
        ]);

        if (!contentFolder) {
            return errorResponse(res, "Content folder not found", 404);
        }

        let totalReattempts = Number(quizSetting?.reattempts || 0);
        let attemptLeft;

        // Create new record if not exists
        if (!activityReport) {
            attemptLeft = totalReattempts > 0 ? totalReattempts - 1 : 0;
        } else {
            let prev = Number(activityReport.attempt_left || 0);
            attemptLeft = prev > 0 ? prev - 1 : 0;
        }

        const reportData = {
            user_id: userId,
            program_id: contentFolder.program_id,
            created_by: userId,
            activity_id: activityId,
            module_id: moduleId,
            content_folder_id: contentFolderId,
            module_type_id: moduleTypeId,
            attempt_left: attemptLeft,
            is_reattempt_left: attemptLeft > 0,
        };

        if (!activityReport) {
            await ActivityFolderReport.create(reportData);
        } else {
            await ActivityFolderReport.findOneAndUpdate(
                { user_id: userId, activity_id: activityId },
                { $set: reportData },
                { new: true }
            );
        }

        return successResponse(res, "Attempt updated successfully");

    } catch (error) {
        next(error);
    }
};

exports.postScormData = async (req, res, next) => {
    try {
        const userId = req?.userId;
        const { activityId, moduleId, contentFolderId, moduleTypeId } =
            req.params;

        const scormData = req.body || {};

        // Convert raw → clean format
        const parsed = parseScormData(scormData);

        const contentFolder = await ContentFolder.findById(contentFolderId);

        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            activity_id: activityId,
        });

        if (activityReport) {
            await ActivityFolderReport.findOneAndUpdate(
                {
                    user_id: userId,
                    activity_id: activityId,
                },
                { $set: { scorm_data: parsed } },
                { new: true }
            );
        } else {
            const activity_report = new ActivityFolderReport({
                user_id: userId,
                activity_id: activityId,
                module_id: moduleId,
                content_folder_id: contentFolderId,
                module_type_id: moduleTypeId,
                program_id: contentFolder.program_id,
                scorm_data: parsed,
                created_by: userId,
            });
            await activity_report.save();
        }

        return successResponse(res, "SCORM data saved successfully", parsed);

    } catch (error) {
        console.error(error);
        next(error);
    }
};


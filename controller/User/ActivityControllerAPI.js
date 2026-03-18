const mongoose = require('mongoose')
const Activity = require("../../model/Activity")
const User = require("../../model/User")
const Question = require("../../model/Question")
const Module = require("../../model/Module");
const ContentFolder = require('../../model/ContentFolder')
const QuizReport = require('../../model/QuizResultReport')
const QuizSetting = require("../../model/QuizSetting")
const ActivityFolderReport = require('../../model/ActivityFolderReport')

const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../../model/BlacklistedToken');

const jwtSecretKey = process.env.JWT_SECRET;

const {
    successResponse,
    errorResponse
} = require("../../util/response");
const ProgramSchedule = require('../../model/ProgramSchedule');

const fetchProgressStatus = (percentage) => {

    const perComplete = Number(percentage)

    if (perComplete === 0) {

        return 1;

    } else if (perComplete === 100) {

        return 3;

    } else {

        return 2;

    }

}

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
        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId)

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        let activityId = [];

        const masterId = user?.master_company_id;

        const module = await Module.findById(id)

        const programSchedule = await ProgramSchedule.findOne({ module_id: id })

        if (programSchedule) {
            activityId.push(...programSchedule.activity_id)
        }

        const activity = await Activity.find({
            _id: {
                $in: activityId
            },
            module_id: id,
            created_by: masterId
        })
            .populate({
                path: 'logs',
                match: {
                    user_id: userId,
                },
                options: {
                    sort: { created_at: -1 },
                    limit: 1
                }
            })
            .populate({
                path: 'moduleSetting',
                populate: {
                    path: 'selectedCertificateId',
                    model: 'certificates'
                }
            });

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

        const activities = await Activity.aggregate([
            {
                $match: {
                    _id: mongoose.Types.ObjectId.createFromHexString(id),
                    created_by: mongoose.Types.ObjectId.createFromHexString(masterId),
                },
            },
            { $limit: 1 },
            {
                $lookup: {
                    from: "activity_logs",
                    let: {
                        userID: mongoose.Types.ObjectId.createFromHexString(userId),
                        activityId: "$_id",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$user_id", "$$userID"] },
                                        { $eq: ["$activity_id", "$$activityId"] },
                                    ],
                                },
                            },
                        },
                        { $sort: { created_at: -1 } },
                    ],
                    as: "logs",
                },
            },
            {
                $lookup: {
                    from: "activity_logs",
                    let: {
                        userID: mongoose.Types.ObjectId.createFromHexString(userId),
                        activityId: "$_id",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$user_id", "$$userID"] },
                                        { $eq: ["$activity_id", "$$activityId"] },
                                    ],
                                },
                            },
                        },
                        { $sort: { created_at: -1 } },
                        { $limit: 1 },
                    ],
                    as: "logss",
                },
            },
            {
                $unwind: {
                    path: "$logss",
                    preserveNullAndEmptyArrays: true, // ✅ prevents document loss
                },
            },
            {
                $lookup: {
                    from: "questions",
                    localField: "_id",
                    foreignField: "activity_id",
                    as: "questions",
                },
            },
            {
                $lookup: {
                    from: "quiz_result_reports",
                    let: {
                        activityId: "$_id",
                        logId: "$logss._id",
                        userID: mongoose.Types.ObjectId.createFromHexString(userId),
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$log_id", "$$logId"] },
                                        { $eq: ["$activity_id", "$$activityId"] },
                                        { $eq: ["$user_id", "$$userID"] },
                                    ],
                                },
                            },
                        },
                    ],
                    as: "quiz_reports",
                },
            },
            {
                $lookup: {
                    from: "quiz_settings",
                    localField: "_id",
                    foreignField: "activity_id",
                    as: "QuizSetting",
                },
            },
        ]);

        return successResponse(res, "Activity fetched", activities?.[0])

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

        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            activity_id: activityId
        }).sort({
            current_attempt: -1
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
                log_id: activityReport._id,
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

            const formattedAttempts = quizData.map((a) => ({
                user_id: userId,
                created_by: userId,
                activity_id: activityId,
                log_id: activityReport._id,
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
            created_at: Date.now(),
            module_id: moduleId,
            content_folder_id: contentFolderId,
            module_type_id: moduleTypeId,
            progress_status: fetchProgressStatus(perComplete),
            is_completed: Number(perComplete).toFixed(1) >= 100,
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
            await ActivityFolderReport.findOneAndUpdate(
                {
                    user_id: userId,
                    activity_id: activityId
                },
                {
                    $set: reportData
                },
                {
                    sort: { current_attempt: -1 },
                    new: true
                }
            );
        }

        const modules = await Module.findById(moduleId)

        const isSurveyCompleted = modules?.is_survey_completed || false;

        if (!isSurveyCompleted) {

            await Module.findOneAndUpdate({
                _id: moduleId
            }, {
                is_survey_completed: false
            })

        }

        const isSurvey = modules?.is_survey_done || false;

        const userModule = await ActivityFolderReport.find({
            user_id: userId,
            module_id: moduleId
        }).sort({
            current_attempt: -1
        });

        const activity = await Activity.find({ module_id: moduleId })

        let finalData = {
            completed: false,
        }

        if (isSurvey) {

            finalData = {
                completed: isSurvey && !isSurveyCompleted
            };

        } else if (activity.length <= userModule.length && ((isSurvey && !isSurveyCompleted) || (!isSurvey && !isSurveyCompleted))) {

            const isAllCompleted = userModule.every(item => item.is_completed === true);

            finalData = {
                completed: isAllCompleted,
            }

            await Module.findByIdAndUpdate(moduleId, {
                is_survey_done: isAllCompleted
            })

        }

        return successResponse(res, "Activity report successful", finalData);

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

        const activityReport = await ActivityFolderReport.findOne({
            user_id: userId,
            activity_id: activityId
        }).sort({
            current_attempt: -1
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

            await QuizReport.deleteMany({
                user_id: userId,
                activity_id: activityId,
                log_id: activityReport._id,
                module_id: moduleId
            });

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

            passPercent = (totalMark / totalTotalMark) * 100;

            passPercent = passPercent < 0 ? 0 : (passPercent > 100 ? 100 : passPercent)

            const requiredPercent = quizSetting?.passCriteria || 1;

            isPassed = Number(passPercent) >= Number(requiredPercent)

            const formattedAttempts = quizData.map((a) => ({
                user_id: userId,
                created_by: userId,
                activity_id: activityId,
                log_id: activityReport._id,
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
            created_at: Date.now(),
            mark_percentage: passPercent,
            progress_status: fetchProgressStatus(perComplete),
            completion_percentage: perComplete,
            is_completed: quizCompleted ? isPassed : Number(perComplete).toFixed(1) >= 100,
            completed_at_time: Number(perComplete).toFixed(1) >= 100 ? Date.now() : null,
            passed_at_time: isPassed ? Date.now() : null,
            end_activity_time: Date.now(),
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

            await ActivityFolderReport.findOneAndUpdate(
                {
                    user_id: userId,
                    activity_id: activityId
                },
                {
                    $set: reportData
                },
                {
                    sort: { current_attempt: -1 },
                    new: true
                }
            );

        }

        const modules = await Module.findById(moduleId)

        const isSurveyCompleted = modules?.is_survey_completed || false;

        if (!isSurveyCompleted) {

            await Module.findOneAndUpdate({
                _id: moduleId
            }, {
                is_survey_completed: false
            })

        }

        const activity = await Activity.find({ module_id: moduleId })

        const isSurvey = modules?.is_survey_done || false;

        const userModule = await ActivityFolderReport.find({
            user_id: userId,
            module_id: moduleId
        }).sort({
            current_attempt: -1
        });

        let finalData = {
            completed: false,
        }

        if (isSurvey) {

            finalData = {
                completed: isSurvey && !isSurveyCompleted
            };

        } else if (activity.length <= userModule.length && ((isSurvey && !isSurveyCompleted) || (!isSurvey && !isSurveyCompleted))) {

            // true if all is_completed === true, otherwise false
            const isAllCompleted = userModule.every(item => item.is_completed === true);

            finalData = {
                completed: isAllCompleted,
            }

            await Module.findByIdAndUpdate(moduleId, {
                is_survey_done: isAllCompleted
            })

        }


        return successResponse(res, "Activity report successful", finalData);

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
            ActivityFolderReport.findOne({ user_id: userId, activity_id: activityId }).sort({
                current_attempt: -1
            }),
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
            created_at: Date.now(),
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
                {
                    sort: { current_attempt: -1 },
                    new: true
                }
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
        }).sort({
            current_attempt: -1
        });

        if (activityReport) {
            await ActivityFolderReport.findOneAndUpdate(
                {
                    user_id: userId,
                    activity_id: activityId,
                },
                {
                    $set: {
                        scorm_data: parsed,
                        progress_status: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete") ? "3" : "1",
                        is_completed: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete"),
                        is_passed: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete"),
                        completed_at_time: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete") ? Date.now() : null,
                        passed_at_time: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete") ? Date.now() : null
                    }
                },
                {
                    sort: { current_attempt: -1 },
                    new: true
                }
            );
        } else {
            const activity_report = new ActivityFolderReport({
                user_id: userId,
                activity_id: activityId,
                module_id: moduleId,
                content_folder_id: contentFolderId,
                module_type_id: moduleTypeId,
                program_id: contentFolder.program_id,
                progress_status: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete") ? "3" : "1",
                is_completed: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete"),
                is_passed: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete"),
                completed_at_time: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete") ? Date.now() : null,
                passed_at_time: (parsed?.lessonStatus == "passed" || parsed?.lessonStatus == "incomplete") ? Date.now() : null,
                created_by: userId,
            });
            await activity_report.save();
        }

        const modules = await Module.findById(moduleId)

        const isSurveyCompleted = modules?.is_survey_completed || false;

        if (!isSurveyCompleted) {

            await Module.findOneAndUpdate({
                _id: moduleId
            }, {
                is_survey_completed: false
            })

        }

        const activity = await Activity.find({ module_id: moduleId })

        const isSurvey = modules?.is_survey_done || false;

        const userModule = await ActivityFolderReport.find({
            user_id: userId,
            module_id: moduleId
        }).sort({
            current_attempt: -1
        });

        let finalData = {
            completed: false,
        }

        if (isSurvey) {

            finalData = {
                completed: isSurvey && !isSurveyCompleted
            };

        } else if (activity.length <= userModule.length && ((isSurvey && !isSurveyCompleted) || (!isSurvey && !isSurveyCompleted))) {

            // true if all is_completed === true, otherwise false
            const isAllCompleted = userModule.every(item => item.is_completed === true);

            finalData = {
                completed: isAllCompleted,
            }

            await Module.findByIdAndUpdate(moduleId, {
                is_survey_done: isAllCompleted
            })

        }

        return successResponse(res, "SCORM data saved successfully", finalData);

    } catch (error) {
        console.error(error);
        next(error);
    }
};

exports.getModuleActivityData = async (req, res, next) => {
    try {

        const userId = req?.userId

        const moduleId = req?.params?.moduleId;

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user?.master_company_id;

        const moduleData = await Module.findOne({
            created_by: masterId,
            _id: moduleId
        })
            .populate({
                path: 'moduleSetting',
                populate: {
                    path: 'selectedCertificateId',
                    model: 'certificates'
                }
            })
            .populate('moduleSurvey');


        return successResponse(res, "Module fetched successfully", moduleData)

    } catch (error) {
        next(error)
    }
}

exports.getNewAttemptController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const { activityId, moduleId, contentFolderId, moduleTypeId } = req?.params;

        const contentFolder = await ContentFolder.findById(contentFolderId);

        const activityFolderReport = await ActivityFolderReport.findOne({
            activity_id: activityId,
            module_id: moduleId,
            program_id: contentFolder.program_id,
            content_folder_id: contentFolderId,
            module_type_id: moduleTypeId,
            user_id: userId,
            created_by: userId
        }).sort({ created_at: -1 })

        let currentAttempt = 0;
        let progressStatus = "1";
        let totalDocPage = 1;
        let completePercent = 0;
        let leftAttempt = 1;
        let completionPercentage = 0;
        let viewedPageNo = [];
        let isPassed = false;
        let isReAttemptLeft = true;
        let isCompleted = false;

        let currentDocPage = null;
        let completedAtTime = null;
        let totalVideoTime = null;
        let currentVideoTime = null;
        let viewedVideoTime = null;

        if (activityFolderReport) {

            currentAttempt = activityFolderReport?.current_attempt;
            leftAttempt = activityFolderReport?.attempt_left;

        } else if (moduleTypeId == "68886902954c4d9dc7a379bd") {

            const quizSetting = await QuizSetting.findOne({
                module_id: moduleId,
                activity_id: activityId
            })

            leftAttempt = quizSetting?.reattempts || 1;

        }

        currentAttempt = Number(currentAttempt) + 1;

        const activity_report = new ActivityFolderReport({
            activity_id: activityId,
            module_id: moduleId,
            module_type_id: moduleTypeId,
            content_folder_id: contentFolderId,
            program_id: contentFolder.program_id,
            user_id: userId,
            created_by: userId,
            created_at: Date.now(),
            start_activity_time: Date.now(),
            is_passed: isPassed,
            is_completed: isCompleted,
            attempt_left: leftAttempt,
            is_reattempt_left: isReAttemptLeft,
            viewed_video_time: viewedVideoTime,
            total_video_time: totalVideoTime,
            current_video_time: currentVideoTime,
            completion_percentage: completionPercentage,
            completed_at_time: completedAtTime,
            progress_status: progressStatus,
            view_page_no: viewedPageNo,
            current_attempt: currentAttempt,
            total_page_no: totalDocPage,
            current_page_no: currentDocPage,
            completion_percentage: completePercent,
        })

        await activity_report.save();

        return successResponse(res, "Activity report saved successfully")

    } catch (error) {
        next(error)
    }
}

exports.getEndAttemptController = async (req, res, next) => {
    try {
        const {
            moduleId,
            contentFolderId,
            activityId,
            moduleTypeId,
            token
        } = req.body;

        if (!token) {
            return errorResponse(res, "Not authenticated: Token missing", {}, 401);
        }

        const isBlacklisted = await BlacklistedToken.exists({ token });
        if (isBlacklisted) {
            return errorResponse(res, "Token has been logged out. Please log in again.", {}, 401);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecretKey);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                return errorResponse(res, "Token expired. Please log in again", {}, 401);
            }
            return errorResponse(res, "Invalid token", {}, 401);
        }

        const userId = decoded.userId;

        const contentFolder = await ContentFolder.findById(contentFolderId);
        if (!contentFolder) {
            return errorResponse(res, "Content folder not found", {}, 404);
        }

        // Get latest attempt
        const activityFolderReport = await ActivityFolderReport.findOne({
            activity_id: activityId,
            module_id: moduleId,
            program_id: contentFolder.program_id,
            content_folder_id: contentFolderId,
            module_type_id: moduleTypeId,
            user_id: userId,
            created_by: userId
        }).sort({ current_attempt: -1 });

        if (!activityFolderReport) {
            return errorResponse(res, "No active attempt found", {}, 404);
        }

        activityFolderReport.end_activity_time = Date.now();
        await activityFolderReport.save();

        return successResponse(res, "Activity ended successfully");
    } catch (err) {
        next(err);
    }
};


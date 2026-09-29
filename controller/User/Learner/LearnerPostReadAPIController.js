const mongoose = require("mongoose");
const Activity = require("../../../model/Activity");
const Batch = require("../../../model/Batch");
const ActivityLog = require("../../../model/ActivityFolderReport");
const BatchSession = require("../../../model/BatchSession")
const BatchAssignmentSubmission = require("../../../model/BatchAssignment");
const { resolveActivityDisplay } = require("../../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../../util/response");

// GET /user/learner/resource/post-read?batchId=
// Mount checkEnrollment before this route.
exports.getPostReadItems = async (req, res, next) => {
    try {
        const learnerId = req.userId;
        const { batchId, sessionId } = req.query;

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const activities = await Activity.aggregate([
            {
                $match: {
                    module_id: batch.module_id,
                    engage_type: "post_read",
                }
            },
            {
                $lookup: {
                    from: 'questions',
                    localField: '_id',
                    foreignField: 'activity_id',
                    as: 'questions'
                }
            },

            // Module Setting
            {
                $lookup: {
                    from: 'modulesettings',
                    localField: 'module_id',
                    foreignField: 'moduleId',
                    as: 'moduleSetting'
                }
            },

            {
                $unwind: {
                    path: '$moduleSetting',
                    preserveNullAndEmptyArrays: true
                }
            },

            // Certificate Populate
            {
                $lookup: {
                    from: 'certificates',
                    localField: 'moduleSetting.selectedCertificateId',
                    foreignField: '_id',
                    as: 'moduleSetting.selectedCertificateId'
                }
            },

            // Keep only first certificate object
            {
                $addFields: {
                    'moduleSetting.selectedCertificateId': {
                        $arrayElemAt: ['$moduleSetting.selectedCertificateId', 0]
                    }
                }
            },

            // Activity filters
            {
                $match: {
                    $expr: {
                        $switch: {
                            branches: [
                                // Document
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id',
                                            mongoose.Types.ObjectId.createFromHexString(
                                                '688723af5dd97f4ccae68834'
                                            )
                                        ]
                                    },
                                    then: {
                                        $gt: [
                                            {
                                                $strLenCP: {
                                                    $ifNull: ['$document_data.image_url', '']
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },

                                // Video
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id',
                                            mongoose.Types.ObjectId.createFromHexString(
                                                '688723af5dd97f4ccae68835'
                                            )
                                        ]
                                    },
                                    then: {
                                        $gt: [
                                            {
                                                $strLenCP: {
                                                    $ifNull: ['$video_data.video_url', '']
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },

                                // Youtube
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id',
                                            mongoose.Types.ObjectId.createFromHexString(
                                                '688723af5dd97f4ccae68836'
                                            )
                                        ]
                                    },
                                    then: {
                                        $gt: [
                                            {
                                                $strLenCP: {
                                                    $ifNull: ['$video_data.video_url', '']
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },

                                // SCORM
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id',
                                            mongoose.Types.ObjectId.createFromHexString(
                                                '688723af5dd97f4ccae68837'
                                            )
                                        ]
                                    },
                                    then: {
                                        $gt: [
                                            {
                                                $strLenCP: {
                                                    $ifNull: ['$scorm_data.folder_url', '']
                                                }
                                            },
                                            0
                                        ]
                                    }
                                },

                                // Hide these module types
                                {
                                    case: {
                                        $in: [
                                            '$module_type_id',
                                            [
                                                mongoose.Types.ObjectId.createFromHexString(
                                                    '688723af5dd97f4ccae68838'
                                                ),
                                                mongoose.Types.ObjectId.createFromHexString(
                                                    '688723af5dd97f4ccae68839'
                                                ),
                                                mongoose.Types.ObjectId.createFromHexString(
                                                    '688723af5dd97f4ccae6883a'
                                                )
                                            ]
                                        ]
                                    },
                                    then: false
                                },

                                // Quiz
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id',
                                            mongoose.Types.ObjectId.createFromHexString(
                                                '68886902954c4d9dc7a379bd'
                                            )
                                        ]
                                    },
                                    then: {
                                        $gt: [
                                            {
                                                $size: '$questions'
                                            },
                                            0
                                        ]
                                    }
                                }
                            ],

                            default: true
                        }
                    }
                }
            }
        ])

        const now = new Date();

        const session = await BatchSession.findOne({
            _id: sessionId,
            batch_id: batchId,
            status: { $ne: "completed" },
        })

        const sessionDate = new Date(session.session_date);

        const availableSessions = sessionDate.getFullYear() === now.getFullYear() && sessionDate.getMonth() === now.getMonth() && sessionDate.getDate() === now.getDate();

        const [startHour, startMinute] = session?.start_time
            .split(":")
            .map(Number);

        const [endHour, endMinute] = session?.end_time
            .split(":")
            .map(Number);

        const startDateTime = new Date(sessionDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(sessionDate);
        endDateTime.setHours(endHour, endMinute, 59, 999);

        // const isPreAllowed = now < startDateTime;

        // const isMaterialAllowed = now >= startDateTime && now <= endDateTime;

        const isPastAllowed = now > endDateTime

        const isAllowed = session && availableSessions && isPastAllowed

        const activityIds = activities.map((a) => a._id);

        const myCompletedIds = await ActivityLog.distinct("activity_id", {
            activity_id: { $in: activityIds },
            batch_id: batchId,
            session_id: sessionId,
            user_id: learnerId,
            is_completed: true,
        });
        const completedSet = new Set(myCompletedIds.map(String));

        const items = activities.map((a) => {
            const { title, type } = resolveActivityDisplay(a);
            return {
                id: a._id,
                title,
                module_id: a?.module_id,
                logs: a?.logs,
                module_type_id: a.module_type_id,
                document_data: a.document_data,
                video_data: a.video_data,
                scorm_data: a.scorm_data,
                questions: a.questions,
                type,
                done: completedSet.has(String(a._id)),
            };
        });

        return successResponse(res, "Post-read items fetched successfully", { items, isAllowed });
    } catch (error) {
        next(error);
    }
};

// POST /user/learner/resource/post-read/:id/submit
// Mount checkEnrollment before this route.
// SECURITY: learner_id is always req.userId. Never accept a learnerId in
// the body — the original trainer-side submitPostRead took it from the
// client, which would let one learner submit as another. Fixed here.
exports.submitPostRead = async (req, res, next) => {
    try {
        const { id: postReadId } = req.params;
        const learnerId = req.userId;
        const { batchId, submission_text, submission_file_url } = req.body;

        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);
        if (!submission_text && !submission_file_url) {
            return errorResponse(res, "Provide submission text or a file", {}, 400);
        }

        const activity = await Activity.findById(postReadId).lean();
        if (!activity) return errorResponse(res, "Assignment not found", {}, 404);

        const submission = await BatchAssignmentSubmission.findOneAndUpdate(
            { activity_id: postReadId, learner_id: learnerId, batch_id: batchId },
            {
                $set: {
                    module_id: activity.module_id,
                    submission_text: submission_text || "",
                    submission_file_url: submission_file_url || "",
                    submitted_at: new Date(),
                    status: "submitted",
                    // Clear any prior grade — a resubmission should go back to the queue.
                    score: null,
                    graded_by: null,
                    graded_at: null,
                },
            },
            { new: true, upsert: true }
        );

        return successResponse(res, "Submission recorded", { submission });
    } catch (error) {
        next(error);
    }
};
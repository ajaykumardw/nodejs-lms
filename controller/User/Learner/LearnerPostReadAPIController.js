const mongoose = require("mongoose");
const Activity = require("../../../model/Activity");
const Batch = require("../../../model/Batch");
const BatchAssignmentSubmission = require("../../../model/BatchAssignment");
const { resolveActivityDisplay } = require("../../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../../util/response");

// GET /user/learner/resource/post-read?batchId=
// Mount checkEnrollment before this route.
exports.getPostReadItems = async (req, res, next) => {
    try {
        const learnerId = req.userId;
        const { batchId } = req.query;

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const activities = await Activity.aggregate([
            {
                $match: {
                    module_id: batch.module_id,
                    engage_type: "post_read",
                }
            },

            // Questions
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

        const activityIds = activities.map((a) => a._id);

        const mySubmissions = await BatchAssignmentSubmission.find({
            activity_id: { $in: activityIds },
            batch_id: batchId,
            learner_id: learnerId,
        }).lean();
        const submissionMap = new Map(mySubmissions.map((s) => [String(s.activity_id), s]));

        const items = activities.map((item) => {
            const { title, type } = resolveActivityDisplay(item);
            const mine = submissionMap.get(String(item._id));

            return {
                id: item._id,
                title,
                type,
                module_type_id: item.module_type_id,
                mySubmission: mine
                    ? {
                        status: mine.status,
                        score: mine.score,
                        submittedAt: mine.submitted_at,
                        text: mine.submission_text,
                        fileUrl: mine.submission_file_url,
                    }
                    : null,
            };
        });

        return successResponse(res, "Post-read items fetched successfully", { items });
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
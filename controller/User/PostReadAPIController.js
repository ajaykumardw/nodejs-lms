const mongoose = require("mongoose");
const Activity = require("../../model/Activity");
const Batch = require("../../model/Batch");
const BatchAssignmentSubmission = require("../../model/BatchAssignment"); // re-key this model to activity_id + batch_id
const { resolveActivityDisplay } = require("../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../util/response");

exports.getPostReadItems = async (req, res, next) => {
    try {
        const { batchId } = req.query;
        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const items = await Activity.aggregate([
            {
                $match: {
                    module_id: batch.module_id,
                    engage_type: "post_read"
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

        const itemIds = items.map((i) => i._id);

        const submissionCounts = await BatchAssignmentSubmission.aggregate([
            { $match: { activity_id: { $in: itemIds }, batch_id: mongoose.Types.ObjectId.createFromHexString(batchId) } },
            { $group: { _id: "$activity_id", count: { $sum: 1 } } },
        ]);
        const countMap = new Map(submissionCounts.map((c) => [String(c._id), c.count]));

        const enriched = items.map((item) => {

            const { title, type } = resolveActivityDisplay(item);

            return {
                id: item._id,
                title,
                module_id: item?.module_id,
                module_type_id: item?.module_type_id,
                document_data: item?.document_data,
                video_data: item?.video_data,
                questions: item?.questions,
                type,
                submissions: countMap.get(String(item._id)) || 0
            };
        });

        return successResponse(res, "Post-read items fetched successfully", { items: enriched });
    } catch (error) {
        next(error);
    }
};

exports.createPostReadItem = async (req, res, next) => {
    try {
        const trainerId = req?.userId;
        const { batchId, title, type, resource_url, image_url } = req.body;

        if (!batchId || !title || !type) {
            return errorResponse(res, "batchId, title and type are required", {}, 400);
        }

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const typeDataKey = { document: "document_data", video: "video_data", youtube: "youtube_data", scorm: "scorm_data", quiz: "quiz_data" }[type];
        if (!typeDataKey) return errorResponse(res, "Unsupported type", {}, 400);

        const activity = await Activity.create({
            module_id: batch.module_id,
            engage_type: "post_read",
            image_url: image_url || "",
            created_by: trainerId,
            [typeDataKey]: { title, ...(resource_url ? { [typeDataKey === "document_data" ? "page_no" : "video_url"]: resource_url } : {}) },
        });

        return successResponse(res, "Post-read item assigned", { item: activity });
    } catch (error) {
        next(error);
    }
};

exports.submitPostRead = async (req, res, next) => {
    try {
        const { postReadId } = req.params; // now an Activity _id
        const { learnerId, batchId, submission_text, submission_file_url } = req.body;

        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);

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
                },
            },
            { new: true, upsert: true }
        );

        return successResponse(res, "Submission recorded", { submission });
    } catch (error) {
        next(error);
    }
};
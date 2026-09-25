const mongoose = require("mongoose")

const Activity = require("../../model/Activity");
const Batch = require("../../model/Batch");
const ActivityLog = require("../../model/ActivityFolderReport")
const { resolveActivityDisplay } = require("../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../util/response");

exports.getMaterials = async (req, res, next) => {
    try {
        const { batchId } = req.query;
        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const activities = await Activity.aggregate([
            {
                $match: {
                    module_id: batch.module_id,
                    engage_type: "training_material"
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

        const progress = await ActivityLog.aggregate([
            {
                $match: {
                    activity_id: { $in: activityIds },
                    batch_id: mongoose.Types.ObjectId.createFromHexString(batchId), // rename if program_id != batch
                },
            },
            { $group: { _id: "$activity_id", completed: { $sum: { $cond: ["$is_completed", 1, 0] } } } },
        ]);

        const progressMap = Object.fromEntries(progress.map((p) => [String(p._id), p.completed]));

        const materials = activities.map((a) => {
            const { title, type } = resolveActivityDisplay(a);
            return {
                id: a._id,
                title,
                module_id: batch?.module_id,
                video_data: a?.video_data,
                document_data: a?.document_data,
                module_type_id: a?.module_type_id,
                quiz_data: a?.quiz_data,
                youtube_data: a?.youtube_data,
                scorm_data: a?.scorm_data,
                questions: a?.questions,
                type,
                completions: progressMap[String(a._id)] || 0,
                file_url: a.document_data?.image_url || a.video_data?.video_url || a.scorm_data?.content_url
            };
        });

        return successResponse(res, "Materials fetched successfully", { materials });
    } catch (error) {
        next(error);
    }
};

exports.uploadMaterial = async (req, res, next) => {
    try {
        const trainerId = req?.userId;
        const { batchId, title, type, file_url, image_url } = req.body;

        if (!batchId || !title || !type) {
            return errorResponse(res, "batchId, title and type are required", {}, 400);
        }

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const typeDataKey = { document: "document_data", video: "video_data", scorm: "scorm_data" }[type];
        if (!typeDataKey) return errorResponse(res, "Unsupported type", {}, 400);

        const material = await Activity.create({
            module_id: batch.module_id,
            engage_type: "training_material",
            image_url: image_url || "",
            created_by: trainerId,
            [typeDataKey]: { title, ...(typeDataKey === "document_data" ? { image_url: file_url } : { video_url: file_url }) },
        });

        return successResponse(res, "Material uploaded successfully", { material });
    } catch (error) {
        next(error);
    }
};

exports.deleteMaterial = async (req, res, next) => {
    try {
        const { materialId } = req.params;
        const deleted = await Activity.findOneAndDelete({ _id: materialId, engage_type: "training_material" });
        if (!deleted) return errorResponse(res, "Material not found", {}, 404);
        return successResponse(res, "Material deleted successfully", {});
    } catch (error) {
        next(error);
    }
};
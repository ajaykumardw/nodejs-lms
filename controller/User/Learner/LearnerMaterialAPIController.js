const mongoose = require("mongoose")
const Batch = require("../../../model/Batch");
const Activity = require("../../../model/Activity");
const BatchSession = require("../../../model/BatchSession")
const ActivityLog = require("../../../model/ActivityFolderReport");
const { successResponse, errorResponse } = require("../../../util/response");
const { resolveActivityDisplay } = require("../../../util/resolveActivityDisplay");

exports.getMaterials = async (req, res, next) => {
    try {

        const learnerId = mongoose.Types.ObjectId.createFromHexString(req.userId);
        const { batchId, sessionId } = req.query;

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

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

        const isMaterialAllowed = now >= startDateTime && now <= endDateTime;

        const isAllowed = session && availableSessions && isMaterialAllowed

        const activities = await Activity.aggregate([
            {
                $match: {
                    module_id: batch.module_id,
                    engage_type: "training_material",
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

        return successResponse(res, "Materials fetched successfully", { items, isAllowed });
    } catch (error) {
        next(error);
    }
};
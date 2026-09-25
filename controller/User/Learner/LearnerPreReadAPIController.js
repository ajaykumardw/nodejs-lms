const mongoose = require("mongoose");
const Activity = require("../../../model/Activity");
const Batch = require("../../../model/Batch");
const Module = require("../../../model/Module");
const ContentFolder = require("../../../model/ContentFolder");
const ActivityLog = require("../../../model/ActivityFolderReport");
const { resolveActivityDisplay } = require("../../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../../util/response");

exports.getPreReadItems = async (req, res, next) => {
    try {
        const learnerId = mongoose.Types.ObjectId.createFromHexString(req.userId);
        const { batchId, sessionId } = req.query;

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const activities = await Activity.aggregate([
            {
                $match: {
                    module_id: batch.module_id,
                    engage_type: "pre_read",
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
            {
                $lookup: {
                    from: 'certificates',
                    localField: 'moduleSetting.selectedCertificateId',
                    foreignField: '_id',
                    as: 'moduleSetting.selectedCertificateId'
                }
            },
            {
                $addFields: {
                    'moduleSetting.selectedCertificateId': {
                        $arrayElemAt: ['$moduleSetting.selectedCertificateId', 0]
                    }
                }
            },
            {
                $lookup: {
                    from: 'activity_logs',
                    let: {
                        activityId: '$_id',
                        userId: learnerId,
                        batchId: mongoose.Types.ObjectId.createFromHexString(batchId),
                        sessionId: mongoose.Types.ObjectId.createFromHexString(sessionId)
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$user_id', '$$userId'] },
                                        { $eq: ['$activity_id', '$$activityId'] },
                                        { $eq: ['$batch_id', '$$batchId'] },
                                        { $eq: ['$session_id', '$$sessionId'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'logs'
                }
            },
            {
                $addFields: {
                    has_completed: {
                        $in: [true, '$logs.is_completed']
                    }
                }
            },
            {
                $match: {
                    $expr: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id', mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae68834')
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
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id', mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae68835')
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
                                {
                                    case: {
                                        $eq: [
                                            '$module_type_id', mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae68836')
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
                                {
                                    case: {
                                        $eq: ['$module_type_id', mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae68837')]
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
                                {
                                    case: {
                                        $in: [
                                            '$module_type_id',
                                            [
                                                mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae68838'),
                                                mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae68839'),
                                                mongoose.Types.ObjectId.createFromHexString('688723af5dd97f4ccae6883a')
                                            ]
                                        ]
                                    },
                                    then: false
                                },
                                {
                                    case: {
                                        $eq: ['$module_type_id', mongoose.Types.ObjectId.createFromHexString('68886902954c4d9dc7a379bd')]
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

        return successResponse(res, "Pre-read fetched", { items });
    } catch (error) {
        next(error);
    }
};

exports.togglePreReadDone = async (req, res, next) => {
    try {
        const { id: preReadId } = req.params;
        const userId = req.userId;
        const { batchId, sessionId } = req.body;

        const activity = await Activity.findById(preReadId).lean();
        if (!activity) return errorResponse(res, "Pre-read item not found", {}, 404);

        const moduleDoc = await Module.findById(activity.module_id).lean();
        const contentFolder = await ContentFolder.findById(moduleDoc?.content_folder_id).lean();
        const programId = contentFolder?.program_id;

        const existing = await ActivityLog.findOne({
            activity_id: preReadId,
            user_id: userId,
            batch_id: batchId,
            session_id: sessionId,
        }).lean();

        const nextDone = !(existing?.is_completed);

        const record = await ActivityLog.findOneAndUpdate(
            { activity_id: preReadId, user_id: userId, batch_id: batchId },
            {
                $set: {
                    module_id: activity.module_id,
                    program_id: programId,
                    content_folder_id: contentFolder?._id,
                    activity_id: activity._id,
                    user_id: userId,
                    batch_id: batchId,
                    session_id: sessionId,
                    engage_type: "pre_read",
                    module_type_id: activity.module_type_id,
                    is_completed: nextDone,
                    completed_at_time: nextDone ? new Date() : null,
                },
            },
            { new: true, upsert: true }
        );

        return successResponse(res, "Pre-read status updated", { record });
    } catch (error) {
        next(error);
    }
};
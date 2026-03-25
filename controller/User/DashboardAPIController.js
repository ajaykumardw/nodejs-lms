const mongoose = require("mongoose")
const Module = require("../../model/Module");
const AppConfig = require("../../model/AppConfig")
const NotificationLog = require("../../model/NotificationLog")
const ActivityLog = require("../../model/ActivityFolderReport");
const { successResponse } = require("../../util/response");

exports.getDashboardAPI = async (req, res, next) => {
    try {

        const userObjectId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        const liveSessionId = mongoose.Types.ObjectId.createFromHexString("688219557b6953e899cb57d3")

        const module = await Module.aggregate([
            {
                $lookup: {
                    from: "activity_logs",
                    let: { user_id: userObjectId, id: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$user_id", "$$user_id"] },
                                        { $eq: ["$module_id", "$$id"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "activity_logs"
                }
            },
            {
                $lookup: {
                    from: "program_schedules",
                    let: { moduleId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$module_id", "$$moduleId"]
                                }
                            }
                        }
                    ],
                    as: "programSchedule"
                }
            },
            {
                $unwind: {
                    path: "$programSchedule",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "schedule_type",
                    let: { scheduleId: "$programSchedule._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$schedule_id", "$$scheduleId"]
                                }
                            }
                        }
                    ],
                    as: "scheduleType"
                }
            },
            {
                $lookup: {
                    from: "schedule_users",
                    let: { scheduleId: "$programSchedule._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$schedule_id", "$$scheduleId"]
                                }
                            }
                        }
                    ],
                    as: "scheduleUser"
                }
            },
            {
                $addFields: {
                    allowedUser: {
                        $setUnion: [
                            {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: "$scheduleType",
                                            as: "st",
                                            cond: { $eq: ["$$st.type", "5"] }
                                        }
                                    },
                                    as: "t1",
                                    in: "$$t1.type_id"
                                }
                            },
                            {
                                $map: {
                                    input: "$scheduleUser",
                                    as: "t2",
                                    in: "$$t2.user_id"
                                }
                            }
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: "user_module_enroll",
                    let: { moduleId: "$_id", userId: userObjectId },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$module_id", "$$moduleId"] },
                                        { $eq: ["$user_id", "$$userId"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "moduleEnroll"
                }
            },
            {
                $match: {
                    "programSchedule._id": { $exists: true },
                    $or: [
                        {
                            $expr: {
                                $in: [userObjectId, "$allowedUser"]
                            }
                        },
                        {
                            $expr: {
                                $and: [
                                    { $eq: ["$programSchedule.pushEnrollmentSetting", 2] },
                                    { $gt: [{ $size: "$moduleEnroll" }, 0] }
                                ]
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "app_config",
                    let: { moduleTypeId: "$module_type_id" },
                    pipeline: [
                        { $unwind: "$module_data" },
                        {
                            $match: {
                                $expr: { $eq: ["$module_data._id", "$$moduleTypeId"] }
                            }
                        },
                        { $project: { title: "$module_data.title" } }
                    ],
                    as: "moduleTypeInfo"
                }
            },
            { $unwind: { path: "$moduleTypeInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    description: 1,
                    moduleTypeName: "$moduleTypeInfo.title",
                }
            }
        ]);

        const moduleIds = module.map(m => (m._id));

        const [progressStatus] = await ActivityLog.aggregate([
            {
                $match: {
                    module_id: { $in: moduleIds },
                    user_id: userObjectId
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    not_started: {
                        $sum: {
                            $cond: [{ $eq: ["$progress_status", "1"] }, 1, 0]
                        }
                    },
                    in_progress: {
                        $sum: {
                            $cond: [{ $eq: ["$progress_status", "2"] }, 1, 0]
                        }
                    },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ["$progress_status", "3"] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    total: 1,
                    not_started: 1,
                    in_progress: 1,
                    completed: 1,
                    not_started_percentage: {
                        $multiply: [
                            { $divide: ["$not_started", "$total"] },
                            100
                        ]
                    },
                    in_progress_percentage: {
                        $multiply: [
                            { $divide: ["$in_progress", "$total"] },
                            100
                        ]
                    },
                    completed_percentage: {
                        $multiply: [
                            { $divide: ["$completed", "$total"] },
                            100
                        ]
                    }
                }
            }
        ]);

        const activity = await AppConfig.aggregate([
            {
                $unwind: "$activity_data"
            },
            {
                $lookup: {
                    from: "activity",
                    let: { activityId: "$activity_data._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $in: ["$module_id", moduleIds] },
                                        { $eq: ["$module_type_id", "$$activityId"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "activities"
                }
            },
            {
                $addFields: {
                    count: { $size: "$activities" }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$count" },
                    modules: {
                        $push: {
                            _id: "$activity_data._id",
                            title: "$activity_data.title",
                            count: "$count"
                        }
                    }
                }
            },
            {
                $unwind: "$modules"
            },
            {
                $project: {
                    _id: "$modules._id",
                    title: "$modules.title",
                    count: "$modules.count",
                    percentage: {
                        $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            {
                                $multiply: [
                                    { $divide: ["$modules.count", "$total"] },
                                    100
                                ]
                            }
                        ]
                    }
                }
            }
        ]);

        const liveSession = await Module.aggregate([
            {
                $match: {
                    _id: { $in: moduleIds },
                    module_type_id: liveSessionId
                }
            },
            {
                $project: {
                    title: 1,
                    description: 1,

                    start_live_time: {
                        $let: {
                            vars: {
                                date: { $toDate: "$start_live_time" }
                            },
                            in: {
                                $concat: [
                                    { $dateToString: { format: "%d %b | ", date: "$$date", timezone: "Asia/Kolkata" } },

                                    // hour conversion
                                    {
                                        $toString: {
                                            $let: {
                                                vars: { hour: { $hour: { date: "$$date", timezone: "Asia/Kolkata" } } },
                                                in: {
                                                    $cond: [
                                                        { $eq: ["$$hour", 0] }, 12,
                                                        {
                                                            $cond: [
                                                                { $gt: ["$$hour", 12] },
                                                                { $subtract: ["$$hour", 12] },
                                                                "$$hour"
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    },

                                    ":",
                                    {
                                        $dateToString: {
                                            format: "%M",
                                            date: "$$date",
                                            timezone: "Asia/Kolkata"
                                        }
                                    },
                                    " ",
                                    {
                                        $cond: [
                                            { $gte: [{ $hour: { date: "$$date", timezone: "Asia/Kolkata" } }, 12] },
                                            "PM",
                                            "AM"
                                        ]
                                    }
                                ]
                            }
                        }
                    },

                    end_live_time: {
                        $let: {
                            vars: {
                                date: { $toDate: "$end_live_time" }
                            },
                            in: {
                                $concat: [
                                    { $dateToString: { format: "%d %b | ", date: "$$date", timezone: "Asia/Kolkata" } },
                                    {
                                        $toString: {
                                            $let: {
                                                vars: { hour: { $hour: { date: "$$date", timezone: "Asia/Kolkata" } } },
                                                in: {
                                                    $cond: [
                                                        { $eq: ["$$hour", 0] }, 12,
                                                        {
                                                            $cond: [
                                                                { $gt: ["$$hour", 12] },
                                                                { $subtract: ["$$hour", 12] },
                                                                "$$hour"
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    },
                                    ":",
                                    {
                                        $dateToString: {
                                            format: "%M",
                                            date: "$$date",
                                            timezone: "Asia/Kolkata"
                                        }
                                    },
                                    " ",
                                    {
                                        $cond: [
                                            { $gte: [{ $hour: { date: "$$date", timezone: "Asia/Kolkata" } }, 12] },
                                            "PM",
                                            "AM"
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]);

        const notificationLog = await NotificationLog.aggregate([
            {
                $match: {
                    user_id: userObjectId
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $project: {
                    user: 1,
                    template_name: 1,
                    reason: 1,
                    schedule_date: 1,
                }
            }
        ]
        )

        const activityLog = await ActivityLog.aggregate([
            {
                $match: {
                    module_id: { $in: moduleIds }
                }
            },
            {
                $lookup: {
                    from: "app_config",
                    let: {
                        moduleTypeId: {
                            $cond: [
                                { $eq: [{ $type: "$module_type_id" }, "objectId"] },
                                "$module_type_id",
                                {
                                    $cond: [
                                        { $eq: [{ $type: "$module_type_id" }, "string"] },
                                        { $toObjectId: "$module_type_id" },
                                        null
                                    ]
                                }
                            ]
                        }
                    },
                    pipeline: [
                        { $match: { type: "Activity_data" } },
                        { $unwind: "$activity_data" },
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $ne: ["$$moduleTypeId", null] },
                                        {
                                            $eq: [
                                                "$activity_data._id",
                                                "$$moduleTypeId"
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "moduleType"
                }
            },
            {
                $unwind: {
                    path: "$moduleType",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    title: "$moduleType.activity_data.title",
                    description: "$moduleType.activity_data.description",
                    current_attempt: 1
                }
            },
            {
                $sort: {
                    current_attempt: -1
                }
            },
            {
                $limit: 5
            }
        ]);

        const finalData = {
            enrolledData: module,
            activityLog,
            progressStatus,
            activitySummary: activity,
            liveSession,
            notificationLog
        }

        return successResponse(res, "Module fetched successfully", finalData)

    } catch (error) {
        next(error)
    }
}
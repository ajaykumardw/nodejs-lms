const Module = require("../../model/Module");
const mongoose = require("mongoose");
const User = require("../../model/User");
const AppConfig = require("../../model/AppConfig")
const Activity = require("../../model/Activity");
const ActivityLog = require("../../model/ActivityFolderReport");
const { successResponse } = require("../../util/response");

exports.getDashboardAPIController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const totalLearner = await User.find({ created_by: userId })
            .select("_id first_name last_name")
            .lean();

        const activeLearner = await User.find({
            created_by: userId,
            status: true
        })
            .select("_id first_name last_name")
            .lean();

        const modules = await Module.find({ created_by: userId })
            .select("_id title description")
            .lean();

        const moduleIds = modules.map(m => (m._id));

        const activities = await Activity.find({
            module_id: { $in: moduleIds }
        }).lean();

        const logs = await ActivityLog.find({
            is_completed: true,
            module_id: { $in: moduleIds }
        }).lean();

        const activityMap = {};

        activities.forEach(act => {
            const moduleId = String(act.module_id);

            if (!activityMap[moduleId]) {
                activityMap[moduleId] = [];
            }

            activityMap[moduleId].push(String(act._id));
        });

        const completedMap = {};

        logs.forEach(log => {
            const moduleId = String(log.module_id);

            if (!completedMap[moduleId]) {
                completedMap[moduleId] = [];
            }

            completedMap[moduleId].push(String(log.activity_id));
        });

        const completedModules = modules.filter(module => {
            const moduleId = String(module._id);

            const moduleActivities = activityMap[moduleId] || [];
            const completedActivities = completedMap[moduleId] || [];

            return (
                moduleActivities.length > 0 &&
                moduleActivities.every(actId =>
                    completedActivities.includes(actId)
                )
            );
        });

        const activityProgressStatus = await ActivityLog.aggregate([
            {
                $match: {
                    module_id: { $in: moduleIds }
                }
            },
            {
                $addFields: {
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
                }
            },
            {
                $group: {
                    _id: "$moduleTypeId",
                    totalLogs: { $sum: 1 },
                    completedLogs: {
                        $sum: {
                            $cond: [{ $eq: ["$is_completed", true] }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    completionPercentage: {
                        $cond: [
                            { $eq: ["$totalLogs", 0] },
                            0,
                            {
                                $multiply: [
                                    { $divide: ["$completedLogs", "$totalLogs"] },
                                    100
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: "app_config",
                    let: { moduleTypeId: "$_id" },
                    pipeline: [
                        { $match: { type: "Activity_data" } },
                        { $unwind: "$activity_data" },
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$activity_data._id", "$$moduleTypeId"]
                                }
                            }
                        }
                    ],
                    as: "moduleType"
                }
            },
            { $unwind: { path: "$moduleType", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    module_type_id: "$_id",
                    totalLogs: 1,
                    completedLogs: 1,
                    completionPercentage: { $round: ["$completionPercentage", 2] },
                    moduleType: "$moduleType.activity_data.title"
                }
            }
        ]);

        const moduleProgressStatus = await ActivityLog.aggregate([
            {
                $match: {
                    module_id: { $in: moduleIds }
                }
            },
            {
                $group: {
                    _id: "$module_id",
                    totalLogs: { $sum: 1 },
                    completedLogs: {
                        $sum: {
                            $cond: [{ $eq: ["$is_completed", true] }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    completionPercentage: {
                        $cond: [
                            { $eq: ["$totalLogs", 0] },
                            0,
                            {
                                $multiply: [
                                    { $divide: ["$completedLogs", "$totalLogs"] },
                                    100
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: "modules",
                    localField: "_id",
                    foreignField: "_id",
                    as: "module"
                }
            },
            { $unwind: { path: "$module", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    module_id: "$_id",
                    module_title: "$module.title",
                    totalLogs: 1,
                    completedLogs: 1,
                    completionPercentage: { $round: ["$completionPercentage", 2] }
                }
            }
        ]);

        const pendingTask = await AppConfig.aggregate([
            {
                $unwind: "$activity_data"
            },
            {
                $lookup: {
                    from: "activity",
                    let: { moduleTypeId: "$activity_data._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$module_type_id", "$$moduleTypeId"] },
                                        { $in: ["$module_id", moduleIds] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "activity_logs",
                                localField: "_id",
                                foreignField: "activity_id",
                                as: "activityLog"
                            }
                        },
                        {
                            $match: {
                                $expr: { $eq: [{ $size: "$activityLog" }, 0] } // no logs
                            }
                        }
                    ],
                    as: "activities"
                }
            },
            {
                $project: {
                    module_type_id: "$activity_data._id",
                    title: "$activity_data.title",
                    count: { $size: "$activities" }
                }
            },
            {
                $match: {
                    count: { $gt: 0 } // optional: remove empty ones
                }
            }
        ]);

        const [progressStatus] = await ActivityLog.aggregate([
            {
                $match: {
                    module_id: { $in: moduleIds },
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

        const [QuizProgressStatus] = await ActivityLog.aggregate([
            {
                $match: {
                    module_id: { $in: moduleIds },
                    module_type_id: mongoose.Types.ObjectId.createFromHexString("68886902954c4d9dc7a379bd")
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    not_passed: {
                        $sum: {
                            $cond: [{ $eq: ["$is_passed", false] }, 1, 0]
                        }
                    },
                    passed: {
                        $sum: {
                            $cond: [{ $eq: ["$is_passed", true] }, 1, 0]
                        }
                    },
                    not_started: {
                        $sum: {
                            $cond: [{ $eq: ["$progress_status", "2"] }, 1, 0] // change to 2 if number
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    total: 1,
                    not_passed: 1,
                    passed: 1,
                    not_started: 1,

                    not_passed_percentage: {
                        $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            { $multiply: [{ $divide: ["$not_passed", "$total"] }, 100] }
                        ]
                    },
                    not_started_percentage: {
                        $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            { $multiply: [{ $divide: ["$not_started", "$total"] }, 100] }
                        ]
                    },
                    passed_percentage: {
                        $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            { $multiply: [{ $divide: ["$passed", "$total"] }, 100] }
                        ]
                    }
                }
            }
        ]);

        const recentActivity = await ActivityLog.aggregate([
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

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // FY logic (India Apr–Mar)
        const currentFY = currentMonth >= 4 ? currentYear : currentYear - 1;
        const previousFY = currentFY - 1;

        const modesLearning = await AppConfig.aggregate([
            { $unwind: "$module_data" },
            {
                $lookup: {
                    from: "modules",
                    localField: "module_data._id",
                    foreignField: "module_type_id",
                    as: "modules"
                }
            },
            { $unwind: { path: "$modules", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "program_schedules",
                    localField: "modules._id",
                    foreignField: "module_id",
                    as: "schedule"
                }
            },
            { $unwind: { path: "$schedule", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "schedule_users",
                    localField: "schedule._id",
                    foreignField: "schedule_id",
                    as: "scheduleUsers"
                }
            },
            {
                $lookup: {
                    from: "schedule_type",
                    localField: "schedule._id",
                    foreignField: "schedule_id",
                    as: "scheduleTypes"
                }
            },
            {
                $lookup: {
                    from: "user_module_enroll",
                    localField: "modules._id",
                    foreignField: "module_id",
                    as: "enrollUsers"
                }
            },
            {
                $addFields: {
                    allUsers: {
                        $setUnion: [
                            {
                                $map: {
                                    input: {
                                        $filter: {
                                            input: "$scheduleTypes",
                                            as: "st",
                                            cond: { $eq: ["$$st.type", "5"] }
                                        }
                                    },
                                    as: "s",
                                    in: "$$s.type_id"
                                }
                            },
                            {
                                $map: {
                                    input: "$scheduleUsers",
                                    as: "su",
                                    in: "$$su.user_id"
                                }
                            },
                            {
                                $map: {
                                    input: "$enrollUsers",
                                    as: "eu",
                                    in: "$$eu.user_id"
                                }
                            }
                        ]
                    }
                }
            },
            { $unwind: { path: "$allUsers", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    year: { $year: "$schedule.published_date" },
                    month: { $month: "$schedule.published_date" }
                }
            },
            {
                $addFields: {
                    financialYear: {
                        $cond: [
                            { $gte: ["$month", 4] },
                            "$year",
                            { $subtract: ["$year", 1] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        module_type_id: "$module_data._id",
                        title: "$module_data.title",
                        fy: "$financialYear"
                    },
                    users: { $addToSet: "$allUsers" }
                }
            },
            {
                $project: {
                    module_type_id: "$_id.module_type_id",
                    title: "$_id.title",
                    fy: "$_id.fy",
                    userCount: {
                        $size: {
                            $filter: {
                                input: "$users",
                                as: "u",
                                cond: { $ne: ["$$u", null] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: {
                        module_type_id: "$module_type_id",
                        title: "$title"
                    },
                    currentFYUsers: {
                        $sum: {
                            $cond: [{ $eq: ["$fy", currentFY] }, "$userCount", 0]
                        }
                    },
                    previousFYUsers: {
                        $sum: {
                            $cond: [{ $eq: ["$fy", previousFY] }, "$userCount", 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    module_type_id: "$_id.module_type_id",
                    title: "$_id.title",
                    currentFYUsers: { $ifNull: ["$currentFYUsers", 0] },
                    previousFYUsers: { $ifNull: ["$previousFYUsers", 0] },
                    previousFinancialYear: {
                        $concat: [
                            { $toString: currentFY },
                            "-",
                            { $toString: { $subtract: [currentFY, 1] } }
                        ]
                    },
                    currentFinancialYear: {
                        $concat: [
                            { $toString: previousFY },
                            "-",
                            { $toString: { $subtract: [previousFY, 1] } }
                        ]
                    }
                }
            }
        ]);

        const finalData = {
            totalModule: modules,
            totalLearner,
            activeLearner,
            completedModules,
            moduleActivity: activityProgressStatus,
            learnerProgress: moduleProgressStatus,
            pendingTask,
            CourseProgressStatus: progressStatus,
            QuizProgressStatus,
            modesLearning,
            recentActivity
        };

        return successResponse(
            res,
            "Dashboard data fetched successfully",
            finalData
        );

    } catch (error) {
        next(error);
    }
};
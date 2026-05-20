const mongoose = require("mongoose");

const User = require("../../model/User")
const Role = require("../../model/Role")
const Zone = require("../../model/Zone");
const Group = require("../../model/Group");
const Module = require("../../model/Module");
const Program = require("../../model/Program")
const Country = require("../../model/Country")
const Activity = require("../../model/Activity")
const ActivityFolderReport = require("../../model/ActivityFolderReport")
const AppConfig = require("../../model/AppConfig")
const Department = require("../../model/Department");
const Designation = require("../../model/Designation");
const LoginSession = require("../../model/LoginSession");
const ContentFolder = require("../../model/ContentFolder");
const ParticipationType = require("../../model/ParticipationType")

const { decrypt } = require('../../util/encryption');
const { successResponse, errorResponse } = require("../../util/response");

exports.getDashboardCompleteRatioReport = async (req, res, next) => {
    try {

        const companyId = mongoose.Types.ObjectId.createFromHexString(req.userId);

        const users = await User.find({ created_by: companyId }).select("_id");

        const userIds = users.map(user => user._id);

        let data = req?.query;

        if (typeof data === "string" && data !== '') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        const matchQuery = { created_by: companyId };

        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {
            matchQuery.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime),
            };
        }

        const report = await Module.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: "activity",
                    localField: "_id",
                    foreignField: "module_id",
                    as: "activities"
                }
            },
            {
                $lookup: {
                    from: "activity_logs",
                    localField: "_id",
                    foreignField: "module_id",
                    as: "activityLogs"
                }
            },
            {
                $lookup: {
                    from: "user_module_enroll",
                    let: { moduleId: "$_id", userIds },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$module_id", "$$moduleId"] },
                                        { $in: ["$user_id", "$$userIds"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "moduleEnrollment"
                }
            },
            {
                $addFields: {
                    enrolledUserIds: {
                        $map: {
                            input: "$moduleEnrollment",
                            as: "me",
                            in: "$$me.user_id"
                        }
                    },
                    enrolledCount: { $size: "$moduleEnrollment" }
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
                $addFields: {
                    activitiesProgress: {
                        $map: {
                            input: "$activities",
                            as: "activity",
                            in: {
                                activityId: "$$activity._id",
                                progressStatus: {
                                    $let: {
                                        vars: {
                                            logs: {
                                                $filter: {
                                                    input: "$activityLogs",
                                                    as: "log",
                                                    cond: { $eq: ["$$log.activity_id", "$$activity._id"] }
                                                }
                                            }
                                        },
                                        in: {
                                            $switch: {
                                                branches: [
                                                    // any "2" → in_progress
                                                    {
                                                        case: {
                                                            $in: [
                                                                "2",
                                                                {
                                                                    $map: {
                                                                        input: "$$logs",
                                                                        as: "l",
                                                                        in: "$$l.progress_status"
                                                                    }
                                                                }
                                                            ]
                                                        },
                                                        then: 2
                                                    },
                                                    // all "3" → completed
                                                    {
                                                        case: {
                                                            $and: [
                                                                { $gt: [{ $size: "$$logs" }, 0] },
                                                                {
                                                                    $allElementsTrue: {
                                                                        $map: {
                                                                            input: "$$logs",
                                                                            as: "l",
                                                                            in: { $eq: ["$$l.progress_status", "3"] }
                                                                        }
                                                                    }
                                                                }
                                                            ]
                                                        },
                                                        then: 3
                                                    }
                                                ],
                                                // default → not_started
                                                default: 1
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    moduleStatus: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $size: "$activities" }, 0] },
                                    then: "not_started"
                                },
                                {
                                    case: {
                                        $allElementsTrue: {
                                            $map: {
                                                input: "$activitiesProgress",
                                                as: "a",
                                                in: { $eq: ["$$a.progressStatus", 3] }
                                            }
                                        }
                                    },
                                    then: "completed"
                                },
                                {
                                    case: {
                                        $allElementsTrue: {
                                            $map: {
                                                input: "$activitiesProgress",
                                                as: "a",
                                                in: { $eq: ["$$a.progressStatus", 1] }
                                            }
                                        }
                                    },
                                    then: "not_started"
                                }
                            ],
                            default: "in_progress"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$module_type_id",
                    moduleTypeName: { $first: "$moduleTypeInfo.title" },
                    totalModules: { $sum: 1 },
                    totalEnrolledModules: {
                        $sum: { $cond: [{ $gt: ["$enrolledCount", 0] }, 1, 0] }
                    },
                    moduleEnrollment: { $addToSet: "$enrolledUserIds" },
                    completedModules: {
                        $sum: { $cond: [{ $eq: ["$moduleStatus", "completed"] }, 1, 0] }
                    },
                    inProgressModules: {
                        $sum: { $cond: [{ $eq: ["$moduleStatus", "in_progress"] }, 1, 0] }
                    },
                    notStartedModules: {
                        $sum: { $cond: [{ $eq: ["$moduleStatus", "not_started"] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    moduleEnrollment: {
                        $size: {
                            $reduce: {
                                input: "$moduleEnrollment",
                                initialValue: [],
                                in: { $setUnion: ["$$value", "$$this"] }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    completedPercent: {
                        $multiply: [{ $divide: ["$completedModules", "$totalModules"] }, 100]
                    },
                    inProgressPercent: {
                        $multiply: [{ $divide: ["$inProgressModules", "$totalModules"] }, 100]
                    },
                    notStartedPercent: {
                        $multiply: [{ $divide: ["$notStartedModules", "$totalModules"] }, 100]
                    }
                }
            },
            {
                $project: {
                    moduleTypeId: "$_id",
                    moduleTypeName: 1,
                    totalModules: 1,
                    totalEnrolledModules: 1,
                    moduleEnrollment: 1,
                    completedPercent: 1,
                    inProgressPercent: 1,
                    notStartedPercent: 1
                }
            }
        ]);

        return successResponse(res, "Dashboard report fetched successfully", report);

    } catch (error) {
        console.error("Error fetching dashboard report:", error);
        next(error);
    }
};

exports.getByModuleReportController = async (req, res, next) => {
    try {

        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        const userss = await User.find({ created_by: userId }).select("_id");

        const userIds = userss.map(user => user._id);

        let data = req?.query;

        // If data is a string, try to parse it; otherwise, use it directly
        if (typeof data === "string" && data !== '') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        const matchQuery = { created_by: userId };

        // Add date filtering if fromTime and toTime exist and are valid
        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {
            matchQuery.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime),
            };
        }

        const byModuleReport = await Module.aggregate([
            {
                $match: matchQuery
            },
            {
                $lookup: {
                    from: "user_module_enroll",
                    let: { moduleId: "$_id", userIds: userIds },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$module_id", "$$moduleId"] },
                                        { $in: ["$user_id", "$$userIds"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "moduleEnrollment",
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
                        {
                            $project: {
                                _id: 0,
                                title: "$module_data.title"
                            }
                        }
                    ],
                    as: "moduleTypeName"
                }
            },
            {
                $unwind: {
                    path: "$moduleTypeName",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    enrolledCount: { $size: "$moduleEnrollment" }
                }
            },
            {
                $addFields: {
                    activityStatus: {
                        $map: {
                            input: "$activity",
                            as: "act",
                            in: {
                                $let: {
                                    vars: {
                                        logs: {
                                            $filter: {
                                                input: "$activityLogs",
                                                as: "log",
                                                cond: { $eq: ["$$log.activity_id", "$$act._id"] }
                                            }
                                        }
                                    },
                                    in: {
                                        $cond: [
                                            { $eq: [{ $size: "$$logs" }, 0] },
                                            "not_started",
                                            {
                                                $cond: [
                                                    {
                                                        $anyElementTrue: {
                                                            $map: {
                                                                input: "$$logs",
                                                                as: "l",
                                                                in: { $eq: ["$$l.progress_status", "2"] }
                                                            }
                                                        }
                                                    },
                                                    "in_progress",
                                                    {
                                                        $cond: [
                                                            {
                                                                $allElementsTrue: {
                                                                    $map: {
                                                                        input: "$$logs",
                                                                        as: "l",
                                                                        in: { $eq: ["$$l.progress_status", "3"] }
                                                                    }
                                                                }
                                                            },
                                                            "completed",
                                                            "not_started"
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    status: {
                        $let: {
                            vars: {
                                activityStatusSafe: { $ifNull: ["$activityStatus", []] }
                            },
                            in: {
                                $cond: [
                                    { $in: ["in_progress", "$$activityStatusSafe"] },
                                    "In Progress",
                                    {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $gt: [{ $size: "$$activityStatusSafe" }, 0] },
                                                    {
                                                        $allElementsTrue: {
                                                            $map: {
                                                                input: "$$activityStatusSafe",
                                                                as: "s",
                                                                in: { $eq: ["$$s", "completed"] }
                                                            }
                                                        }
                                                    }
                                                ]
                                            },
                                            "Completed",
                                            "Not Started"
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    module_name: "$title",
                    module_type_name: "$moduleTypeName.title",
                    enrolledCount: 1,
                    status: 1
                }
            }
        ]);

        return successResponse(res, "Report fetched successfully", byModuleReport)

    } catch (error) {
        next(error)
    }
}

exports.getByProgramReportController = async (req, res, next) => {
    try {

        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        let data = req?.query;

        if (typeof data === "string" && data !== '') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        const matchQuery = { created_by: userId };

        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {
            matchQuery.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime),
            };
        }

        const programReport = await Program.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: "content_folder",
                    localField: "_id",
                    foreignField: "program_id",
                    as: "contentFolders",
                },
            },
            {
                $lookup: {
                    from: "modules",
                    let: { folderIds: "$contentFolders._id" },
                    pipeline: [
                        { $match: { $expr: { $in: ["$content_folder_id", "$$folderIds"] } } },
                    ],
                    as: "modules",
                },
            },
            { $unwind: "$modules" },
            {
                $lookup: {
                    from: "activity_logs",
                    localField: "modules._id",
                    foreignField: "module_id",
                    as: "modules.activityLogs",
                },
            },
            {
                $addFields: {
                    "modules.moduleStatus": {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $size: "$modules.activityLogs" }, 0] },
                                    then: "not_started"
                                },
                                {
                                    case: {
                                        $allElementsTrue: {
                                            $map: {
                                                input: "$modules.activityLogs",
                                                as: "log",
                                                in: { $eq: ["$$log.progress_status", "3"] }
                                            }
                                        }
                                    },
                                    then: "completed"
                                },
                                {
                                    case: {
                                        $in: [
                                            "2",
                                            {
                                                $map: {
                                                    input: "$modules.activityLogs",
                                                    as: "log",
                                                    in: "$$log.progress_status"
                                                }
                                            }
                                        ]
                                    },
                                    then: "in_progress"
                                }
                            ],
                            default: "not_started"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    programTitle: { $first: "$title" },
                    modules: { $push: "$modules" },
                },
            },
            {
                $addFields: {
                    totalModules: { $size: "$modules" },
                    completedModules: {
                        $size: {
                            $filter: { input: "$modules", as: "m", cond: { $eq: ["$$m.moduleStatus", "completed"] } },
                        },
                    },
                    inProgressModules: {
                        $size: {
                            $filter: { input: "$modules", as: "m", cond: { $eq: ["$$m.moduleStatus", "in_progress"] } },
                        },
                    },
                    notStartedModules: {
                        $size: {
                            $filter: { input: "$modules", as: "m", cond: { $eq: ["$$m.moduleStatus", "not_started"] } },
                        },
                    },
                },
            },
            {
                $addFields: {
                    completionPercentage: {
                        $cond: [
                            { $eq: ["$totalModules", 0] },
                            0,
                            { $multiply: [{ $divide: ["$completedModules", "$totalModules"] }, 100] },
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    programTitle: 1,
                    totalModules: 1,
                    completedModules: 1,
                    inProgressModules: 1,
                    notStartedModules: 1,
                    completionPercentage: 1,
                },
            },
        ]);


        return successResponse(res, "Program fetched successfully", programReport)

    } catch (error) {
        next(error)
    }
}

exports.getByLearnerController = async (req, res, next) => {
    try {
        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        const userss = await User.find({ created_by: userId }, { _id: 1 });
        const userIds = userss.map(u => u._id);

        let data = req?.query;

        if (typeof data === "string" && data.trim() !== '') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        const matchQuery = { created_by: userId };

        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {
            const from = new Date(data.fromTime);
            const to = new Date(data.toTime);
            if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
                matchQuery.created_at = { $gte: from, $lte: to };
            }
        }

        if (data.designation) {
            matchQuery.designation_id = mongoose.Types.ObjectId.createFromHexString(data.designation);
        }

        if (data.department) {
            matchQuery.zone_id = mongoose.Types.ObjectId.createFromHexString(data.department);
        }

        if (data.location) {
            matchQuery.state_id = data.location;
        }

        if (data.region) {
            matchQuery.region_id = mongoose.Types.ObjectId.createFromHexString(data.region);
        }

        if (data.userStatus) {
            if (data.userStatus === '1') matchQuery.status = true;
            else if (data.userStatus === '2') matchQuery.status = false;
        }

        const users = await User.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: "user_module_enroll",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$user_id", "$$userId"] }
                            }
                        }
                    ],
                    as: "moduleEnrollment"
                }
            },

            {
                $addFields: {
                    moduleArray: {
                        $map: {
                            input: "$moduleEnrollment",
                            as: "m",
                            in: "$$m.module_id"
                        }
                    },
                    totalModule: { $size: "$moduleEnrollment" }
                }
            },
            {
                $lookup: {
                    from: "activity_logs",
                    let: { userId: "$_id", modules: "$moduleArray" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$user_id", "$$userId"] },
                                        { $in: ["$module_id", "$$modules"] }
                                    ]
                                }
                            }
                        },
                        {
                            $group: {
                                _id: "$module_id",
                                totalLogs: { $sum: 1 },
                                completedLogs: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$progress_status", "3"] },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        },
                        {
                            $addFields: {
                                isCompleted: {
                                    $cond: [
                                        { $eq: ["$totalLogs", "$completedLogs"] },
                                        true,
                                        false
                                    ]
                                }
                            }
                        }
                    ],
                    as: "moduleProgress"
                }
            },
            {
                $addFields: {
                    startedModules: { $size: "$moduleProgress" },

                    completedModules: {
                        $size: {
                            $filter: {
                                input: "$moduleProgress",
                                as: "m",
                                cond: { $eq: ["$$m.isCompleted", true] }
                            }
                        }
                    }
                }
            },

            {
                $addFields: {
                    notStartedModules: {
                        $subtract: ["$totalModule", "$startedModules"]
                    }
                }
            },
            {
                $addFields: {
                    userModuleStatus: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ["$completedModules", "$totalModule"] },
                                    then: "Completed"
                                },
                                {
                                    case: { $eq: ["$startedModules", 0] },
                                    then: "Not Started"
                                }
                            ],
                            default: "In Progress"
                        }
                    },

                    completionPercentage: {
                        $cond: [
                            { $eq: ["$totalModule", 0] },
                            0,
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$completedModules", "$totalModule"] },
                                            100
                                        ]
                                    },
                                    2
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    fullName: {
                        $trim: {
                            input: { $concat: ["$first_name", " ", "$last_name"] }
                        }
                    },
                    userStatus: {
                        $cond: [{ $eq: ["$status", true] }, "Active", "Inactive"]
                    },
                    country_id_num: { $toInt: "$country_id" }
                }
            },
            {
                $lookup: {
                    from: "countries",
                    localField: "country_id_num",
                    foreignField: "country_id",
                    as: "country"
                }
            },
            {
                $unwind: {
                    path: "$country",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    countryName: "$country.country_name"
                }
            },
            {
                $project: {
                    fullName: 1,
                    email: 1,
                    userStatus: 1,
                    totalModule: 1,
                    completedModules: 1,
                    notStartedModules: 1,
                    userModuleStatus: 1,
                    completionPercentage: 1,
                    countryName: 1
                }
            }
        ]);


        const finalUser = users.map(u => ({
            ...u,
            email: u.email ? decrypt(u.email) : null
        }));

        return successResponse(res, "Learner data fetched successfully", finalUser);

    } catch (error) {
        next(error);
    }
};

exports.getFilterDataController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const role = await Role.find({ created_by: userId })

        const department = await Department.find({ created_by: userId })
        const designation = await Designation.find({ company_id: userId })
        const participationType = await ParticipationType.find({ company_id: userId })
        const group = await Group.find({ created_by: userId })

        const zones = await Zone.find({ created_by: userId });
        const region = zones.flatMap(zone => zone.region);

        const program = await Program.find({ created_by: userId })
        const contentFolder = await ContentFolder.find({ created_by: userId })
        const module = await Module.find({ created_by: userId })
        const appConfig = await AppConfig.findOne({ type: "Activity_data" });
        const moduleType = appConfig.activity_data;

        const countries = await Country.find()
        const states = countries
            .flatMap(country => country.states)
            .sort((a, b) =>
                a.state_name.localeCompare(b.state_name, undefined, {
                    sensitivity: "base"
                })
            )

        const attemptType = [
            { _id: 1, title: "All attempt" },
            { _id: 2, title: "Latest attempt" }
        ]

        const finalData = {
            moduleType,
            department,
            region,
            designation,
            role,
            participationType,
            states,
            group,
            module,
            contentFolder,
            attemptType,
            program,
        }

        return successResponse(res, "Filter created successfully", finalData)

    } catch (error) {
        next(error)
    }
}

exports.getModuleTypeUserData = async (req, res, next) => {
    try {

        const userId = mongoose.Types.ObjectId.createFromHexString(req.userId);
        const { moduleTypeId, status } = req.params;

        const progressStatus = String(status);
        const modTypeId = mongoose.Types.ObjectId.createFromHexString(moduleTypeId);

        const users = await User.find({ created_by: userId }, { _id: 1 });
        const userIds = users.map(u => u._id);

        let data = req?.query;

        if (typeof data === "string" && data.trim() !== '') {
            try { data = JSON.parse(data); }
            catch (e) { console.error("Invalid data format", e); data = {}; }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        let matchQuery = { created_by: userId, module_type_id: modTypeId };

        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {

            const from = new Date(data.fromTime);
            const to = new Date(data.toTime);

            if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
                matchQuery.created_at = { $gte: from, $lte: to };
            }
        }

        const modules = await Module.aggregate([
            { $match: matchQuery },
            { $addFields: { users: userIds } },
            { $unwind: "$users" },
            {
                $lookup: {
                    from: "activity_logs",
                    let: { moduleId: "$_id", userId: "$users" },
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
                        },
                        { $sort: { created_at: -1 } }
                    ],
                    as: "logs"
                }
            },
            {
                $addFields: {
                    allowed: {
                        $switch: {
                            branches: [
                                {
                                    case: { $in: [progressStatus, ["1", "3"]] },
                                    then: {
                                        $cond: [
                                            { $eq: [{ $size: "$logs" }, 0] },
                                            { $eq: [progressStatus, "1"] },
                                            {
                                                $allElementsTrue: {
                                                    $map: {
                                                        input: "$logs",
                                                        as: "l",
                                                        in: { $eq: ["$$l.progress_status", progressStatus] }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    case: { $eq: [progressStatus, "2"] },
                                    then: {
                                        $gt: [
                                            {
                                                $size: {
                                                    $filter: {
                                                        input: "$logs",
                                                        as: "l",
                                                        cond: { $eq: ["$$l.progress_status", "2"] }
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                }
                            ],
                            default: false
                        }
                    }
                }
            },
            { $match: { allowed: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "users",
                    foreignField: "_id",
                    as: "user_info"
                }
            },
            { $unwind: "$user_info" },
            {
                $lookup: {
                    from: "designations",
                    localField: "user_info.designation_id",
                    foreignField: "_id",
                    as: "user_info.designation"
                }
            },
            { $unwind: { path: "$user_info.designation", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "departments",
                    localField: "user_info.department_id",
                    foreignField: "_id",
                    as: "user_info.department"
                }
            },
            { $unwind: { path: "$user_info.department", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    "user_info.latest_code": {
                        $arrayElemAt: [
                            { $sortArray: { input: "$user_info.codes", sortBy: { issued_on: -1 } } },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    module_id: "$_id",
                    module_title: "$title",
                    module_type_id: 1,
                    email: "$user_info.email",
                    status: "$user_info.status",
                    designation: "$user_info.designation.name",
                    department: "$user_info.department.name",
                    address: "$user_info.address",
                    phone: "$user_info.phone",
                    user_id: "$user_info._id",
                    full_name: { $concat: ["$user_info.first_name", " ", "$user_info.last_name"] },
                    latest_code: "$user_info.latest_code.code",
                    progress_status: progressStatus,
                    lastActivityAt: { $arrayElemAt: ["$logs.created_at", 0] }
                }
            }
        ]);

        // Decrypt sensitive info
        const finalData = modules.map(u => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null,
        }));

        return successResponse(res, "Allowed modules fetched successfully", finalData);

    } catch (error) {
        next(error);
    }
};

exports.getQuizAssessmentReportController = async (req, res, next) => {
    try {

        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        const modTypId = mongoose.Types.ObjectId.createFromHexString("68886902954c4d9dc7a379bd")

        let data = req?.query;

        // If data is a string, try to parse it; otherwise, use it directly
        if (typeof data === "string" && data !== '') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        const matchQuery = {
            created_by: userId,
            module_type_id: modTypId
        };

        // Add date filtering if fromTime and toTime exist and are valid
        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {
            matchQuery.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime),
            };
        }

        const activity = await Activity.aggregate([
            {
                $match: matchQuery
            },
            {
                $lookup: {
                    from: "modules",
                    localField: "module_id",
                    foreignField: "_id",
                    as: "moduleInfo"
                }
            },
            { $unwind: "$moduleInfo" },
            {
                $lookup: {
                    from: "activity_logs",
                    localField: "_id",
                    foreignField: "activity_id",
                    as: "activityLog"
                }
            },
            {
                $lookup: {
                    from: "app_config",
                    let: { moduleTypeId: "$moduleInfo.module_type_id" },
                    pipeline: [
                        { $unwind: "$module_data" },
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$module_data._id", "$$moduleTypeId"]
                                }
                            }
                        },
                        {
                            $project: {
                                title: "$module_data.title"
                            }
                        }
                    ],
                    as: "moduleTypeInfo"
                },
            },
            { $unwind: "$moduleTypeInfo" },
            {
                $lookup: {
                    from: "content_folder",
                    let: { contentFolderId: "$moduleInfo.content_folder_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$contentFolderId"]
                                }
                            }
                        },
                    ],
                    as: "contentFolder"
                }
            },
            { $unwind: "$contentFolder" },
            {
                $lookup: {
                    from: "programs",
                    let: { programId: "$contentFolder.program_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$programId"]
                                }
                            }
                        },
                    ],
                    as: "program"
                }
            },
            {
                $unwind: "$program"
            },
            {
                $lookup: {
                    from: "quiz_settings",
                    localField: "_id",
                    foreignField: "activity_id",
                    as: "quizSetting"
                }
            },
            {
                $unwind: "$quizSetting"
            },
            {
                $lookup: {
                    from: "program_schedules",
                    let: { moduleId: "$module_id" },
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
            { $unwind: { path: "$programSchedule", preserveNullAndEmptyArrays: true } },
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
                        $let: {
                            vars: {
                                type5Data: {
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
                                typeOtherData: {
                                    $map: {
                                        input: "$scheduleUser",
                                        as: "t2",
                                        in: "$$t2.user_id"
                                    }
                                }
                            },
                            in: {
                                $setUnion: ["$$type5Data", "$$typeOtherData"]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    completedLearnerCount: {
                        $size: {
                            $filter: {
                                input: "$activityLog",
                                as: "log",
                                cond: { $eq: ["$$log.is_completed", true] }
                            }
                        }
                    },

                    allowerUserCount: {
                        $size: "$allowedUser"
                    },

                    passedLearnerCount: {
                        $size: {
                            $filter: {
                                input: "$activityLog",
                                as: "log",
                                cond: { $eq: ["$$log.is_passed", true] }
                            }
                        }
                    },

                    highestPercentage: {
                        $max: {
                            $map: {
                                input: "$activityLog",
                                as: "log",
                                in: { $toDouble: "$$log.mark_percentage" }
                            }
                        }
                    },

                    lowestPercentage: {
                        $min: {
                            $map: {
                                input: "$activityLog",
                                as: "log",
                                in: { $toDouble: "$$log.mark_percentage" }
                            }
                        }
                    },

                    averagePercentage: {
                        $avg: {
                            $map: {
                                input: "$activityLog",
                                as: "log",
                                in: { $toDouble: "$$log.mark_percentage" }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    highestPercentage: 1,
                    completedLearnerCount: 1,
                    lowestPercentage: 1,
                    averagePercentage: 1,
                    passedLearnerCount: 1,
                    allowerUserCount: 1,
                    quizName: "$name",
                    programName: "$program.title",
                    moduleName: "$moduleInfo.title",
                    passingPercentage: "$quizSetting.passCriteria",
                    attempt: "$quizSetting.reattempts",
                    contentFolderName: "$contentFolder.title",
                    moduleTypeName: "$moduleTypeInfo.title"
                }
            }

        ])

        return successResponse(res, "Activity fetched successfully", activity)

    } catch (error) {
        next(error)
    }
}

exports.getScormReportDataController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        let data = req?.query;

        // If data is a string, try to parse it; otherwise, use it directly
        if (typeof data === "string" && data !== '') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        const matchQuery = {
            created_by: mongoose.Types.ObjectId.createFromHexString(userId),
            module_type_id: mongoose.Types.ObjectId.createFromHexString("688723af5dd97f4ccae68837")
        };

        // Add date filtering if fromTime and toTime exist and are valid
        if (data.fromTime && data.toTime && data.fromTime !== 'null' && data.toTime !== 'null') {
            matchQuery.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime),
            };
        }

        const activity = await Activity.aggregate([
            {
                $match: matchQuery
            },
            {
                $lookup: {
                    from: "modules",
                    localField: "module_id",
                    foreignField: "_id",
                    as: "moduleInfo"
                }
            },
            { $unwind: "$moduleInfo" },
            {
                $lookup: {
                    from: "activity_logs",
                    localField: "_id",
                    foreignField: "activity_id",
                    as: "activityLog"
                }
            },
            {
                $lookup: {
                    from: "app_config",
                    let: { moduleTypeId: "$moduleInfo.module_type_id" },
                    pipeline: [
                        { $unwind: "$module_data" },
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$module_data._id", "$$moduleTypeId"]
                                }
                            }
                        },
                        {
                            $project: {
                                title: "$module_data.title"
                            }
                        }
                    ],
                    as: "moduleTypeInfo"
                },
            },
            { $unwind: "$moduleTypeInfo" },
            {
                $lookup: {
                    from: "content_folder",
                    let: { contentFolderId: "$moduleInfo.content_folder_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$contentFolderId"]
                                }
                            }
                        },
                    ],
                    as: "contentFolder"
                }
            },
            { $unwind: "$contentFolder" },
            {
                $lookup: {
                    from: "programs",
                    let: { programId: "$contentFolder.program_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$programId"]
                                }
                            }
                        },
                    ],
                    as: "program"
                }
            },
            {
                $unwind: "$program"
            },
            {
                $lookup: {
                    from: "program_schedules",
                    let: { moduleId: "$module_id" },
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
            { $unwind: { path: "$programSchedule", preserveNullAndEmptyArrays: true } },
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
                        $let: {
                            vars: {
                                type5Data: {
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
                                typeOtherData: {
                                    $map: {
                                        input: "$scheduleUser",
                                        as: "t2",
                                        in: "$$t2.user_id"
                                    }
                                }
                            },
                            in: {
                                $setUnion: ["$$type5Data", "$$typeOtherData"]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    completedLearnerCount: {
                        $size: {
                            $filter: {
                                input: "$activityLog",
                                as: "log",
                                cond: { $eq: ["$$log.is_completed", true] }
                            }
                        }
                    },

                    allowerUserCount: {
                        $size: "$allowedUser"
                    },

                    passedLearnerCount: {
                        $size: {
                            $filter: {
                                input: "$activityLog",
                                as: "log",
                                cond: { $eq: ["$$log.is_passed", true] }
                            }
                        }
                    },

                    highestPercentage: {
                        $max: {
                            $map: {
                                input: "$activityLog",
                                as: "log",
                                in: { $toDouble: "$$log.mark_percentage" }
                            }
                        }
                    },

                    lowestPercentage: {
                        $min: {
                            $map: {
                                input: "$activityLog",
                                as: "log",
                                in: { $toDouble: "$$log.mark_percentage" }
                            }
                        }
                    },

                    averagePercentage: {
                        $avg: {
                            $map: {
                                input: "$activityLog",
                                as: "log",
                                in: { $toDouble: "$$log.mark_percentage" }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    completedLearnerCount: 1,
                    passedLearnerCount: 1,
                    allowerUserCount: 1,
                    quizName: "$name",
                    programName: "$program.title",
                    moduleName: "$moduleInfo.title",
                    contentFolderName: "$contentFolder.title",
                    moduleTypeName: "$moduleTypeInfo.title"
                }
            }
        ])

        return successResponse(res, "Activity data fetched successfully", activity)

    } catch (error) {
        next(error)
    }
}

exports.getScormDetailReportDataController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        // GET ALL USERS CREATED BY LOGIN USER
        const users = await User.find(
            { created_by: userId },
            { _id: 1 }
        );

        const userIds = users.map((u) => u._id);

        let data = req?.query;

        // PARSE QUERY DATA
        if (typeof data === "string" && data !== "") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error("Invalid data format", e);
                data = {};
            }
        } else if (typeof data !== "object" || data === null) {
            data = {};
        }

        // MATCH QUERY
        const matchQuery = {
            user_id: { $in: userIds },
            module_type_id: mongoose.Types.ObjectId.createFromHexString(
                "688723af5dd97f4ccae68837"
            ),
        };

        // DATE FILTER
        if (
            data.fromTime &&
            data.toTime &&
            data.fromTime !== "null" &&
            data.toTime !== "null"
        ) {
            matchQuery.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime),
            };
        }

        const activityReport = await ActivityFolderReport.aggregate([
            {
                $match: matchQuery,
            },

            // USER LOOKUP
            {
                $lookup: {
                    from: "users",
                    let: { userId: "$user_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$userId"],
                                },
                            },
                        },
                        {
                            $project: {
                                first_name: 1,
                                last_name: 1,
                                email: 1,
                                codes: 1,
                                phone: 1,
                            },
                        },
                    ],
                    as: "user_info",
                },
            },

            {
                $addFields: {
                    "user_info": {
                        $arrayElemAt: ["$user_info", 0]
                    }
                }
            },
            {
                $addFields: {
                    "user_info.latest_code": {
                        $arrayElemAt: [
                            {
                                $sortArray: {
                                    input: "$user_info.codes",
                                    sortBy: { issued_on: -1 }
                                }
                            },
                            0
                        ]
                    }
                }
            },

            // MODULE LOOKUP
            {
                $lookup: {
                    from: "modules",
                    let: { moduleId: "$module_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$moduleId"],
                                },
                            },
                        },
                        {
                            $project: {
                                title: 1,
                            },
                        },
                    ],
                    as: "module_info",
                },
            },

            // PROGRAM LOOKUP
            {
                $lookup: {
                    from: "programs",
                    let: { programId: "$program_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$programId"],
                                },
                            },
                        },
                        {
                            $project: {
                                title: 1,
                            },
                        },
                    ],
                    as: "program_info",
                },
            },

            // CONTENT FOLDER LOOKUP
            {
                $lookup: {
                    from: "content_folder",
                    let: { contentFolderId: "$content_folder_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$contentFolderId"],
                                },
                            },
                        },
                        {
                            $project: {
                                title: 1,
                            },
                        },
                    ],
                    as: "content_folder_info",
                },
            },

            // ACTIVITY LOOKUP
            {
                $lookup: {
                    from: "activity",
                    let: { activityId: "$activity_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$_id", "$$activityId"],
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 1,
                                title: {
                                    $ifNull: [
                                        "$scorm_data.title",
                                        {
                                            $ifNull: [
                                                "$video_data.title",
                                                {
                                                    $ifNull: [
                                                        "$youtube_data.title",
                                                        {
                                                            $ifNull: [
                                                                "$document_data.title",
                                                                "$quiz_data.title",
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                    as: "activity_info",
                },
            },

            // UNWINDS
            {
                $unwind: {
                    path: "$program_info",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: "$content_folder_info",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: "$module_info",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: "$activity_info",
                    preserveNullAndEmptyArrays: true,
                },
            },

            // SORT ACTIVITIES BY CURRENT ATTEMPT DESC
            {
                $sort: {
                    current_attempt: -1,
                },
            },

            // GROUP BY USER
            {
                $group: {
                    _id: "$user_id",

                    user_info: {
                        $first: "$user_info",
                    },

                    activities: {
                        $push: {
                            _id: "$_id",

                            is_completed: "$is_completed",
                            is_passed: "$is_passed",

                            module_id: "$module_id",
                            module_info: "$module_info",

                            program_id: "$program_id",
                            program_info: "$program_info",

                            content_folder_id: "$content_folder_id",
                            content_folder_info: "$content_folder_info",

                            activity_id: "$activity_id",
                            activity_info: "$activity_info",

                            current_attempt: "$current_attempt",

                            start_activity_time: "$start_activity_time",
                            end_activity_time: "$end_activity_time",

                            created_at: "$created_at",
                            updated_at: "$updated_at",
                        },
                    },
                },
            },

            // OPTIONAL USER SORT
            {
                $sort: {
                    "user_info.first_name": 1,
                },
            },
        ]);

        // DECRYPT USER DATA
        const finalActivity = activityReport.map((item) => ({
            ...item,

            user_info: {
                ...item.user_info,

                email: item.user_info?.email
                    ? decrypt(item.user_info.email)
                    : null,

                phone: item.user_info?.phone
                    ? decrypt(item.user_info.phone)
                    : null,
            },
        }));

        return successResponse(
            res,
            "Activity data fetched successfully",
            finalActivity
        );

    } catch (error) {
        next(error);
    }
};

exports.getLogInReportController = async (req, res, next) => {
    try {
        const userId = req?.userId;

        let data = req.query || {};
        if (typeof data === "string" && data !== "") {
            try {
                data = JSON.parse(data);
            } catch {
                data = {};
            }
        }

        const {
            fromTime,
            toTime,
            department,
            designation,
            participationType,
            role,
        } = data;

        /* ----------------------------------
           LOGIN SESSION BASE MATCH
        ---------------------------------- */
        const sessionMatch = {
            user_id: { $exists: true },
        };

        // DATE FILTER (login / logout time)
        if (fromTime && toTime && fromTime !== "null" && toTime !== "null") {
            sessionMatch.activity_time = {
                $gte: new Date(fromTime),
                $lte: new Date(toTime),
            };
        }

        /* ----------------------------------
           USER FILTER (AFTER LOOKUP)
        ---------------------------------- */
        const userMatch = {
            "userInfo.created_by": mongoose.Types.ObjectId.createFromHexString(userId),
        };

        if (department && department !== "null") {
            userMatch["userInfo.department_id"] =
                mongoose.Types.ObjectId.createFromHexString(department);
        }

        if (designation && designation !== "null") {
            userMatch["userInfo.designation_id"] =
                mongoose.Types.ObjectId.createFromHexString(designation);
        }

        if (participationType && participationType !== "null") {
            userMatch["userInfo.participation_type_id"] =
                mongoose.Types.ObjectId.createFromHexString(participationType);
        }

        /* ----------------------------------
           AGGREGATION PIPELINE
        ---------------------------------- */
        const log_session = await LoginSession.aggregate([
            { $match: sessionMatch },

            // USER LOOKUP
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "userInfo",
                },
            },
            { $unwind: "$userInfo" },

            // APPLY USER FILTERS
            { $match: userMatch },

            // ROLE USER LOOKUP (many-to-many)
            {
                $lookup: {
                    from: "role_users",
                    localField: "userInfo._id",
                    foreignField: "user_id",
                    as: "roleUser",
                },
            },

            // ROLE FILTER
            ...(role && role !== "null"
                ? [
                    {
                        $match: {
                            "roleUser.role_id": mongoose.Types.ObjectId.createFromHexString(role),
                        },
                    },
                ]
                : []),

            // ROLE DETAILS (optional – for future use)
            {
                $lookup: {
                    from: "roles",
                    localField: "roleUser.role_id",
                    foreignField: "_id",
                    as: "roles",
                },
            },

            // ADD COMPUTED FIELDS
            {
                $addFields: {
                    sessionType: {
                        $cond: {
                            if: { $eq: ["$session_type", "1"] },
                            then: "logIn",
                            else: "Logout",
                        },
                    },
                    fullName: {
                        $concat: ["$userInfo.first_name", " ", "$userInfo.last_name"],
                    },
                    "userInfo.latest_code": {
                        $arrayElemAt: [
                            {
                                $sortArray: {
                                    input: "$userInfo.codes",
                                    sortBy: { issued_on: -1 },
                                },
                            },
                            0,
                        ],
                    },
                },
            },

            // DESIGNATION LOOKUP
            {
                $lookup: {
                    from: "designations",
                    localField: "userInfo.designation_id",
                    foreignField: "_id",
                    as: "userInfo.designation",
                },
            },
            {
                $unwind: {
                    path: "$userInfo.designation",
                    preserveNullAndEmptyArrays: true,
                },
            },

            // DEPARTMENT LOOKUP
            {
                $lookup: {
                    from: "departments",
                    localField: "userInfo.department_id",
                    foreignField: "_id",
                    as: "userInfo.department",
                },
            },
            {
                $unwind: {
                    path: "$userInfo.department",
                    preserveNullAndEmptyArrays: true,
                },
            },

            // FINAL RESPONSE SHAPE
            {
                $project: {
                    phone: "$userInfo.phone",
                    email: "$userInfo.email",
                    lastestCode: "$userInfo.latest_code.code",
                    department: "$userInfo.department.name",
                    designation: "$userInfo.designation.name",
                    sessionType: 1,
                    fullName: 1,
                    ip: 1,
                    activity_time: 1,
                },
            },
        ]);

        /* ----------------------------------
           DECRYPT DATA
        ---------------------------------- */
        const finalData = log_session.map((u) => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null,
        }));

        return successResponse(
            res,
            "Log report data fetched successfully",
            finalData
        );
    } catch (error) {
        next(error);
    }
};

exports.getUserReportController = async (req, res, next) => {
    try {
        const userId = req.userId;

        let data = req.query || {};

        // Normalize query data
        if (typeof data === "string" && data !== "") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                data = {};
            }
        }

        const {
            fromTime,
            toTime,
            department,
            designation,
            participationType,
            role,
        } = data;

        const matchQuery = {
            created_by: mongoose.Types.ObjectId.createFromHexString(userId),
        };

        // DATE FILTER
        if (fromTime && toTime && fromTime !== "null" && toTime !== "null") {
            matchQuery.created_at = {
                $gte: new Date(fromTime),
                $lte: new Date(toTime),
            };
        }

        // DEPARTMENT FILTER
        if (department && department !== "null") {
            matchQuery.department_id = mongoose.Types.ObjectId.createFromHexString(department);
        }

        // DESIGNATION FILTER
        if (designation && designation !== "null") {
            matchQuery.designation_id = mongoose.Types.ObjectId.createFromHexString(designation);
        }

        // PARTICIPATION TYPE FILTER
        if (participationType && participationType !== "null") {
            matchQuery.participation_type_id = mongoose.Types.ObjectId.createFromHexString(
                participationType
            );
        }

        const pipeline = [
            { $match: matchQuery },
            {
                $addFields: {
                    fullName: { $concat: ["$first_name", " ", "$last_name"] },
                },
            },
            {
                $lookup: {
                    from: "departments",
                    localField: "department_id",
                    foreignField: "_id",
                    as: "dept",
                },
            },
            { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "designations",
                    localField: "designation_id",
                    foreignField: "_id",
                    as: "desig",
                },
            },
            { $unwind: { path: "$desig", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "zones",
                    localField: "zone_id",
                    foreignField: "_id",
                    as: "zone",
                },
            },
            { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    latestCode: {
                        $arrayElemAt: [
                            {
                                $sortArray: {
                                    input: "$codes",
                                    sortBy: { issued_on: -1 },
                                },
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $lookup: {
                    from: "participation_types",
                    localField: "participation_type_id",
                    foreignField: "_id",
                    as: "particType",
                },
            },
            { $unwind: { path: "$particType", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "role_users",
                    localField: "_id",
                    foreignField: "user_id",
                    as: "roleUser",
                },
            },

            {
                $lookup: {
                    from: "roles",
                    localField: "roleUser.role_id",
                    foreignField: "_id",
                    as: "roles",
                },
            },

            {
                $addFields: {
                    roleNames: {
                        $map: {
                            input: "$roles",
                            as: "r",
                            in: "$$r.name",
                        },
                    },
                    roleIds: {
                        $map: {
                            input: "$roleUser",
                            as: "ru",
                            in: "$$ru.role_id",
                        },
                    },
                },
            },

            // ROLE FILTER (many-to-many)
            ...(role && role !== "null"
                ? [
                    {
                        $match: {
                            roleIds: {
                                $in: [mongoose.Types.ObjectId.createFromHexString(role)],
                            },
                        },
                    },
                ]
                : []),

            {
                $project: {
                    fullName: 1,
                    email: 1,
                    phone: 1,
                    roleNames: 1,
                    roleIds: 1,
                    designationId: "$designation_id",
                    departmentId: "$department_id",
                    particTypeId: "$particType._id",
                    particType: "$particType.name",
                    createTime: "$created_at",
                    empCode: "$latestCode.code",
                    userStatus: "$status",
                    zoneName: "$zone.name",
                    deptName: "$dept.name",
                    desigName: "$desig.name",
                    address: 1,
                    pincode: 1,
                    dob: 1,
                },
            },
        ];

        const userData = await User.aggregate(pipeline);

        const finalData = userData.map((u) => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null,
        }));

        if (!finalData.length) {
            return errorResponse(res, "User data does not exist", {}, 404);
        }

        return successResponse(
            res,
            "User data fetched successfully",
            finalData
        );
    } catch (error) {
        next(error);
    }
};

const toObjectIdArray = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) {

        return value
            .filter(Boolean)
            .map(id => mongoose.Types.ObjectId.createFromHexString(id));
    }

    // If value is a single string or comma-separated string
    if (typeof value === 'string') {
        return value
            .split(',')
            .filter(Boolean)
            .map(id => mongoose.Types.ObjectId.createFromHexString(id));
    }

    return [];
};

exports.getAdvanceTrainingReport = async (req, res, next) => {
    try {
        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);
        const data = req?.query || {};

        const users = await User.find({ created_by: userId }).select("_id");
        const userIds = users.map(u => u._id);

        const filter = {
            created_by: { $in: userIds }
        };

        if (data.fromTime && data.toTime && data.fromTime !== "null" && data.toTime !== "null") {
            filter.created_at = {
                $gte: new Date(data.fromTime),
                $lte: new Date(data.toTime)
            };
        }

        if (data.programs) {
            filter.program_id = { $in: toObjectIdArray(data.programs) };
        }

        if (data.contentFolders) {
            filter.content_folder_id = { $in: toObjectIdArray(data.contentFolders) };
        }

        if (data.modules) {
            filter.module_id = { $in: toObjectIdArray(data.modules) };
        }

        if (data.moduleType) {
            filter.module_type_id = { $in: toObjectIdArray(data.moduleType) };
        }

        const pipeline = [
            { $match: filter }
        ];

        if (Number(data.attemptType) === 2) {

            pipeline.push(
                {
                    $sort: {
                        user_id: 1,
                        activity_id: 1,
                        current_attempt: -1,
                        created_at: -1
                    }
                },
                {
                    $group: {
                        _id: {
                            user_id: "$user_id",
                            activity_id: "$activity_id"
                        },
                        doc: { $first: "$$ROOT" }
                    }
                },
                {
                    $replaceRoot: { newRoot: "$doc" }
                }
            );
        }


        pipeline.push(
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    latestCode: {
                        $arrayElemAt: [
                            { $sortArray: { input: "$user.codes", sortBy: { issued_on: -1 } } },
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    fullName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ["$user.first_name", ""] },
                                    " ",
                                    { $ifNull: ["$user.last_name", ""] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "programs",
                    localField: "program_id",
                    foreignField: "_id",
                    as: "program"
                }
            },
            { $unwind: { path: "$program", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "content_folder",
                    localField: "content_folder_id",
                    foreignField: "_id",
                    as: "contentFolder"
                }
            },
            { $unwind: { path: "$contentFolder", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "modules",
                    localField: "module_id",
                    foreignField: "_id",
                    as: "module"
                }
            },
            { $unwind: { path: "$module", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "app_config",
                    let: {
                        moduleTypeId: {
                            $cond: [
                                { $eq: [{ $type: "$module_type_id" }, "objectId"] },
                                "$module_type_id",
                                { $toObjectId: "$module_type_id" }
                            ]
                        }
                    },
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
            { $unwind: "$moduleType" },
            {
                $addFields: {
                    completed: {
                        $cond: [{ $eq: ["$is_completed", true] }, "Completed", "Not completed"]
                    },
                    completionStatus: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$progress_status", "1"] }, then: "Not started" },
                                { case: { $eq: ["$progress_status", "2"] }, then: "In progress" },
                                { case: { $eq: ["$progress_status", "3"] }, then: "Completed" }
                            ],
                            default: "Unknown"
                        }
                    },
                    passedStatus: {
                        $cond: [{ $eq: ["$is_passed", true] }, "Passed", "Not Passed"]
                    },
                    markPercent: {
                        $round: [{ $toDouble: "$mark_percentage" }, 1]
                    },
                    completePercent: {
                        $round: [{ $toDouble: "$completion_percentage" }]
                    },
                    startedTime: {
                        $cond: [
                            { $ne: ["$start_activity_time", null] },
                            {
                                $let: {
                                    vars: {
                                        h: { $hour: "$start_activity_time" }
                                    },
                                    in: {
                                        $concat: [
                                            {
                                                $dateToString: {
                                                    format: "%d %b %Y ",
                                                    date: "$start_activity_time"
                                                }
                                            },
                                            {
                                                $toString: {
                                                    $cond: [
                                                        { $eq: [{ $mod: ["$$h", 12] }, 0] },
                                                        12,
                                                        { $mod: ["$$h", 12] }
                                                    ]
                                                }
                                            },
                                            ":",
                                            {
                                                $dateToString: {
                                                    format: "%M",
                                                    date: "$start_activity_time"
                                                }
                                            },
                                            {
                                                $cond: [
                                                    { $gte: ["$$h", 12] },
                                                    " PM",
                                                    " AM"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            null
                        ]
                    },
                    endTime: {
                        $cond: [
                            { $ne: ["$end_activity_time", null] },
                            {
                                $let: {
                                    vars: {
                                        h: { $hour: "$end_activity_time" }
                                    },
                                    in: {
                                        $concat: [
                                            {
                                                $dateToString: {
                                                    format: "%d %b %Y ",
                                                    date: "$end_activity_time"
                                                }
                                            },
                                            {
                                                $toString: {
                                                    $cond: [
                                                        { $eq: [{ $mod: ["$$h", 12] }, 0] },
                                                        12,
                                                        { $mod: ["$$h", 12] }
                                                    ]
                                                }
                                            },
                                            ":",
                                            {
                                                $dateToString: {
                                                    format: "%M",
                                                    date: "$end_activity_time"
                                                }
                                            },
                                            {
                                                $cond: [
                                                    { $gte: ["$$h", 12] },
                                                    " PM",
                                                    " AM"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            null
                        ]
                    },
                    duration: {
                        $cond: [
                            {
                                $and: [
                                    { $ne: ["$start_activity_time", null] },
                                    { $ne: ["$end_activity_time", null] }
                                ]
                            },
                            {
                                $dateToString: {
                                    format: "%H:%M:%S",
                                    date: {
                                        $toDate: {
                                            $subtract: [
                                                "$end_activity_time",
                                                "$start_activity_time"
                                            ]
                                        }
                                    }
                                }
                            },
                            "00:00:00"
                        ]
                    }
                }
            },

            {
                $project: {
                    fullName: 1,
                    programName: "$program.title",
                    contentFolderName: "$contentFolder.title",
                    moduleName: "$module.title",
                    moduleTypeName: "$moduleType.activity_data.title",
                    userName: "$latestCode.code",
                    startedTime: 1,
                    endTime: 1,
                    duration: 1,
                    completionStatus: 1,
                    completed: 1,
                    markPercent: 1,
                    completePercent: 1,
                    current_attempt: 1,
                    completed_at_time: 1,
                    passedStatus: 1
                }
            }
        );

        const activityLog = await ActivityFolderReport.aggregate(pipeline);

        return successResponse(
            res,
            "Activity log fetched successfully",
            activityLog
        );

    } catch (error) {
        next(error);
    }
};

const toArray = (value) => {
    if (typeof value !== "string") return [];
    return value.split(",").map(v => v.trim()).filter(v => v !== "");
};

const toObjectIds = (value) => {
    return toArray(value)
        .filter(v => mongoose.Types.ObjectId.isValid(v))
        .map(v => new mongoose.Types.ObjectId(v));
};

const hasAllValues = (value, allValues) => {
    const arr = toArray(value);
    return (
        arr.length === allValues.length &&
        allValues.every(v => arr.includes(v))
    );
};

exports.getMiscellaneousReportController = async (req, res, next) => {
    try {

        const data = req.query;
        const userId = req.userId;

        const users = await User.find({ created_by: userId }).select("_id");
        const userIds = users.map(u => u._id);

        const activityFilter = {
            created_by: {
                $in: userIds,
            },
        };

        if (data.startTime && data.endTime && data.startTime !== "null" && data.endTime !== "null") {

            activityFilter.created_at = {
                $gte: new Date(data.startTime),
                $lte: new Date(data.endTime)
            };
        }

        const resultArr = toArray(data.result);

        if (resultArr.length && !hasAllValues(data.result, ["true", "false"])) {
            activityFilter.is_passed = {
                $in: resultArr.map(v => v === "true")
            };
        }


        const completionArr = toArray(data.completionStatus);

        if (completionArr.length && !hasAllValues(data.completionStatus, ["1", "2", "3"])) {
            activityFilter.progress_status = {
                $in: completionArr
            };
        }

        const programArr = toArray(data.program);

        if (programArr.length) {
            activityFilter.program_id = { $in: toObjectIdArray(programArr) };
        }

        const moduleArr = toArray(data.module);

        if (moduleArr.length) {

            activityFilter.module_id = { $in: toObjectIdArray(moduleArr) };
        }

        const contentFolderArr = toArray(data.contentFolder);

        if (contentFolderArr.length) {

            activityFilter.content_folder_id = {
                $in: toObjectIdArray(contentFolderArr)
            };
        }

        const userFilter = {};

        if (
            toArray(data.userStatus).length &&
            !hasAllValues(data.userStatus, ["true", "false"])
        ) {
            userFilter["user.status"] = {
                $in: toArray(data.userStatus).map(v => v === "true")
            };
        }

        const departmentArr = toArray(data.department);

        if (departmentArr.length) {
            userFilter["user.department_id"] = {
                $in: toObjectIdArray(departmentArr)
            };
        }

        const designationArr = toArray(data.designation);

        if (designationArr.length) {
            userFilter["user.designation_id"] = {
                $in: toObjectIdArray(designationArr)
            };
        }

        const regionArr = toArray(data.region);

        if (regionArr.length) {
            userFilter["user.region_id"] = {
                $in: toObjectIdArray(regionArr)
            };
        }

        const locationArr = toArray(data.location);

        if (locationArr.length) {
            userFilter["user.state_id"] = {
                $in: locationArr.map(String)
            };
        }

        const groupArr = toArray(data.group);

        if (groupArr.length) {
            userFilter["user.group_id"] = {
                $in: toObjectIdArray(groupArr)
            };
        }

        const activityReport = await ActivityFolderReport.aggregate([
            { $match: activityFilter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            ...(Object.keys(userFilter).length ? [{ $match: userFilter }] : []),
            {
                $addFields: {
                    latestCode: {
                        $arrayElemAt: [
                            { $sortArray: { input: "$user.codes", sortBy: { issued_on: -1 } } },
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    fullName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ["$user.first_name", ""] },
                                    " ",
                                    { $ifNull: ["$user.last_name", ""] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "programs",
                    localField: "program_id",
                    foreignField: "_id",
                    as: "program"
                }
            },
            { $unwind: { path: "$program", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "content_folder",
                    localField: "content_folder_id",
                    foreignField: "_id",
                    as: "contentFolder"
                }
            },
            { $unwind: { path: "$contentFolder", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "modules",
                    localField: "module_id",
                    foreignField: "_id",
                    as: "module"
                }
            },
            { $unwind: { path: "$module", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "app_config",
                    let: {
                        moduleTypeId: {
                            $cond: [
                                { $eq: [{ $type: "$module_type_id" }, "objectId"] },
                                "$module_type_id",
                                { $toObjectId: "$module_type_id" }
                            ]
                        }
                    },
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
            { $unwind: "$moduleType" },
            {
                $lookup: {
                    from: "designations",
                    localField: "user.designation_id",
                    foreignField: "_id",
                    as: "designation"
                }
            },
            { $unwind: { path: "$designation", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "departments",
                    localField: "user.department_id",
                    foreignField: "_id",
                    as: "department"
                }
            },
            { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "groups",
                    localField: "user.group_id",
                    foreignField: "_id",
                    as: "group"
                }
            },
            { $unwind: { path: "$group", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "regions",
                    localField: "user.region_id",
                    foreignField: "_id",
                    as: "region"
                }
            },
            { $unwind: { path: "$region", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "countries",
                    let: { stateId: { $toInt: "$user.state_id" } },
                    pipeline: [
                        { $unwind: "$states" },
                        {
                            $match: {
                                $expr: { $eq: ["$states.state_id", "$$stateId"] }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                state_name: "$states.state_name"
                            }
                        }
                    ],
                    as: "location"
                }
            },
            { $unwind: { path: "$location", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "activity",
                    localField: "activity_id",
                    foreignField: "_id",
                    as: "activityLog"
                }
            },
            { $unwind: { path: "$activityLog", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "quiz_result_reports",
                    let: { moduleId: "$module_id", activityId: "$activity_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$activity_id", "$$activityId"] },
                                        { $eq: ["$module_id", "$$moduleId"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "quizResult"
                }
            },
            {
                $addFields: {
                    departmentName: "$department.name",
                    designationName: "$designation.name",
                    groupName: "$group.name",
                    regionName: "$region.name",
                    locationName: "$location.state_name",
                    completed: {
                        $cond: [{ $eq: ["$is_completed", true] }, "Completed", "Not completed"]
                    },
                    completionStatus: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$progress_status", "1"] }, then: "Not started" },
                                { case: { $eq: ["$progress_status", "2"] }, then: "In progress" },
                                { case: { $eq: ["$progress_status", "3"] }, then: "Completed" }
                            ],
                            default: "Unknown"
                        }
                    },
                    passedStatus: {
                        $cond: [{ $eq: ["$is_passed", true] }, "Passed", "Not Passed"]
                    },
                    markPercent: {
                        $round: [{ $toDouble: "$mark_percentage" }, 1]
                    },
                    completePercent: {
                        $round: [{ $toDouble: "$completion_percentage" }]
                    },
                    startedTime: {
                        $cond: [
                            { $ne: ["$start_activity_time", null] },
                            {
                                $let: {
                                    vars: {
                                        h: { $hour: "$start_activity_time" }
                                    },
                                    in: {
                                        $concat: [
                                            {
                                                $dateToString: {
                                                    format: "%d %b %Y ",
                                                    date: "$start_activity_time"
                                                }
                                            },
                                            {
                                                $toString: {
                                                    $cond: [
                                                        { $eq: [{ $mod: ["$$h", 12] }, 0] },
                                                        12,
                                                        { $mod: ["$$h", 12] }
                                                    ]
                                                }
                                            },
                                            ":",
                                            {
                                                $dateToString: {
                                                    format: "%M",
                                                    date: "$start_activity_time"
                                                }
                                            },
                                            {
                                                $cond: [
                                                    { $gte: ["$$h", 12] },
                                                    " PM",
                                                    " AM"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            null
                        ]
                    },
                    endTime: {
                        $cond: [
                            { $ne: ["$end_activity_time", null] },
                            {
                                $let: {
                                    vars: {
                                        h: { $hour: "$end_activity_time" }
                                    },
                                    in: {
                                        $concat: [
                                            {
                                                $dateToString: {
                                                    format: "%d %b %Y ",
                                                    date: "$end_activity_time"
                                                }
                                            },
                                            {
                                                $toString: {
                                                    $cond: [
                                                        { $eq: [{ $mod: ["$$h", 12] }, 0] },
                                                        12,
                                                        { $mod: ["$$h", 12] }
                                                    ]
                                                }
                                            },
                                            ":",
                                            {
                                                $dateToString: {
                                                    format: "%M",
                                                    date: "$end_activity_time"
                                                }
                                            },
                                            {
                                                $cond: [
                                                    { $gte: ["$$h", 12] },
                                                    " PM",
                                                    " AM"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            null
                        ]
                    },
                    duration: {
                        $cond: [
                            {
                                $and: [
                                    { $ne: ["$start_activity_time", null] },
                                    { $ne: ["$end_activity_time", null] }
                                ]
                            },
                            {
                                $dateToString: {
                                    format: "%H:%M:%S",
                                    date: {
                                        $toDate: {
                                            $subtract: [
                                                "$end_activity_time",
                                                "$start_activity_time"
                                            ]
                                        }
                                    }
                                }
                            },
                            "00:00:00"
                        ]
                    },
                    completionTime: {
                        $cond: [
                            { $ne: ["$completed_at_time", null] },
                            {
                                $let: {
                                    vars: {
                                        h: { $hour: "$completed_at_time" }
                                    },
                                    in: {
                                        $concat: [
                                            {
                                                $dateToString: {
                                                    format: "%d %b %Y ",
                                                    date: "$completed_at_time"
                                                }
                                            },
                                            {
                                                $toString: {
                                                    $cond: [
                                                        { $eq: [{ $mod: ["$$h", 12] }, 0] },
                                                        12,
                                                        { $mod: ["$$h", 12] }
                                                    ]
                                                }
                                            },
                                            ":",
                                            {
                                                $dateToString: {
                                                    format: "%M",
                                                    date: "$completed_at_time"
                                                }
                                            },
                                            {
                                                $cond: [
                                                    { $gte: ["$$h", 12] },
                                                    " PM",
                                                    " AM"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            null
                        ]
                    },
                    attemptTime: {
                        $cond: [
                            { $ne: ["$created_at", null] },
                            {
                                $let: {
                                    vars: {
                                        h: { $hour: "$created_at" }
                                    },
                                    in: {
                                        $concat: [
                                            {
                                                $dateToString: {
                                                    format: "%d %b %Y ",
                                                    date: "$created_at"
                                                }
                                            },
                                            {
                                                $toString: {
                                                    $cond: [
                                                        { $eq: [{ $mod: ["$$h", 12] }, 0] },
                                                        12,
                                                        { $mod: ["$$h", 12] }
                                                    ]
                                                }
                                            },
                                            ":",
                                            {
                                                $dateToString: {
                                                    format: "%M",
                                                    date: "$created_at"
                                                }
                                            },
                                            {
                                                $cond: [
                                                    { $gte: ["$$h", 12] },
                                                    " PM",
                                                    " AM"
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            null
                        ]
                    },
                    totalQuestion: {
                        $size: {
                            $ifNull: ["$quizResult", []]
                        }
                    },
                    attemptQuestion: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ["$quizResult", []] },
                                as: "q",
                                cond: {
                                    $gt: [
                                        { $size: { $ifNull: ["$$q.selected_option_no", []] } },
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    correctQuestion: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ["$quizResult.questions", []] },
                                as: "q",
                                cond: { $eq: ["$$q.is_correct", true] }
                            }
                        }
                    },
                    wrongQuestion: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ["$quizResult.questions", []] },
                                as: "q",
                                cond: { $eq: ["$$q.is_correct", false] }
                            }
                        }
                    },
                    userStatus: {
                        $cond: [{ $eq: ["$user.status", true] }, "Active", "Inactive"]
                    },
                }
            },
            {
                $project: {
                    fullName: 1,
                    userEmail: "$user.email",
                    programName: "$program.title",
                    contentFolderName: "$contentFolder.title",
                    moduleName: "$module.title",
                    moduleTypeName: "$moduleType.activity_data.title",
                    userName: "$latestCode.code",
                    userStatus: 1,
                    activityName: "$activityLog.name",
                    startedTime: 1,
                    endTime: 1,
                    attemptDate: 1,
                    correctQuestion: 1,
                    wrongQuestion: 1,
                    totalQuestion: 1,
                    attemptQuestion: 1,
                    duration: 1,
                    completionStatus: 1,
                    markPercent: 1,
                    completePercent: 1,
                    current_attempt: 1,
                    completionTime: 1,
                    departmentName: 1,
                    designationName: 1,
                    groupName: 1,
                    regionName: 1,
                    passedStatus: 1,
                    locationName: 1,
                }
            }
        ]);

        const finalActivityReport = activityReport.map(u => ({
            ...u,
            userEmail: u.userEmail ? decrypt(u.userEmail) : null
        }));

        return successResponse(
            res,
            "Activity report fetched successfully",
            finalActivityReport
        );

    } catch (error) {
        next(error);
    }
};
const mongoose = require("mongoose")
const User = require('../../model/User')
const Module = require("../../model/Module");
const ContentFolder = require("../../model/ContentFolder");

const {
    errorResponse,
    successResponse
} = require('../../util/response');

exports.getModuleAPIController = async (req, res, next) => {
    try {

        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        const LIVE_MODULE_TYPE_ID =
            mongoose.Types.ObjectId.createFromHexString("688219557b6953e899cb57d3");

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const masterId = user?.master_company_id;

        const id = req?.params?.id;

        const contentFolder = await ContentFolder.findById(id)
            .populate('activity_logs');

        const now = new Date();

        const module = await Module.aggregate([
            {
                $match: {
                    content_folder_id: mongoose.Types.ObjectId.createFromHexString(id),
                    created_by: mongoose.Types.ObjectId.createFromHexString(masterId)
                }
            },
            {
                $lookup: {
                    from: "activity_logs",
                    let: { user_id: userId, id: "$_id" },
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
                    localField: "_id",
                    foreignField: "module_id",
                    as: "programSchedule"
                }
            },
            {
                $unwind: "$programSchedule",
            },
            {
                $lookup: {
                    from: "user_module_enroll",
                    let: { moduleId: "$_id", userId: userId },
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
                $addFields: {
                    relativeEndDate: {
                        $cond: [
                            { $eq: ["$programSchedule.dueType", "relative"] },
                            {
                                $dateAdd: {
                                    startDate: "$programSchedule.published_date",
                                    unit: "day",
                                    amount: {
                                        $toInt: {
                                            $ifNull: ["$programSchedule.dueDays", 0]
                                        }
                                    }
                                }
                            },
                            null
                        ]
                    }
                }
            },
            {
                $addFields: {
                    isDateVisible: {
                        $cond: [
                            { $eq: ["$programSchedule.dueType", "relative"] },
                            {
                                $and: [
                                    { $lte: ["$programSchedule.published_date", now] },
                                    { $gte: ["$relativeEndDate", now] }
                                ]
                            },
                            {
                                $cond: [
                                    { $eq: ["$programSchedule.dueType", "fixed"] },
                                    {
                                        $and: [
                                            { $lte: ["$programSchedule.dueDate.start_date", now] },
                                            { $gte: ["$programSchedule.dueDate.end_date", now] }
                                        ]
                                    },
                                    true
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    isVisible: {
                        $cond: {
                            if: { $eq: ["$programSchedule.pushEnrollmentSetting", 2] },
                            then: { $gt: [{ $size: "$moduleEnroll" }, 0] },
                            else: true
                        }
                    }
                }
            },
            {
                $addFields: {
                    isLiveModuleVisible: {
                        $cond: [
                            { $eq: ["$module_type_id", LIVE_MODULE_TYPE_ID] },
                            {
                                $and: [
                                    { $lte: ["$start_live_time", now] },
                                    { $gte: ["$end_live_time", now] },
                                    { $gt: [{ $size: "$moduleEnroll" }, 0] }
                                ]
                            },
                            true
                        ]
                    }
                }
            },
            {
                $match: {
                    isLiveModuleVisible: true,
                    isVisible: true,
                    "programSchedule._id": { $exists: true },
                    isDateVisible: true
                }
            }
        ]);

        if (!module) {
            return errorResponse(res, "Module does not exist", {}, 404)
        }

        return successResponse(res, "Module fetched successfully", {
            courseDetails: contentFolder,
            courses: module
        })

    } catch (error) {
        next(error)
    }
}
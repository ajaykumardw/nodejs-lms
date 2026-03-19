const Department = require("../../model/Department");
const Designation = require("../../model/Designation");
const Module = require("../../model/Module")
const Group = require("../../model/Group");
const Zone = require("../../model/Zone")
const ParticipationType = require("../../model/ParticipationType")
const User = require("../../model/User");
const ScheduleNotification = require("../../model/ScheduleNotification");
const { successResponse, errorResponse } = require("../../util/response");
const mongoose = require("mongoose");
const { decrypt } = require("../../util/encryption");

exports.getScheduleNotification = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const scheduleNotification = await ScheduleNotification.find({ created_by: userId })

        return successResponse(res, "Schedule Notification fetched successfully", scheduleNotification)

    } catch (error) {

        next(error)
    }
}

exports.postScheduleNotification = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const {
            title,
            module_id,
            schedule_target,
            audience,
            repeat_type,
            schedule_type,
            schedule_days,
            template_id,
            notification_type
        } = req.body;

        const existSchedNotif = await ScheduleNotification.findOne({
            template_id,
            notification_type,
            created_by: userId
        })

        let scheduleUserId = [];

        if (Number(schedule_target) === 1) {

            const users = await User.find({
                department_id: audience   // single ID
            }).select("_id");

            scheduleUserId = users.map(u => u._id);

        } else if (Number(schedule_target) === 2) {

            const users = await User.find({
                designation_id: audience
            }).select("_id");

            scheduleUserId = users.map(u => u._id);

        } else if (Number(schedule_target) === 3) {

            // audience = single group id
            const group = await Group.findById(audience).select("user_id");

            scheduleUserId = group?.user_id || [];

        } else if (Number(schedule_target) === 4) {

            const users = await User.find({
                participation_type_id: audience
            }).select("_id");

            scheduleUserId = users.map(u => u._id);

        } else if (Number(schedule_target) === 5) {

            // already array of user ids
            scheduleUserId = audience;

        } else {

            const users = await User.find({
                zone_id: audience
            }).select("_id");

            scheduleUserId = users.map(u => u._id);
        }

        if (existSchedNotif) {

            let attemptNo = 1;

            if (existSchedNotif?.repeat_type === "2" && existSchedNotif?.schedule_days !== schedule_days) {

                attemptNo = Number(existSchedNotif?.attemptNo || 0) + 1;
            }

            await ScheduleNotification.findOneAndUpdate({
                template_id,
                notification_type,
                created_by: userId
            }, {
                template_id,
                module_id,
                created_by: userId,
                title,
                schedule_user_id: scheduleUserId,
                notification_type,
                attemptNo,
                schedule_target,
                audience,
                schedule_type,
                repeat_type,
                schedule_days
            })

        } else {

            const sched_notif = new ScheduleNotification({
                template_id,
                module_id,
                created_by: userId,
                schedule_user_id: scheduleUserId,
                title,
                attemptNo: 1,
                notification_type,
                schedule_target,
                audience,
                schedule_type,
                repeat_type,
                schedule_days
            })

            await sched_notif.save()

        }

        return successResponse(res, "Schedule Notification created successfully")

    } catch (error) {

        next(error)
    }
}

exports.deleteScheduleNotificationController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const { id } = req.params;

        const scheduleNotification = await ScheduleNotification.findOne({ _id: id, created_by: userId })

        await ScheduleNotification.deleteOne({ _id: id, created_by: userId })

        return successResponse(res, "Schedule Notification deleted successfully")

    } catch (error) {

        next(error)
    }
}

exports.getCreateScheduleNotification = async (req, res, next) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.userId);
        const search = req.query.search?.trim();

        const assignedData = [
            { _id: "1", title: "Department", type: "department" },
            { _id: "2", title: "Designation", type: "designation" },
            { _id: "3", title: "Group", type: "group" },
            { _id: "4", title: "Participation Type", type: "participationType" },
            { _id: "5", title: "Users", type: "user" },
            { _id: "6", title: "Zone", type: "zone" }
        ];

        const occuranceData = [
            { _id: "1", title: "Once" },
            { _id: "2", title: "Recurring" }
        ];

        let users = [];

        if (search) {
            const q = new RegExp(search, "i");

            const pipeline = [
                { $match: { created_by: userId } },

                {
                    $addFields: {
                        latestCode: {
                            $cond: {
                                if: { $isArray: "$codes" },
                                then: {
                                    $arrayElemAt: [
                                        { $sortArray: { input: "$codes", sortBy: { issued_on: -1 } } },
                                        0
                                    ]
                                },
                                else: null
                            }
                        }
                    }
                },

                {
                    $project: {
                        first_name: 1,
                        last_name: 1,
                        email: 1,
                        phone: 1,
                        empCode: "$latestCode.code"
                    }
                }
            ];

            users = await User.aggregate(pipeline);

            users = users.map(u => ({
                ...u,
                email: u.email ? decrypt(u.email) : null,
                phone: u.phone ? decrypt(u.phone) : null
            }));

            users = users.filter(u => {
                const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`;
                const emp = String(u.empCode ?? "");

                return (
                    q.test(full) ||
                    q.test(u.first_name ?? "") ||
                    q.test(u.last_name ?? "") ||
                    q.test(u.email ?? "") ||
                    q.test(u.phone ?? "") ||
                    q.test(emp)
                );
            });
        }

        const [
            department,
            designation,
            module,
            group,
            zone,
            participationType
        ] = await Promise.all([

            Department.aggregate([
                { $match: { created_by: userId } },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "department_id",
                        as: "users"
                    }
                },
                { $addFields: { userCount: { $size: "$users" } } },
                { $project: { name: 1, userCount: 1 } }
            ]),

            Designation.aggregate([
                { $match: { company_id: userId } },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "designation_id",
                        as: "users"
                    }
                },
                { $addFields: { userCount: { $size: "$users" } } },
                { $project: { name: 1, userCount: 1 } }
            ]),

            Module.find({ created_by: userId }),

            Group.aggregate([
                { $match: { created_by: userId } },
                { $addFields: { userCount: { $size: "$userId" } } },
                { $project: { name: 1, userCount: 1 } }
            ]),

            Zone.aggregate([
                { $match: { created_by: userId } },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "zone_id",
                        as: "users"
                    }
                },
                { $addFields: { userCount: { $size: "$users" } } },
                { $project: { name: 1, userCount: 1 } }
            ]),

            ParticipationType.aggregate([
                { $match: { company_id: userId } },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "participation_type_id",
                        as: "users"
                    }
                },
                { $addFields: { userCount: { $size: "$users" } } },
                { $project: { name: 1, userCount: 1 } }
            ])
        ]);

        const data = {
            user: users,
            department,
            designation,
            module,
            group,
            zone,
            participationType,
            occuranceData,
            assignedData
        };

        return successResponse(
            res,
            "Create Schedule Notification data fetched successfully",
            data
        );

    } catch (error) {
        next(error);
    }
};

exports.getEditSchedNotification = async (req, res, next) => {
    try {
        const userId = req?.userId;
        const { id } = req?.params;

        const schedNotification = await ScheduleNotification.findOne({
            template_id: id,
            created_by: userId
        }).lean();

        const schedNotUserId = schedNotification?.schedule_user_id || [];

        const users = await User.find({
            _id: { $in: Array.isArray(schedNotUserId) ? schedNotUserId : [schedNotUserId] }
        }).select("_id first_name last_name");

        let finalData;

        if (schedNotification) {

            finalData = {
                ...schedNotification,
                users,
                audience: (schedNotification?.schedule_target === 5) ? users.map(u => String(u._id)) : schedNotification?.audience,
            };

        }

        return successResponse(
            res,
            "Schedule notification fetched successfully",
            finalData
        );

    } catch (error) {
        next(error);
    }
};
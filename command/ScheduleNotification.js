const mongoose = require("mongoose");
const User = require("../model/User");
const ProgramSchedule = require("../model/ProgramSchedule");
const NotificationLog = require("../model/NotificationLog");
const NotificationTemplate = require("../model/Notifications");
const ScheduleNotification = require("../model/ScheduleNotification");
const ReplaceTemplateField = require("../util/ReplaceTemplateField");
const { decrypt } = require("../util/encryption");

// Get today's start & end
const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return { startOfDay: start, endOfDay: end };
};

// Get start & end date (relative / absolute)
const getStartEndDates = (progItem) => {
    const { dueType, dueDays, published_date, dueDate } = progItem;

    let startDate = null;
    let endDate = null;

    if (String(dueType) === "relative") {
        if (published_date && dueDays) {
            startDate = new Date(published_date);
            endDate = new Date(published_date);
            endDate.setDate(endDate.getDate() + Number(dueDays));
        }
    } else {
        if (dueDate?.start_date && dueDate?.end_date) {
            startDate = new Date(dueDate.start_date);
            endDate = new Date(dueDate.end_date);
        }
    }

    if (!startDate || !endDate) return null;

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
};

// Catch-up logic (core fix)
const getPendingAttempts = async ({
    userId,
    scheduleType,
    startDate,
    endDate,
    scheduleDays,
    today
}) => {
    const attempts = [];

    if (scheduleType === "module_enrollement") {
        let triggerDate = new Date(startDate);
        triggerDate.setDate(triggerDate.getDate() + scheduleDays);

        let attempt = 1;

        while (triggerDate <= today && triggerDate <= endDate) {

            const exists = await NotificationLog.findOne({
                user_id: userId,
                attemptNo: attempt,
                reason: scheduleType
            });

            if (!exists) {
                attempts.push({ attemptNo: attempt });
            }

            triggerDate.setDate(triggerDate.getDate() + scheduleDays);
            attempt++;
        }
    }

    if (scheduleType === "module_expiry") {

        let triggerDate = new Date(endDate);
        triggerDate.setDate(triggerDate.getDate() - scheduleDays);

        let attempt = 1;

        while (triggerDate >= startDate && triggerDate <= today) {
            const exists = await NotificationLog.findOne({
                user_id: userId,
                attemptNo: attempt,
                reason: scheduleType
            });

            if (!exists) {
                attempts.push({ attemptNo: attempt });
            }

            triggerDate.setDate(triggerDate.getDate() - scheduleDays);
            attempt++;
        }
    }

    return attempts;
};

const scheduleNotificationCommand = async () => {
    try {
        const { startOfDay, endOfDay } = getTodayRange();

        const scheduleNotifications = await ScheduleNotification.find({
            repeat_type: "2"
        }).lean();

        for (const item of scheduleNotifications) {

            const moduleIds = (item.module_id || []).map(id => new mongoose.Types.ObjectId(id));
            
            const templateId = new mongoose.Types.ObjectId(item.template_id);
            const scheduleUserIds = (item.schedule_user_id || []).map(id => new mongoose.Types.ObjectId(id));

            const scheduleType = item.schedule_type;
            const scheduleDays = Number(item.schedule_days || 0);

            const companyId = new mongoose.Types.ObjectId(item.created_by);

            const [template, programSched] = await Promise.all([
                NotificationTemplate.findById(templateId).lean(),
                ProgramSchedule.aggregate([
                    { $match: { module_id: { $in: moduleIds } } },
                    {
                        $lookup: {
                            from: "schedule_type",
                            let: { scheduleId: "$_id" },
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
                            let: { scheduleId: "$_id" },
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
                        $project: {
                            activity_id: 1,
                            published_date: 1,
                            dueType: 1,
                            dueDays: 1,
                            dueDate: 1,
                            allowedUser: 1
                        }
                    }
                ])
            ]);

            if (!template) continue;

            const allUsers = programSched.flatMap(p => p.allowedUser || []);

            const filteredUsers = allUsers.filter(uid =>
                scheduleUserIds.some(id => id.equals(uid))
            );

            for (const userId of filteredUsers) {

                const user = await User.findById(userId);
                if (!user) continue;

                const email = decrypt(user.email);

                for (const progItem of programSched) {

                    const dates = getStartEndDates(progItem);
                    if (!dates) continue;

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // get all missed + today attempts
                    let pendingAttempts = await getPendingAttempts({
                        userId,
                        scheduleType,
                        startDate: dates.startDate,
                        endDate: dates.endDate,
                        scheduleDays,
                        today
                    });

                    // OPTIONAL: send only 1 per run (recommended)
                    pendingAttempts = pendingAttempts.slice(0, 1);

                    for (const attempt of pendingAttempts) {

                        const alreadySentToday = await NotificationLog.findOne({
                            user_id: userId,
                            company_id: companyId,
                            template_id: template._id,
                            schedule_date: { $gte: startOfDay, $lte: endOfDay }
                        });

                        if (alreadySentToday) continue;

                        await ReplaceTemplateField({
                            userId: userId.toString(),
                            notificationId: templateId,
                            to: email.trim(),
                            event: template.template_name,
                            means: template.template_name,
                            explanation: template.description || "",
                            userPassword: ""
                        });

                        await NotificationLog.create({
                            user_id: userId,
                            company_id: companyId,
                            template_id: template._id,
                            template_name: template?.template_name || "",
                            attemptNo: attempt.attemptNo,
                            reason: scheduleType,
                            schedule_date: today
                        });
                    }
                }
            }
        }

    } catch (error) {
        console.error("Schedule Notification Error:", error);
        throw error;
    }
};

module.exports = scheduleNotificationCommand;
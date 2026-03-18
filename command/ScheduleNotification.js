const ScheduleNotification = require("../model/ScheduleNotification");
const User = require("../model/User");
const ActivityLog = require("../model/ActivityFolderReport");
const NotificationTemplate = require("../model/Notifications");
const mongoose = require("mongoose");

const scheduleNotificationCommand = async () => {
    try {
        const scheduleNotifications = await ScheduleNotification.find({
            repeat_type: "2",
            _id: { $ne: new mongoose.Types.ObjectId("6878cd0351dcbae6759e8912") }
        }).lean();

        for (const item of scheduleNotifications) {

            const moduleIdArr = (item.module_id || []).map(id => new mongoose.Types.ObjectId(id));
            const templateId = item.template_id;
            const scheduleUserIds = (item.schedule_user_id || []).map(id => new mongoose.Types.ObjectId(id));

            // 🔹 Fetch in parallel
            const [notificationTemplate, users, activityLogs] = await Promise.all([
                NotificationTemplate.findById(templateId).lean(),
                User.find({
                    is_send_notification: false,
                    _id: { $in: scheduleUserIds }
                }).lean(),
                ActivityLog.find({
                    is_notification_send: false,
                    is_completed: true,
                    module_id: { $in: moduleIdArr }
                }).lean()
            ]);

            if (!notificationTemplate) {
                console.log(`Template not found for ID: ${templateId}`);
                continue;
            }

            let scheduleDays = Number(item.schedule_days || 0);

            // console.log("Schedule data", {
            //     scheduleDays,
            //     activityLogCount: activityLogs.length,
            //     userCount: users.length,
            //     templateName: notificationTemplate?.name
            // });

            // // 🔹 Example: mark activity logs as notification sent
            // if (activityLogs.length > 0 && users.length > 0) {
            //     await ActivityLog.updateMany(
            //         { _id: { $in: activityLogs.map(a => a._id) } },
            //         { $set: { is_notification_send: true } }
            //     );

            //     await User.updateMany(
            //         { _id: { $in: users.map(u => u._id) } },
            //         { $set: { is_send_notification: true } }
            //     );
            // }
        }

    } catch (error) {
        console.error("Schedule Notification Error:", error);
        throw error;
    }
};

module.exports = scheduleNotificationCommand;
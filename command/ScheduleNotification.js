const ScheduleNotification = require("../model/ScheduleNotification")
const User = require("../model/User")
const ActivityLog = require("../model/ActivityLog")

const scheduleNotificationCommand = async () => {
    try {

        const scheduleNotification = await ScheduleNotification.find({ repeat_type: "2" });
        const user = await User.find({ is_send_notification: false });
        const activityLog = await ActivityLog.find({ is_send_notification: false })

        for (const [index, item] of scheduleNotification.entries()) {

            //return
            // console.log("Item", item);
        }

    } catch (error) {

        throw new Error(error)
    }
}

module.exports = scheduleNotificationCommand
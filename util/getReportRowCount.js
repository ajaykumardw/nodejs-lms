const User = require("../model/User");
const Activity = require("../model/Activity");
const Module = require("../model/Module");

exports.getReportRowCount = async (reportType) => {
    switch (reportType) {
        case "users":
            return await User.countDocuments();

        case "activity":
            return await Activity.countDocuments();

        case "modules":
            return await Module.countDocuments();

        default:
            throw new Error("Invalid report type");
    }
};

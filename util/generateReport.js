const fs = require("fs-extra");
const path = require("path");
const { Parser } = require("json2csv");
const User = require("../model/User");
const Activity = require("../model/Activity");

exports.generateReport = async (reportType) => {
    let data = [];

    switch (reportType) {
        case "users":
            data = await User.find().lean();
            break;

        case "activity":
            data = await Activity.find().lean();
            break;

        default:
            throw new Error("Invalid report type");
    }

    const parser = new Parser();
    const csv = parser.parse(data);

    const fileName = `${reportType}_${Date.now()}.csv`;
    const filePath = path.join(__dirname, "../uploads", fileName);

    await fs.ensureDir(path.join(__dirname, "../uploads"));
    await fs.writeFile(filePath, csv);

    return filePath;
};

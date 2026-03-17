const ExportCenter = require("../../model/ExportCenter");
const { reportQueue } = require("../../queues/reportQueue");
const { createDownloadEntry } = require("../../util/createDownloadEntry");
const { successResponse } = require("../../util/response");

exports.getExportCenterController = async (req, res, next) => {
    try {

        const userId = req.userId;

        const exportData = await ExportCenter.find({ user_id: userId })

        return successResponse(res, "Export center data fetched successfully", exportData);

    } catch (error) {
        next(error)
    }
}

exports.postExportCenterController = async (req, res, next) => {
    try {

        const userId = req.userId;

        const { reportType = "", visibleColumns = [] } = req.body;

        const objVal = visibleColumns;

        const job = await createDownloadEntry(userId, reportType);

        await reportQueue.add("generateReport", {
            downloadId: job._id,
            reportType,
            value: objVal,
            userId
        });

        return successResponse(res, "Report added to download center");
    } catch (error) {
        next(error);
    }
};

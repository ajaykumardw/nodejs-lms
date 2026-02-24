const ExportCenter = require("../model/ExportCenter");

exports.createDownloadEntry = async (userId, reportType) => {

    try {
        const download = await ExportCenter.create({
            user_id: userId,
            status: "pending",
            progress_percent: 0,
            report_type: reportType,
            file_path: null,
        });

        return download;

    } catch (error) {
        throw error;
    }
};

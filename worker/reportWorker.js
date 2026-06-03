const { Worker } = require("bullmq");
const { connection } = require("../queues/reportQueue");
const ExportCenter = require("../model/ExportCenter");
const fs = require("fs-extra");
const path = require("path");

const ExcelJS = require("exceljs");

const slugify = (text) =>
    text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')        // spaces → -
        .replace(/[^\w-]+/g, '')     // remove special chars
        .replace(/--+/g, '-');       // collapse multiple -

const worker = new Worker(
    "reportQueue",
    async (job) => {
        const { downloadId, reportType, value } = job.data;

        await ExportCenter.findByIdAndUpdate(downloadId, {
            status: "in_progress",
            progress_percent: 0,
        });

        if (!value || !value.length) {
            throw new Error("No data provided");
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Report");

        const columns = Object.keys(value[0]).map(key => ({
            header: key,
            key: key,
            width: 20,
        }));

        sheet.columns = columns;

        value.forEach(row => {
            sheet.addRow(row);
        });

        const fileName = `${slugify(reportType)}_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, "../public/uploads/exportCenter", fileName);

        await fs.ensureDir(path.join(__dirname, "../public/uploads/exportCenter"));
        await workbook.xlsx.writeFile(filePath);

        await ExportCenter.findByIdAndUpdate(downloadId, {
            status: "completed",
            progress_percent: 100,
            file_path: fileName,
        });

        return true;
    },
    { connection }
);

module.exports = worker;
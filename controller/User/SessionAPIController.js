const mongoose = require("mongoose");
const BatchSession = require("../../model/BatchSession");
const BatchLearner = require("../../model/BatchLearner");
const BatchSessionAttendance = require("../../model/BatchAttendance");
const BatchSessionPreRead = require("../../model/BatchSessionPreRead");
const BatchSessionPreReadProgress = require("../../model/BatchPreReadProgress");
const BatchSessionPostRead = require("../../model/BatchPostRead");
const BatchAssignmentSubmission = require("../../model/BatchAssignment");
const BatchSessionMaterial = require("../../model/BatchSessionMaterial");
const { successResponse, errorResponse } = require("../../util/response");

exports.getSessionDetail = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return errorResponse(res, "Invalid session id", {}, 400);
        }

        const session = await BatchSession.findOne({ _id: sessionId, batch_id: batchId })
            .populate("batch_id", "name")
            .lean();

        if (!session) {
            return errorResponse(res, "Session not found", {}, 404);
        }

        const totalLearners = await BatchLearner.countDocuments({
            batch_id: batchId,
            status: { $in: ["confirmed", "nominated"] },
        });

        const attendanceAgg = await BatchSessionAttendance.aggregate([
            { $match: { session_id: session._id } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);

        const attendanceCounts = { present: 0, late: 0, absent: 0, pending: 0 };
        attendanceAgg.forEach((a) => {
            attendanceCounts[a._id] = a.count;
        });
        attendanceCounts.pending = Math.max(
            totalLearners - attendanceCounts.present - attendanceCounts.late - attendanceCounts.absent,
            0
        );

        const preReadItems = await BatchSessionPreRead.find({ session_id: session._id }).lean();
        const preReadIds = preReadItems.map((p) => p._id);
        const preReadCompletedLearnerIds = await BatchSessionPreReadProgress.distinct("learner_id", {
            pre_read_id: { $in: preReadIds },
            completed: true,
        });

        const materialsCount = await BatchSessionMaterial.countDocuments({ session_id: session._id });

        const postReadItems = await BatchSessionPostRead.find({ session_id: session._id }).lean();
        const postReadIds = postReadItems.map((p) => p._id);
        const submissions = await BatchAssignmentSubmission.countDocuments({
            post_read_id: { $in: postReadIds },
        });
        const pendingPostRead = Math.max(
            totalLearners * postReadItems.length - submissions,
            0
        );

        const finalData = {
            session: {
                id: session._id,
                batchId: session.batch_id?._id,
                batchName: session.batch_id?.name,
                title: `Session ${session.session_number}`,
                date: session.session_date,
                startTime: session.start_time,
                endTime: session.end_time,
                venue: session.venue,
                status: session.status,
            },
            learners: {
                total: totalLearners,
                present: attendanceCounts.present,
                late: attendanceCounts.late,
                absent: attendanceCounts.absent,
                pending: attendanceCounts.pending,
            },
            preRead: {
                total: preReadItems.length,
                completed: preReadCompletedLearnerIds.length,
            },
            materials: materialsCount,
            postRead: {
                assignments: postReadItems.length,
                submissions,
                pending: pendingPostRead,
            },
        };

        return successResponse(res, "Session fetched successfully", finalData);
    } catch (error) {
        next(error);
    }
};
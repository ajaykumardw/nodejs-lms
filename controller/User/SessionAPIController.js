const mongoose = require("mongoose");
const BatchSession = require("../../model/BatchSession");
const BatchLearner = require("../../model/BatchLearner");
const BatchSessionAttendance = require("../../model/BatchAttendance");
const Activity = require("../../model/Activity")
const Batch = require("../../model/Batch")
const ActivityLog = require("../../model/ActivityFolderReport")
const { successResponse, errorResponse } = require("../../util/response");

exports.getSessionDetail = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return errorResponse(res, "Invalid session id", {}, 400);
        }

        const batch = await Batch.findById(batchId)

        if (!batch) {

            return errorResponse(res, "Batch not found", {}, 404)
        }

        const session = await BatchSession.findOne({ _id: sessionId, batch_id: batchId })
            .populate("batch_id", "name")
            .lean();

        if (!session) {
            return errorResponse(res, "Session not found", {}, 404);
        }

        const batchLearner = await BatchLearner.find({
            batch_id: batchId,
            status: "confirmed",
        })

        const totalLearners = batchLearner?.length;

        const learnerIds = batchLearner.map(bl => bl.learner_id)

        const attendanceAgg = await BatchSessionAttendance.aggregate([
            {
                $match: {
                    session_id: mongoose.Types.ObjectId.createFromHexString(sessionId),
                    batch_id: mongoose.Types.ObjectId.createFromHexString(batchId),
                    learner_id: {
                        $in: learnerIds
                    }
                }
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
        ]);

        const attendanceCounts = { present: 0, late: 0, absent: 0, pending: 0 };

        attendanceAgg.forEach((a) => {
            attendanceCounts[a._id] = a.count;
        });

        attendanceCounts.pending = Math.max(
            totalLearners - attendanceCounts.present - attendanceCounts.late - attendanceCounts.absent,
            0
        );

        const preReadItems = await Activity.find({
            engage_type: "pre_read",
            module_id: batch?.module_id,
        });

        const preReadIds = preReadItems.map((p) => p._id);
        const preReadCompletedLearnerIds = await ActivityLog.distinct("user_id", {
            activity_id: { $in: preReadIds },
            user_id: {
                $in: learnerIds
            },
            batch_id: batchId,
            session_id: sessionId,
            is_completed: true,
        });

        const materialsCount = await Activity.countDocuments({
            engage_type: "training_material",
            module_id: batch?.module_id,
        });

        const postReadItems = await Activity.find({
            engage_type: "post_read",
            module_id: batch?.module_id,
        }).lean();
        const postReadIds = postReadItems.map((p) => p._id);

        const submissions = await ActivityLog.countDocuments({
            activity_id: { $in: postReadIds },
            user_id: {
                $in: learnerIds
            },
            batch_id: batchId,
            session_id: sessionId
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
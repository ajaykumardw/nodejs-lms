const mongoose = require("mongoose");
const Batch = require("../../../model/Batch");
const BatchLearner = require("../../../model/BatchLearner");
const BatchSession = require("../../../model/BatchSession");
const BatchSessionAttendance = require("../../../model/BatchAttendance");
const ActivityLog = require("../../../model/ActivityFolderReport");
const Activity = require("../../../model/Activity");
const { successResponse, errorResponse } = require("../../../util/response");

// GET /user/learner/batches
// All batches this learner is enrolled in, with their own progress summary.
exports.getMyBatches = async (req, res, next) => {
    try {
        const learnerId = req.userId;

        const enrollments = await BatchLearner.find({
            learner_id: learnerId,
            status: { $in: ["confirmed", "nominated"] },
        })
            .populate("batch_id")
            .lean();

        const batchIds = enrollments.map((e) => e.batch_id?._id).filter(Boolean);

        // Attendance: how many sessions has this learner been marked present/late for
        // vs. how many sessions have happened, per batch.
        const attendanceAgg = await BatchSessionAttendance.aggregate([
            {
                $match: {
                    learner_id: mongoose.Types.ObjectId.createFromHexString(String(learnerId)),
                    batch_id: { $in: batchIds },
                },
            },
            {
                $group: {
                    _id: "$batch_id",
                    total: { $sum: 1 },
                    present: {
                        $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] },
                    },
                },
            },
        ]);
        const attendanceMap = new Map(
            attendanceAgg.map((a) => [String(a._id), a])
        );

        const batches = enrollments
            .filter((e) => e.batch_id)
            .map((e) => {
                const batch = e.batch_id;
                const att = attendanceMap.get(String(batch._id));
                const attendancePct = att && att.total ? Math.round((att.present / att.total) * 100) : 0;

                return {
                    id: batch._id,
                    name: batch.name,
                    status: batch.status,
                    startDate: batch.start_date,
                    endDate: batch.end_date,
                    venue: batch.venue,
                    enrollmentStatus: e.status,
                    attendancePercentage: attendancePct,
                };
            });

        return successResponse(res, "Batches fetched successfully", { batches });
    } catch (error) {
        next(error);
    }
};

// GET /user/learner/batches/:batchId
// Sessions for one batch, with per-session attendance + pre-read status for this learner.
// Mount checkEnrollment before this route.
exports.getBatchSessions = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const learnerId = req.userId;

        const batch = await Batch.findById(batchId).lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const sessions = await BatchSession.find({ batch_id: batchId })
            .sort({ session_number: 1 })
            .lean();

        const sessionIds = sessions.map((s) => s._id);

        const attendanceRecords = await BatchSessionAttendance.find({
            session_id: { $in: sessionIds },
            learner_id: learnerId,
        }).lean();
        const attendanceMap = new Map(
            attendanceRecords.map((a) => [String(a.session_id), a.status])
        );

        const enrichedSessions = sessions.map((s) => ({
            id: s._id,
            sessionNumber: s.session_number,
            date: s.session_date,
            startTime: s.start_time,
            endTime: s.end_time,
            venue: s.venue,
            status: s.status,
            myAttendanceStatus: attendanceMap.get(String(s._id)) || "pending",
        }));

        return successResponse(res, "Sessions fetched successfully", {
            batch: { id: batch._id, name: batch.name, status: batch.status },
            sessions: enrichedSessions,
        });
    } catch (error) {
        next(error);
    }
};

// GET /user/learner/overview
// Dashboard summary stats for the learner landing page.
exports.getLearnerOverview = async (req, res, next) => {
    try {
        const learnerId = req.userId;

        const enrollments = await BatchLearner.find({
            learner_id: learnerId,
            status: { $in: ["confirmed", "nominated"] },
        }).lean();

        const batchIds = enrollments.map((e) => e.batch_id);

        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        const sessionsToday = await BatchSession.countDocuments({
            batch_id: { $in: batchIds },
            session_date: { $gte: startOfDay, $lte: endOfDay },
        });

        // Pending pre-reads: module-level activities under this learner's
        // batches that have no completed ActivityLog for this learner yet.
        const batches = await Batch.find({ _id: { $in: batchIds } }).select("module_id").lean();
        const moduleIds = batches.map((b) => b.module_id);

        const preReadActivities = await Activity.find({
            module_id: { $in: moduleIds },
            engage_type: "pre_read",
        }).select("_id").lean();
        const preReadIds = preReadActivities.map((a) => a._id);

        const completedPreReadIds = await ActivityLog.distinct("activity_id", {
            activity_id: { $in: preReadIds },
            user_id: learnerId,
            is_completed: true,
        });

        const pendingPreReads = preReadIds.length - completedPreReadIds.length;

        return successResponse(res, "Overview fetched successfully", {
            stats: {
                enrolledBatches: batchIds.length,
                sessionsToday,
                pendingPreReads: Math.max(pendingPreReads, 0),
            },
        });
    } catch (error) {
        next(error);
    }
};
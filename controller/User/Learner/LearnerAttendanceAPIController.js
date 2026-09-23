const BatchSession = require("../../../model/BatchSession");
const BatchSessionAttendance = require("../../../model/BatchAttendance");
const { successResponse, errorResponse } = require("../../../util/response");

// GET /user/learner/batches/:batchId/sessions/:sessionId/attendance
// Mount checkEnrollment before this route.
//
// Deliberately no corresponding write endpoint on the learner router —
// attendance may only be marked by a trainer via the existing
// /user/trainer/... routes. Do not add a PUT here.
exports.getMyAttendance = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const learnerId = req.userId;

        const record = await BatchSessionAttendance.findOne({
            session_id: sessionId,
            learner_id: learnerId,
        }).lean();

        return successResponse(res, "Attendance fetched successfully", {
            status: record?.status || "pending",
            markedAt: record?.marked_at || null,
        });
    } catch (error) {
        next(error);
    }
};

// GET /user/learner/batches/:batchId/attendance
// Mount checkEnrollment before this route.
//
// Full attendance history for this learner across every session in the
// batch — one row per session, plus a summary percentage. This is what
// backs a dedicated "My Attendance" page, distinct from the single-session
// status already folded into getBatchSessions.
exports.getMyAttendanceHistory = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const learnerId = req.userId;

        const sessions = await BatchSession.find({ batch_id: batchId })
            .sort({ session_number: 1 })
            .lean();

        const sessionIds = sessions.map((s) => s._id);

        const records = await BatchSessionAttendance.find({
            session_id: { $in: sessionIds },
            learner_id: learnerId,
        }).lean();
        const recordMap = new Map(records.map((r) => [String(r.session_id), r]));

        const history = sessions.map((s) => {
            const record = recordMap.get(String(s._id));
            return {
                sessionId: s._id,
                sessionNumber: s.session_number,
                date: s.session_date,
                startTime: s.start_time,
                endTime: s.end_time,
                venue: s.venue,
                status: record?.status || "pending",
                markedAt: record?.marked_at || null,
                remarks: record?.remarks || "",
            };
        });

        // Only count sessions that have actually happened / been marked as
        // part of the percentage — an upcoming session sitting at "pending"
        // shouldn't drag the score down.
        const countedSessions = history.filter((h) => h.status !== "pending");
        const presentCount = countedSessions.filter((h) => h.status === "present" || h.status === "late").length;
        const attendancePercentage = countedSessions.length
            ? Math.round((presentCount / countedSessions.length) * 100)
            : 0;

        return successResponse(res, "Attendance history fetched successfully", {
            history,
            summary: {
                totalSessions: sessions.length,
                markedSessions: countedSessions.length,
                presentCount,
                attendancePercentage,
            },
        });
    } catch (error) {
        next(error);
    }
};
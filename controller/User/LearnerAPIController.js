    const mongoose = require("mongoose");
    const BatchLearner = require("../../model/BatchLearner");
    const { successResponse, errorResponse } = require("../../util/response");
    const { decrypt } = require("../../util/encryption");

    exports.getSessionLearners = async (req, res, next) => {
        try {
            const { batchId, sessionId } = req.params;
            const { search = "", status = "all" } = req.query;

            const matchStage = { batch_id: mongoose.Types.ObjectId.createFromHexString(batchId) };

            const pipeline = [
                { $match: matchStage },
                {
                    $lookup: {
                        from: "users",
                        localField: "learner_id",
                        foreignField: "_id",
                        pipeline: [
                            { $project: { first_name: 1, last_name: 1, email: 1, employee_id: 1, department: 1 } },
                        ],
                        as: "user",
                    },
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                ...(search
                    ? [
                        {
                            $match: {
                                $or: [
                                    { "user.first_name": { $regex: search, $options: "i" } },
                                    { "user.last_name": { $regex: search, $options: "i" } },
                                    { "user.email": { $regex: search, $options: "i" } },
                                    { "user.employee_id": { $regex: search, $options: "i" } },
                                ],
                            },
                        },
                    ]
                    : []),
                {
                    $lookup: {
                        from: "batch_session_attendance",
                        let: { learnerId: "$learner_id" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$learner_id", "$$learnerId"] } } },
                        ],
                        as: "attendanceRecords",
                    },
                },
            ];

            const rows = await BatchLearner.aggregate(pipeline);

            const enriched = rows.map((r) => {
                const total = r.attendanceRecords.length || 0;
                const present = r.attendanceRecords.filter((a) => a.status === "present").length;
                const attendancePct = total ? Math.round((present / total) * 100) : 0;
                const isAtRisk = attendancePct < 70 && total > 0;

                return {
                    id: r.learner_id,
                    name: `${r.user?.first_name || ""} ${r.user?.last_name || ""}`.trim(),
                    email: decrypt(r.user?.email),
                    employeeId: r.user?.employee_id,
                    department: r.user?.department,
                    attendance: attendancePct,
                    status: isAtRisk ? "At Risk" : "Active",
                };
            });

            const filtered = status === "all" ? enriched : enriched.filter((l) => l.status === status);

            return successResponse(res, "Learners fetched successfully", { learners: filtered });
        } catch (error) {
            next(error);
        }
    };
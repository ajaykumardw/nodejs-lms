const mongoose = require("mongoose");
const Batch = require("../../model/Batch");
const BatchSession = require("../../model/BatchSession");
const BatchLearner = require("../../model/BatchLearner");
const BatchSessionAttendance = require("../../model/BatchAttendance");
const { successResponse, errorResponse } = require("../../util/response");
const { decrypt } = require("../../util/encryption");


const { ObjectId } = mongoose.Types;
const STATUSES = ["present", "late", "absent", "pending"];

// Decrypts a value; if it isn't encrypted (or fails), returns it unchanged so one bad row can't break the dashboard
const safeDecrypt = (value) => {
    if (!value) return value;
    try {
        return decrypt(value);
    } catch (err) {
        return value;
    }
};

const getDateRange = (range) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
        case "today":
            return { $gte: start, $lt: new Date(start.getTime() + 86400000) };
        case "week": {
            const day = start.getDay() === 0 ? 7 : start.getDay(); // Monday = 1
            const monday = new Date(start.getTime() - (day - 1) * 86400000);
            return { $gte: monday, $lt: new Date(monday.getTime() + 7 * 86400000) };
        }
        case "month":
            return {
                $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            };
        default:
            return null; // "all"
    }
};

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Works whether the users collection has `name` or `first_name` / `last_name`
const userName = (path) => ({
    $trim: {
        input: {
            $ifNull: [
                `$${path}.name`,
                {
                    $concat: [
                        { $ifNull: [`$${path}.first_name`, ""] },
                        " ",
                        { $ifNull: [`$${path}.last_name`, ""] },
                    ],
                },
            ],
        },
    },
});

exports.getAttendanceDashboardAPIController = async (req, res, next) => {
    try {
        const companyId = req?.userId;
        if (!companyId) return errorResponse(res, "Unauthorized", 401);

        const {
            range = "today",
            batch_id,
            module_id,
            status,
            search = "",
        } = req.query;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

        // 1. Batches belonging to this company (+ optional filters)
        const batchFilter = { company_id: ObjectId.createFromHexString(companyId) };
        if (batch_id && ObjectId.isValid(batch_id)) batchFilter._id = ObjectId.createFromHexString(batch_id);
        if (module_id && ObjectId.isValid(module_id)) batchFilter.module_id = ObjectId.createFromHexString(module_id);

        const [batches, batchOptions] = await Promise.all([
            Batch.find(batchFilter).select("_id").lean(),
            Batch.find({ company_id: ObjectId.createFromHexString(companyId) })
                .select("_id name")
                .sort({ createdAt: -1 })
                .lean(),
        ]);
        const batchIds = batches.map((b) => b._id);

        // 2. Sessions inside the date range (cancelled sessions are ignored)
        const sessionFilter = {
            batch_id: { $in: batchIds },
            status: { $ne: "cancelled" },
        };
        const dateRange = getDateRange(range);
        if (dateRange) sessionFilter.session_date = dateRange;

        const sessionIds = await BatchSession.find(sessionFilter).distinct("_id");

        const attendanceMatch = { session_id: { $in: sessionIds } };

        // 3. Everything in parallel
        const [enrolledLearners, statusCounts, trend, logResult] = await Promise.all([
            // enrolled = confirmed learners (distinct)
            BatchLearner.find({ batch_id: { $in: batchIds }, status: "confirmed" })
                .distinct("learner_id"),

            BatchSessionAttendance.aggregate([
                { $match: attendanceMatch },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),

            // Attendance % per session day (late counts as attended)
            BatchSessionAttendance.aggregate([
                { $match: { ...attendanceMatch, status: { $ne: "pending" } } },
                {
                    $lookup: {
                        from: "batch_session",
                        localField: "session_id",
                        foreignField: "_id",
                        as: "session",
                    },
                },
                { $unwind: "$session" },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$session.session_date" } },
                        attended: {
                            $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] },
                        },
                        total: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                {
                    $project: {
                        _id: 0,
                        date: "$_id",
                        total: 1,
                        rate: { $round: [{ $multiply: [{ $divide: ["$attended", "$total"] }, 100] }, 1] },
                    },
                },
            ]),

            // Paginated log
            (() => {
                const logMatch = { ...attendanceMatch };
                if (STATUSES.includes(status)) logMatch.status = status;

                const pipeline = [
                    { $match: logMatch },
                    { $lookup: { from: "batch_session", localField: "session_id", foreignField: "_id", as: "session" } },
                    { $unwind: "$session" },
                    { $lookup: { from: "batch", localField: "batch_id", foreignField: "_id", as: "batch" } },
                    { $unwind: "$batch" },
                    { $lookup: { from: "users", localField: "learner_id", foreignField: "_id", as: "learner" } },
                    { $unwind: "$learner" },
                    { $lookup: { from: "batch_session_trainer", localField: "session_id", foreignField: "session_id", as: "trainerLinks" } },
                    { $lookup: { from: "users", localField: "trainerLinks.trainer_id", foreignField: "_id", as: "trainers" } },
                    {
                        $addFields: {
                            learner_name: userName("learner"),
                            batch_name: "$batch.name",
                        },
                    },
                ];

                if (search.trim()) {
                    const rx = new RegExp(escapeRegex(search.trim()), "i");
                    pipeline.push({
                        $match: { $or: [{ learner_name: rx }, { batch_name: rx }, { "learner.email": rx }] },
                    });
                }

                pipeline.push(
                    { $sort: { "session.session_date": -1, "session.start_time": -1, _id: 1 } },
                    {
                        $facet: {
                            items: [
                                { $skip: (page - 1) * limit },
                                { $limit: limit },
                                {
                                    $project: {
                                        _id: 1,
                                        status: 1,
                                        method: { $ifNull: ["$method", "manual"] },
                                        remarks: 1,
                                        marked_at: 1,
                                        learner: { _id: "$learner._id", name: "$learner_name", email: "$learner.email" },
                                        batch: { _id: "$batch._id", name: "$batch_name" },
                                        session: {
                                            _id: "$session._id",
                                            session_number: "$session.session_number",
                                            session_date: "$session.session_date",
                                            start_time: "$session.start_time",
                                            end_time: "$session.end_time",
                                        },
                                        trainers: {
                                            $map: {
                                                input: "$trainers",
                                                as: "t",
                                                in: { _id: "$$t._id", name: userName("$t"), email: "$$t.email" },
                                            },
                                        },
                                    },
                                },
                            ],
                            total: [{ $count: "count" }],
                        },
                    }
                );

                return BatchSessionAttendance.aggregate(pipeline);
            })(),
        ]);

        // 4. Shape response
        const counts = { present: 0, late: 0, absent: 0, pending: 0 };
        statusCounts.forEach((s) => { counts[s._id] = s.count; });

        const totalMarked = counts.present + counts.late + counts.absent;
        const attendanceRate = totalMarked
            ? Math.round(((counts.present + counts.late) / totalMarked) * 1000) / 10
            : 0;

        const facet = logResult[0] || { items: [], total: [] };
        const totalLogs = facet.total[0]?.count || 0;

        const items = facet.items.map((item) => ({
            ...item,
            learner: {
                ...item.learner,
                email: safeDecrypt(item.learner?.email),
            },
        }));

        return successResponse(res, "Attendance data fetched successfully", {
            filters: { range, batch_id: batch_id || null, status: status || null, search },
            stats: {
                totalLearners: enrolledLearners.length,
                present: counts.present,
                absent: counts.absent,
                late: counts.late,
                pending: counts.pending,
                totalMarked,
                attendanceRate,
            },
            trend,
            logs: {
                items,
                page,
                limit,
                total: totalLogs,
                totalPages: Math.ceil(totalLogs / limit),
            },
            batches: batchOptions,
        });
    } catch (error) {
        next(error);
    }
};


exports.markAttendanceAPIController = async (req, res, next) => {
    try {
        const companyId = req?.userId;
        const { session_id, records } = req.body;

        if (!ObjectId.isValid(session_id) || !Array.isArray(records) || !records.length) {
            return errorResponse(res, "session_id and records are required", 400);
        }

        const session = await BatchSession.findById(session_id).lean();
        if (!session) return errorResponse(res, "Session not found", 404);

        const batch = await Batch.findOne({ _id: session.batch_id, company_id: companyId }).lean();
        if (!batch) return errorResponse(res, "Not allowed to mark this session", 403);

        // only confirmed learners can be marked
        const confirmed = await BatchLearner.find({ batch_id: batch._id, status: "confirmed" })
            .distinct("learner_id");
        const confirmedSet = new Set(confirmed.map(String));

        const ops = records
            .filter((r) => confirmedSet.has(String(r.learner_id)) && STATUSES.includes(r.status))
            .map((r) => ({
                updateOne: {
                    filter: { session_id: session._id, learner_id: r.learner_id },
                    update: {
                        $set: {
                            batch_id: batch._id,
                            status: r.status,
                            remarks: r.remarks || "",
                            method: r.method || "manual",
                            marked_by: companyId,
                            marked_at: new Date(),
                        },
                    },
                    upsert: true,
                },
            }));

        if (!ops.length) return errorResponse(res, "No valid records to save", 400);

        await BatchSessionAttendance.bulkWrite(ops);
        return successResponse(res, "Attendance marked successfully", { updated: ops.length });
    } catch (error) {
        next(error);
    }
};
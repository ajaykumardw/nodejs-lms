const mongoose = require("mongoose");
const BatchLearner = require("../../model/BatchLearner");
const BatchSessionAttendance = require("../../model/BatchAttendance");
const { successResponse, errorResponse } = require("../../util/response");
const { decrypt } = require("../../util/encryption");

const PAGE_SIZE = 20;

exports.getSessionAttendance = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const search = (req.query.search || "").trim();

        const matchStage = { batch_id: mongoose.Types.ObjectId.createFromHexString(batchId) };

        const searchMatch = search
            ? {
                $or: [
                    { "user.first_name": { $regex: search, $options: "i" } },
                    { "user.last_name": { $regex: search, $options: "i" } },
                    { "user.email": { $regex: search, $options: "i" } },
                ],
            }
            : {};

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: "users",
                    localField: "learner_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { first_name: 1, last_name: 1, email: 1 } }],
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            ...(search ? [{ $match: searchMatch }] : []),
            {
                $lookup: {
                    from: "batch_session_attendance",
                    let: { learnerId: "$learner_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$learner_id", "$$learnerId"] },
                                        { $eq: ["$session_id", mongoose.Types.ObjectId.createFromHexString(sessionId)] },
                                    ],
                                },
                            },
                        },
                    ],
                    as: "attendance",
                },
            },
            { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: true } },
            { $sort: { "user.first_name": 1 } },
            {
                $facet: {
                    data: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }],
                    totalCount: [{ $count: "count" }],
                },
            },
        ];

        const result = await BatchLearner.aggregate(pipeline);
        const rows = result[0]?.data || [];
        const total = result[0]?.totalCount?.[0]?.count || 0;

        const learners = rows.map((r) => ({
            id: r.learner_id,
            name: `${r.user?.first_name || ""} ${r.user?.last_name || ""}`.trim(),
            email: decrypt(r.user?.email),
            status: r.attendance?.status || "pending",
        }));

        return successResponse(res, "Attendance fetched successfully", {
            learners,
            page,
            pageSize: PAGE_SIZE,
            totalPages: Math.ceil(total / PAGE_SIZE) || 1,
            totalLearners: total,
        });
    } catch (error) {
        next(error);
    }
};

exports.markAttendance = async (req, res, next) => {
    try {
        const { batchId, sessionId, learnerId } = req.params;
        const { status } = req.body;
        const trainerId = req?.userId;

        if (!["present", "late", "absent", "pending"].includes(status)) {
            return errorResponse(res, "Invalid status", {}, 400);
        }

        const record = await BatchSessionAttendance.findOneAndUpdate(
            { session_id: sessionId, learner_id: learnerId },
            {
                $set: {
                    status,
                    batch_id: batchId,
                    marked_by: trainerId,
                    marked_at: new Date(),
                },
            },
            { new: true, upsert: true }
        );

        return successResponse(res, "Attendance updated", { record });
    } catch (error) {
        next(error);
    }
};

exports.markAllPresent = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;
        const trainerId = req?.userId;

        const learnerIds = await BatchLearner.find({
            batch_id: batchId,
            status: { $in: ["confirmed", "nominated"] },
        }).distinct("learner_id");

        const ops = learnerIds.map((learnerId) => ({
            updateOne: {
                filter: { session_id: sessionId, learner_id: learnerId },
                update: {
                    $set: {
                        status: "present",
                        batch_id: batchId,
                        marked_by: trainerId,
                        marked_at: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        if (ops.length) {
            await BatchSessionAttendance.bulkWrite(ops);
        }

        return successResponse(res, "All learners marked present", { updated: ops.length });
    } catch (error) {
        next(error);
    }
};

exports.bulkSaveAttendance = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;
        const { records = [] } = req.body;
        const trainerId = req?.userId;

        const ops = records.map(({ learnerId, status }) => ({
            updateOne: {
                filter: { session_id: sessionId, learner_id: learnerId },
                update: {
                    $set: {
                        status,
                        batch_id: batchId,
                        marked_by: trainerId,
                        marked_at: new Date(),
                    },
                },
                upsert: true,
            },
        }));

        if (ops.length) {
            await BatchSessionAttendance.bulkWrite(ops);
        }

        return successResponse(res, "Attendance saved", { updated: ops.length });
    } catch (error) {
        next(error);
    }
};
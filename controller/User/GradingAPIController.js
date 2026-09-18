const mongoose = require("mongoose");
const BatchTrainer = require("../../model/BatchSessionTrainer");
const BatchSession = require("../../model/BatchSession");
const BatchAssignmentSubmission = require("../../model/BatchAssignment");
const { successResponse, errorResponse } = require("../../util/response");

exports.getGradingQueue = async (req, res, next) => {
    try {
        const trainerId = req?.userId;

        const sessionIds = await BatchTrainer.find({ trainer_id: trainerId }).distinct("session_id");
        const batchIds = await BatchSession.find({ _id: { $in: sessionIds } }).distinct("batch_id");

        const submissions = await BatchAssignmentSubmission.aggregate([
            { $match: { batch_id: { $in: batchIds } } },
            {
                $lookup: {
                    from: "users",
                    localField: "learner_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { first_name: 1, last_name: 1 } }],
                    as: "learner",
                },
            },
            { $unwind: { path: "$learner", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "batch",
                    localField: "batch_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { name: 1 } }],
                    as: "batch",
                },
            },
            { $unwind: { path: "$batch", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "batch_session_post_read",
                    localField: "post_read_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { title: 1 } }],
                    as: "assignment",
                },
            },
            { $unwind: { path: "$assignment", preserveNullAndEmptyArrays: true } },
            { $sort: { submitted_at: -1 } },
        ]);

        const rows = submissions.map((s) => ({
            id: s._id,
            learner: `${s.learner?.first_name || ""} ${s.learner?.last_name || ""}`.trim(),
            batchId: s.batch_id,
            batch: s.batch?.name,
            assignment: s.assignment?.title,
            submittedOn: s.submitted_at,
            score: s.score,
        }));

        return successResponse(res, "Grading queue fetched successfully", { submissions: rows });
    } catch (error) {
        next(error);
    }
};

exports.setSubmissionScore = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const { score } = req.body;
        const trainerId = req?.userId;

        if (score === undefined || score < 0 || score > 5) {
            return errorResponse(res, "score must be between 0 and 5", {}, 400);
        }

        const submission = await BatchAssignmentSubmission.findByIdAndUpdate(
            submissionId,
            {
                $set: {
                    score,
                    status: "graded",
                    graded_by: trainerId,
                    graded_at: new Date(),
                },
            },
            { new: true }
        );

        if (!submission) {
            return errorResponse(res, "Submission not found", {}, 404);
        }

        return successResponse(res, "Score saved", { submission });
    } catch (error) {
        next(error);
    }
};
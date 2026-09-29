const mongoose = require("mongoose");
const ActivityLog = require("../../model/ActivityFolderReport")
const BatchTrainer = require("../../model/BatchSessionTrainer");
const BatchSession = require("../../model/BatchSession");
const BatchAssignmentSubmission = require("../../model/BatchAssignment");
const { successResponse, errorResponse } = require("../../util/response");

const moduleTypeLabel = {
    '688723af5dd97f4ccae68834': 'Documents & Slides',
    '688723af5dd97f4ccae68835': 'Video',
    '688723af5dd97f4ccae68836': 'YouTube Video',
    '688723af5dd97f4ccae68837': 'Scrom Content',
    '688723af5dd97f4ccae68838': 'Web Link',
    '688723af5dd97f4ccae68839': 'Subjective Assessment',
    '688723af5dd97f4ccae6883a': 'Flash Card',
    "68886902954c4d9dc7a379bd": "Quiz"
}

exports.getGradingQueue = async (req, res, next) => {
    try {
        const trainerId = req?.userId;

        const sessionIds = await BatchTrainer.find({ trainer_id: trainerId }).distinct("session_id");
        const batchIds = await BatchSession.find({ _id: { $in: sessionIds } }).distinct("batch_id");

        const submissions = await ActivityLog.aggregate([
            { $match: { batch_id: { $in: batchIds } } },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
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
                    from: "batch_session",
                    localField: "batch_id",
                    foreignField: "batch_id",
                    as: "session"
                }
            },
            { $unwind: { path: "$session", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "activity",
                    localField: "activity_id",
                    foreignField: "_id",
                    pipeline: [{ $project: { title: 1, module_type_id: 1 } }],
                    as: "activity",
                },
            },
            { $unwind: { path: "$activity", preserveNullAndEmptyArrays: true } },
            { $sort: { start_activity_time: -1 } },
        ]);

        const rows = submissions.map((s) => ({
            id: s._id,
            learner: `${s.learner?.first_name || ""} ${s.learner?.last_name || ""}`.trim(),
            batchId: s.batch_id,
            batch: s.batch?.name,
            sessionId: s?.session?._id,
            session: s?.session?.session_number,
            assignment: moduleTypeLabel?.[s?.activity?.module_type_id],
            submittedOn: s.start_activity_time,
            score: s.completion_percentage,
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
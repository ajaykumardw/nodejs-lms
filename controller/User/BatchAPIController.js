const mongoose = require("mongoose");
const Batch = require("../../model/Batch");
const BatchLearner = require("../../model/BatchLearner");
const BatchSession = require("../../model/BatchSession");
const BatchTrainer = require("../../model/BatchSessionTrainer");
const { successResponse, errorResponse } = require("../../util/response");

exports.getTrainerBatches = async (req, res, next) => {
    try {
        const userId = (req.userId);

        const sessionIds = await BatchTrainer.find({ trainer_id: userId }).distinct("session_id");

        const batchIds = await BatchSession.find({ _id: { $in: sessionIds } }).distinct("batch_id");

        const batches = await Batch.find({ _id: { $in: batchIds } }).lean();

        const enriched = await Promise.all(
            batches.map(async (batch) => {
                const learners = await BatchLearner.countDocuments({
                    batch_id: batch._id,
                    status: { $in: ["confirmed", "nominated"] },
                });

                const sessions = await BatchSession.find({ batch_id: batch._id })
                    .sort({ session_number: 1 })
                    .lean();

                const scheduleDays = [
                    ...new Set(
                        sessions.map((s) =>
                            new Date(s.session_date).toLocaleDateString("en-US", { weekday: "short" })
                        )
                    ),
                ].join(", ");

                return {
                    id: batch._id,
                    name: batch.name,
                    learners,
                    status: batch.status,
                    schedule: scheduleDays || "—",
                };
            })
        );

        return successResponse(res, "Batches fetched successfully", { batches: enriched });
    } catch (error) {
        next(error);
    }
};

exports.getBatchDetail = async (req, res, next) => {
    try {
        const { batchId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(batchId)) {
            return errorResponse(res, "Invalid batch id", {}, 400);
        }

        const batch = await Batch.findById(batchId).lean();

        if (!batch) {
            return errorResponse(res, "Batch not found", {}, 404);
        }

        const sessions = await BatchSession.find({ batch_id: batchId })
            .sort({ session_number: 1 })
            .lean();

        return successResponse(res, "Batch fetched successfully", { batch, sessions });
    } catch (error) {
        next(error);
    }
};
const mongoose = require("mongoose");
const BatchSessionNote = require("../../model/BatchSessionNote");
const { successResponse, errorResponse } = require("../../util/response");

/**
 * GET /trainer/batches/:batchId/sessions/:sessionId/notes
 */
exports.getSessionNotes = async (req, res, next) => {
    try {
        const { sessionId } = req.params;

        const note = await BatchSessionNote.findOne({ session_id: sessionId }).lean();

        return successResponse(res, "Notes fetched successfully", {
            note: note || { topics_covered: [], outcome_notes: "", completed: false },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /trainer/batches/:batchId/sessions/:sessionId/notes
 * body: { topics_covered: [], outcome_notes: "" }
 */
exports.saveSessionNotes = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;
        const { topics_covered, outcome_notes } = req.body;
        const trainerId = req?.userId;

        const note = await BatchSessionNote.findOneAndUpdate(
            { session_id: sessionId },
            {
                $set: {
                    batch_id: batchId,
                    ...(topics_covered !== undefined && { topics_covered }),
                    ...(outcome_notes !== undefined && { outcome_notes }),
                    created_by: trainerId,
                },
            },
            { new: true, upsert: true }
        );

        return successResponse(res, "Notes saved successfully", { note });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /trainer/batches/:batchId/sessions/:sessionId/complete
 */
exports.completeSession = async (req, res, next) => {
    try {
        const { batchId, sessionId } = req.params;
        const trainerId = req?.userId;

        const note = await BatchSessionNote.findOneAndUpdate(
            { session_id: sessionId },
            {
                $set: {
                    batch_id: batchId,
                    completed: true,
                    completed_at: new Date(),
                    created_by: trainerId,
                },
            },
            { new: true, upsert: true }
        );

        const BatchSession = require("../../model/BatchSession");
        await BatchSession.findByIdAndUpdate(sessionId, { $set: { status: "completed" } });

        return successResponse(res, "Session marked as completed", { note });
    } catch (error) {
        next(error);
    }
};
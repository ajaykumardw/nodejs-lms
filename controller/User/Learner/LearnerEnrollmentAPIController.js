const mongoose = require("mongoose");
const BatchLearner = require("../../../model/BatchLearner");
const { successResponse, errorResponse } = require("../../../util/response");

// GET /user/learner/enrollments
// All batch nominations/enrollments for this learner, regardless of status —
// including ones still awaiting a response. This is deliberately separate
// from getMyBatches (which only returns confirmed/nominated batches that
// have already been "accepted enough" to show content for).
exports.getMyEnrollments = async (req, res, next) => {
    try {
        const learnerId = req.userId;

        const enrollments = await BatchLearner.find({ learner_id: learnerId })
            .populate("batch_id")
            .sort({ nominated_at: -1 })
            .lean();

        const rows = enrollments
            .filter((e) => e.batch_id)
            .map((e) => ({
                batchId: e.batch_id._id,
                batchName: e.batch_id.name,
                venue: e.batch_id.venue,
                startDate: e.batch_id.start_date,
                endDate: e.batch_id.end_date,
                status: e.status,
                nominatedAt: e.nominated_at,
                respondedAt: e.responded_at,
                // A learner can act on this one — everything else is just history.
                needsResponse: ["nominated", "not_responded"].includes(e.status),
            }));

        return successResponse(res, "Enrollments fetched successfully", { enrollments: rows });
    } catch (error) {
        next(error);
    }
};

// PUT /user/learner/enrollments/:batchId/respond
// body: { action: "confirm" | "decline" }
//
// Does NOT sit behind checkEnrollment — that middleware only allows
// confirmed/nominated batches through, and a learner needs to be able to
// respond to a "not_responded" nomination too. Instead this looks up the
// learner's own BatchLearner row directly and checks it belongs to them.
exports.respondToEnrollment = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const { action } = req.body;
        const learnerId = req.userId;

        if (!["confirm", "decline"].includes(action)) {
            return errorResponse(res, "action must be 'confirm' or 'decline'", {}, 400);
        }

        if (!mongoose.Types.ObjectId.isValid(batchId)) {
            return errorResponse(res, "A valid batchId is required", {}, 400);
        }

        const enrollment = await BatchLearner.findOne({
            batch_id: batchId,
            learner_id: learnerId,
        });

        if (!enrollment) {
            return errorResponse(res, "You have not been nominated for this batch", {}, 404);
        }

        if (!["nominated", "not_responded"].includes(enrollment.status)) {
            return errorResponse(
                res,
                `This enrollment has already been ${enrollment.status} and can't be changed here`,
                {},
                409
            );
        }

        const now = new Date();
        enrollment.status = action === "confirm" ? "confirmed" : "declined";
        enrollment.responded_at = now;
        enrollment.status_changed_by = learnerId;
        if (action === "confirm") enrollment.confirmed_at = now;
        if (action === "decline") enrollment.declined_at = now;

        await enrollment.save();

        return successResponse(res, `Enrollment ${enrollment.status}`, { enrollment });
    } catch (error) {
        next(error);
    }
};
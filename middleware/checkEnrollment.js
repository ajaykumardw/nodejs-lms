const mongoose = require("mongoose");
const BatchLearner = require("../model/BatchLearner");
const { errorResponse } = require("../util/response");

/**
 * Blocks any learner route unless the caller (req.userId, from the auth
 * token) is actually enrolled in the batchId being requested.
 *
 * Reads batchId from params, then query, then body (in that order) so it
 * can sit in front of GET and PUT/POST routes alike.
 *
 * IMPORTANT: this must run on every learner-facing route that touches
 * batch-scoped data. Never trust a batchId alone from the client without
 * this check — otherwise any authenticated learner could read/write
 * another batch's data just by changing the batchId in the request.
 */
exports.checkEnrollment = async (req, res, next) => {
    try {
        const batchId = req.params.batchId || req.query.batchId || req.body.batchId;
        const learnerId = req.userId;

        if (!learnerId) {
            return errorResponse(res, "Unauthorized", {}, 401);
        }

        if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
            return errorResponse(res, "A valid batchId is required", {}, 400);
        }

        const enrollment = await BatchLearner.findOne({
            batch_id: batchId,
            learner_id: learnerId,
            status: { $in: ["confirmed", "nominated"] },
        }).lean();

        if (!enrollment) {
            return errorResponse(res, "You are not enrolled in this batch", {}, 403);
        }

        // Downstream controllers can read this instead of re-querying.
        req.enrollment = enrollment;
        next();
    } catch (error) {
        next(error);
    }
};
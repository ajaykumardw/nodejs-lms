const mongoose = require("mongoose");
const Activity = require("../../model/Activity");
const Batch = require("../../model/Batch");
const ActivityLog = require("../../model/ActivityLog"); // confirm this is the right file/model name
const { resolveActivityDisplay } = require("../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../util/response");

exports.getPreReadItems = async (req, res, next) => {
    try {
        const { batchId } = req.query;

        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);

        const batch = await Batch.findById(batchId).select("module_id").lean();

        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const activities = await Activity.find({
            module_id: batch.module_id,
            engage_type: "pre_read",
        }).lean();

        const activityIds = activities.map((a) => a._id);

        const progress = await ActivityLog.aggregate([
            {
                $match: {
                    activity_id: { $in: activityIds },
                    program_id: mongoose.Types.ObjectId.createFromHexString(batchId), // rename if program_id != batch
                },
            },
            { $group: { _id: "$activity_id", completed: { $sum: { $cond: ["$is_completed", 1, 0] } } } },
        ]);

        const progressMap = Object.fromEntries(progress.map((p) => [String(p._id), p.completed]));

        console.log("Activity", activities, batch)

        const items = activities.map((a) => {
            const { title, type } = resolveActivityDisplay(a);
            return {
                id: a._id,
                title,
                type,
                completions: progressMap[String(a._id)] || 0,
            };
        });

        return successResponse(res, "Pre-read fetched", { items });
    } catch (error) {
        next(error);
    }
};

// Learner (or trainer previewing) marks a pre-read activity done/undone
exports.togglePreReadDone = async (req, res, next) => {
    try {
        const { preReadId } = req.params; // this is now an Activity _id
        const userId = req?.userId;
        const { batchId } = req.body; // needed since progress is scoped per batch/program

        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);

        const activity = await Activity.findById(preReadId).lean();
        if (!activity) return errorResponse(res, "Pre-read item not found", {}, 404);

        const existing = await ActivityLog.findOne({
            activity_id: preReadId,
            user_id: userId,
            program_id: batchId,
        }).lean();

        const nextDone = !(existing?.is_completed);

        const record = await ActivityLog.findOneAndUpdate(
            { activity_id: preReadId, user_id: userId, program_id: batchId },
            {
                $set: {
                    module_id: activity.module_id,
                    engage_type: "pre_read",
                    module_type_id: activity.module_type_id,
                    is_completed: nextDone,
                    completed_at_time: nextDone ? new Date() : null,
                },
            },
            { new: true, upsert: true }
        );

        return successResponse(res, "Pre-read status updated", { record });
    } catch (error) {
        next(error);
    }
};

// Creates module-level content, not a per-session record
exports.createPreReadItem = async (req, res, next) => {
    try {
        const trainerId = req?.userId;
        const { batchId, title, type, resource_url, image_url } = req.body;

        if (!batchId || !title || !type) {
            return errorResponse(res, "batchId, title and type are required", {}, 400);
        }

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const typeDataKey = { document: "document_data", video: "video_data", youtube: "youtube_data", scorm: "scorm_data" }[type];
        if (!typeDataKey) return errorResponse(res, "Unsupported type", {}, 400);

        const activity = await Activity.create({
            module_id: batch.module_id,
            engage_type: "pre_read",
            image_url: image_url || "",
            created_by: trainerId,
            [typeDataKey]: { title, ...(resource_url ? { [typeDataKey === "document_data" ? "page_no" : "video_url"]: resource_url } : {}) },
        });

        return successResponse(res, "Pre-read item created", { item: activity });
    } catch (error) {
        next(error);
    }
};
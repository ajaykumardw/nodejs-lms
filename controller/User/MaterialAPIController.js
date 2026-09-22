const Activity = require("../../model/Activity");
const Batch = require("../../model/Batch");
const { resolveActivityDisplay } = require("../../util/resolveActivityDisplay");
const { successResponse, errorResponse } = require("../../util/response");

exports.getMaterials = async (req, res, next) => {
    try {
        const { batchId } = req.query;
        if (!batchId) return errorResponse(res, "batchId is required", {}, 400);

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const activities = await Activity.find({
            module_id: batch.module_id,
            engage_type: "training_material"
        })
            .populate("questions")
            .lean();

        const materials = activities.map((a) => {
            const { title, type } = resolveActivityDisplay(a);
            return {
                _id: a._id,
                title,
                type,
                questions: a?.questions,
                file_url: a.document_data?.image_url || a.video_data?.video_url || a.scorm_data?.content_url
            };
        });

        return successResponse(res, "Materials fetched successfully", { materials });
    } catch (error) {
        next(error);
    }
};

exports.uploadMaterial = async (req, res, next) => {
    try {
        const trainerId = req?.userId;
        const { batchId, title, type, file_url, image_url } = req.body;

        if (!batchId || !title || !type) {
            return errorResponse(res, "batchId, title and type are required", {}, 400);
        }

        const batch = await Batch.findById(batchId).select("module_id").lean();
        if (!batch) return errorResponse(res, "Batch not found", {}, 404);

        const typeDataKey = { document: "document_data", video: "video_data", scorm: "scorm_data" }[type];
        if (!typeDataKey) return errorResponse(res, "Unsupported type", {}, 400);

        const material = await Activity.create({
            module_id: batch.module_id,
            engage_type: "training_material",
            image_url: image_url || "",
            created_by: trainerId,
            [typeDataKey]: { title, ...(typeDataKey === "document_data" ? { image_url: file_url } : { video_url: file_url }) },
        });

        return successResponse(res, "Material uploaded successfully", { material });
    } catch (error) {
        next(error);
    }
};

exports.deleteMaterial = async (req, res, next) => {
    try {
        const { materialId } = req.params;
        const deleted = await Activity.findOneAndDelete({ _id: materialId, engage_type: "training_material" });
        if (!deleted) return errorResponse(res, "Material not found", {}, 404);
        return successResponse(res, "Material deleted successfully", {});
    } catch (error) {
        next(error);
    }
};
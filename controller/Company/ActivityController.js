const AppConfig = require('../../model/AppConfig');
const Activity = require('../../model/Activity')
const mongoose = require('mongoose')
const { errorResponse, successResponse } = require('../../util/response');

exports.getActivityAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const module_id = req.params.moduleId;

        const activities = await Activity.aggregate([
            {
                $match: {
                    created_by: new mongoose.Types.ObjectId(userId),
                    module_id: new mongoose.Types.ObjectId(module_id)
                }
            },
            {
                $lookup: {
                    from: 'app_config',
                    let: { moduleTypeId: '$module_type_id' },
                    pipeline: [
                        { $unwind: '$activity_data' },
                        { $match: { $expr: { $eq: ['$activity_data._id', '$$moduleTypeId'] } } },
                        { $project: { _id: 0, activity_data: 1 } }
                    ],
                    as: 'activity_type',
                }
            },
            {
                $unwind: {
                    path: '$activity_type',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Populate virtual 'questions'
            {
                $lookup: {
                    from: 'questions',            // collection name
                    localField: '_id',            // Activity _id
                    foreignField: 'activity_id',  // questions.activity_id
                    as: 'questions'               // result array
                }
            }
        ]);

        if (!activities) {
            return errorResponse(res, "Activity does not exist", {}, 404)
        }

        return successResponse(res, "Activity fetched successfully", activities)

    } catch (error) {
        next(error)
    }
}

exports.getCreateFormAPI = async (req, res, next) => {
    try {
        const appConfig = await AppConfig.findOne({ type: 'Activity_data' });

        if (!appConfig) {
            return errorResponse(res, 'App config does not exist', {}, 404);
        }

        return successResponse(res, 'Create data fetched successfully', {
            appConfig,
        });
    } catch (error) {
        console.error('getCreateFormAPI error:', error);
        return errorResponse(res, 'Internal Server Error', {}, 500);
    }
};

exports.postActivityFormAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const mId = req.params.moduleId;
        const typeId = req.params.typeId;

        const activity = new Activity({
            created_by: userId,
            module_id: mId,
            module_type_id: typeId
        })

        await activity.save()

        return successResponse(res, "Activity saved successfully")

    } catch (error) {
        next(error)
    }
}

exports.deleteActivityAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const moduleId = req.params.moduleId;
        const id = req.params.id;

        const activity = await Activity.findOne({ created_by: userId, module_id: moduleId, _id: id })

        if (!activity) {
            return errorResponse(res, "Activity does not exist", {}, 404)
        }

        await Activity.findOneAndDelete({ created_by: userId, module_id: moduleId, _id: id })

        return successResponse(res, "Activity deleted successfully")

    } catch (error) {
        next(error)
    }
}

exports.setNameActivityAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const moduleId = req.params.moduleId;
        const id = req.params.id;

        const { title } = req.body;

        const activity = await Activity.findOne({ created_by: userId, module_id: moduleId, _id: id })

        if (!activity) {
            return errorResponse(res, "Activity does not exist", {}, 404)
        }

        await Activity.findOneAndUpdate({ created_by: userId, module_id: moduleId, _id: id }, {
            $set: {
                name: title
            }
        })

        return successResponse(res, "Activity saved successfully")

    } catch (error) {
        next(error);
    }
}

exports.postActivityDataAPI = async (req, res, next) => {
    try {
        const { moduleId, moduleTypeId, id } = req.params;
        const userId = req.userId;

        const activity = await Activity.findOne({
            created_by: userId,
            module_id: moduleId,
            module_type_id: moduleTypeId,
            _id: id
        });

        if (!activity)
            return errorResponse(res, "Activity does not exist", {}, 404);

        const { title, video_url } = req.body;
        const file = req.file;

        const updatePayload = {};

        // ------------------------
        // DOCUMENT UPLOAD
        // ------------------------

        if (moduleTypeId === "688723af5dd97f4ccae68834") {
            updatePayload.document_data = {
                title,
                image_url: file?.filename || activity.document_data?.image_url || ""
            };
        }

        // ------------------------
        // VIDEO UPLOAD
        // ------------------------
        else if (moduleTypeId === "688723af5dd97f4ccae68835") {
            updatePayload.video_data = {
                title,
                video_url: file?.filename || activity.video_data?.video_url || ""
            };
        }

        // ------------------------
        // YOUTUBE VIDEO
        // ------------------------
        else if (moduleTypeId === "688723af5dd97f4ccae68836") {
            updatePayload.video_data = {
                title,
                video_url: video_url || activity.video_data?.video_url || ""
            };
        }

        // ------------------------
        // SCORM UPLOAD
        // ------------------------
        else if (moduleTypeId === "688723af5dd97f4ccae68837") {

            if (!req.scormExtractedPath)
                return errorResponse(res, "Invalid SCORM ZIP file", {}, 400);

            const folderPath = req.scormExtractedPath;        // activity/<folderName>
            const folderName = folderPath.split('/').pop();   // only folderName

            updatePayload.scorm_data = {
                title,
                folder_url: folderPath,                        // path relative to public
                folder_name: folderName,
                launch_file: req.scormLaunchFile || null       // save launch HTML file
            };
        }

        else {
            return errorResponse(res, "Unsupported moduleTypeId", {}, 400);
        }

        await Activity.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true }
        );

        return successResponse(res, "Activity data uploaded successfully");

    } catch (error) {
        next(error);
    }
};
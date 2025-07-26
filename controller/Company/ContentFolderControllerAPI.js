const ContentFolder = require('../../model/ContentFolder');
const Program = require('../../model/Program');
const { errorResponse, successResponse } = require('../../util/response');

exports.getContentFolderAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;

        const program = await Program.findById(id);

        if (!program) {
            return errorResponse(res, "Program does not exist", {}, 404)
        }

        const contentFolder = await ContentFolder.find({ created_by: userId, program_id: id })

        if (!contentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404)
        }

        return successResponse(res, "Content folder fetched successfully", contentFolder)

    } catch (error) {
        next(error)
    }
}

exports.postContentFolderAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;

        const program = await Program.findById(id);

        if (!program) {
            return errorResponse(res, "Program does not exist", {}, 404)
        }

        const { title, description } = req.body;

        const image = req?.file?.filename || '';

        const contentFolder = new ContentFolder({
            title,
            description,
            image_url: image,
            created_by: userId,
            program_id: id
        })

        await contentFolder.save()

        return successResponse(res, "Content folder created successfully")


    } catch (error) {
        next(error)
    }
}

exports.editContentFolderAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;
        const cid = req.params.cfId;

        const program = await Program.findById(id);

        if (!program) {
            return errorResponse(res, "Program does not exist", {}, 404)
        }

        const contentFolder = await ContentFolder.findOne({ created_by: userId, _id: cid, program_id: id })

        if (!contentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404)
        }

        return successResponse(res, "Content folder fetched successfully", contentFolder)

    } catch (error) {
        next(error)
    }
}

exports.updateContentFolderAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;
        const cid = req.params.cfId;

        const program = await Program.findById(id);

        if (!program) {
            return errorResponse(res, "Program does not exist", {}, 404)
        }

        const { title, description } = req.body;

        const selectContentFolder = await ContentFolder.findOne({ created_by: userId, _id: cid, program_id: id })

        if (!selectContentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404)
        }

        const image = req?.file?.filename ?? selectContentFolder?.image_url ?? '';

        await ContentFolder.findOneAndUpdate({ created_by: userId, _id: cid, program_id: id }, {
            $set: {
                title,
                description,
                image_url: image
            }
        })

        return successResponse(res, "Content folder updated successfully")

    } catch (error) {
        next(error)
    }
}
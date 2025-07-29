const AppConfig = require('../../model/AppConfig');
const ContentFolder = require('../../model/ContentFolder')
const Module = require('../../model/Module')
const Program = require('../../model/Program');
const { errorResponse, successResponse } = require('../../util/response');

exports.getProgramAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const program = await Program.find({ created_by: userId }).sort({ title: 1 }).populate('content_folders')

        if (!program) {
            return errorResponse(res, "Program is not found", {}, 404)
        }

        return successResponse(res, "Program fetched successfully", program)

    } catch (error) {
        next(error)
    }
}

exports.getEditDataAPI = async (req, res, next) => {
    try {

        const id = req.params.id;
        const userId = req.userId;

        const program = await Program.findOne({ created_by: userId, _id: id })

        if (!program) {
            return errorResponse(res, "Program do not exist", {}, 404)
        }

        return successResponse(res, "Program edit fetched successfully", program)

    } catch (error) {
        next(error)
    }
}

exports.postProgramAPI = async (req, res, next) => {

    try {

        const userId = req.userId;
        const fileName = req.file?.filename || '';

        const { title, description } = req.body;

        const program = new Program({
            title,
            description,
            image_url: fileName,
            created_by: userId
        })

        await program.save();

        if (!program) {
            return errorResponse(res, "Program did not saved", {}, 404)
        }

        return successResponse(res, "Program saved successfully")


    } catch (error) {
        next(error)
    }
}

exports.updateProgramDataAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;

        const program = await Program.findOne({ created_by: userId, _id: id })

        if (!program) {
            return errorResponse(res, "Program does not exist", {}, 404)
        }

        const fileName = req.file?.filename || program.image_url;

        const { title, description } = req.body;

        await Program.findOneAndUpdate({ created_by: userId, _id: id }, {
            $set: {
                title,
                description,
                image_url: fileName
            }
        })

        return successResponse(res, "Program fetched successfully", program)

    } catch (error) {
        next(error)
    }
}

exports.getCategoryAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const category = req.params.category;

        let data;

        if (category == 'Content Folder') {
            data = await Program.find({ created_by: userId })
        } else if (category == 'Module') {
            data = await ContentFolder.find({ created_by: userId })
        }

        return successResponse(res, "Category fetched successfully", data)

    } catch (error) {
        next(error)
    }
}

exports.getCreateDataAPI = async (req, res, next) => {
    try {

        const appConfig = await AppConfig.findOne({ type: "module_type" })

        if (!appConfig) {
            return errorResponse(res, "App Config does not exist", {}, 404)
        }

        return successResponse(res, "Create data fetched successfully", appConfig)

    } catch (error) {
        next(error)
    }
}

exports.getCategoryBreadcumb = async (req, res, next) => {

    try {

        const userId = req.userId;
        const stage = req.params.stage;
        const id = req.params.id;

        let breadcrumb = {};

        if (stage === 'Module') {

            const module = await Module.findOne({ created_by: userId, _id: id })
                .populate({
                    path: 'content_folder_id',
                    populate: {
                        path: 'program_id',
                        model: 'Program'
                    }
                });

            if (!module) return res.status(404).json({ message: 'Module not found' });

            breadcrumb = {
                program: module.content_folder_id?.program_id || null,
                content_folder: module.content_folder_id || null,
                module: module
            };

        } else if (stage === 'Content Folder') {
            const contentFolder = await ContentFolder.findOne({ created_by: userId, _id: id })
                .populate('program_id');

            if (!contentFolder) return res.status(404).json({ message: 'Content Folder not found' });

            breadcrumb = {
                program: contentFolder.program_id || null,
                content_folder: contentFolder
            };

        } else if (stage === 'Program') {
            const program = await Program.findOne({ created_by: userId, _id: id });

            if (!program) return res.status(404).json({ message: 'Program not found' });

            breadcrumb = {
                program: program
            };

        } else {
            return res.status(400).json({ message: 'Invalid stage' });
        }

        return successResponse(res, "Breadcrumb data fetched successfully", breadcrumb);

    } catch (error) {
        next(error);
    }
};
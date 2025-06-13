const appMenu = require('../../model/AppMenu');
const Language = require('../../model/Language');
const { errorResponse, successResponse } = require('../../util/response');

exports.getAppMenuAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const AppMenu = await appMenu.find();

        const language = await Language.find({ created_by: userId });

        if (!appMenu || !language) {
            return errorResponse(res, "Data does not exist", {}, 404);
        }
        const data = { menu: AppMenu, language }

        return successResponse(res, "Menu data fetched successfully", data);

    } catch (error) {
        next(error);
    }
}

exports.postAppMenuAPI = async (req, res, next) => {
    try {
        const data = req.body;

        if (!data || data.length === 0) {
            return errorResponse(res, "Data does not exist", {}, 404);
        }

        for (const item of data) {
            const labelId = item['label_id'];
            const default_translation = item['language_values'];

            await appMenu.findByIdAndUpdate(labelId, { default_translation }, { new: true, runValidators: true });
        }

        return successResponse(res, "Data updated successfully");
    } catch (error) {
        next(error);
    }
};

exports.createLabelAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const language = await Language.find({ created_by: userId });

        if (!language) {
            return errorResponse(res, "Language does not exist", {}, 404)
        }

        return successResponse(res, "Language fetched successfully", language)

    } catch (error) {
        next(error);
    }

}

exports.postLabelAPI = (req, res, next) => {
    try {

        const { name } = req.body;

        const AppMenu = new appMenu({
            label_name: name,
        })

        AppMenu.save();

        return successResponse(res, "App menu saved successfully")

    } catch (error) {
        next(error);
    }
}


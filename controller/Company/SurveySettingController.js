const ModuleSurvey = require('../../model/ModuleSurvey');

const { successResponse, errorResponse } = require('../../util/response');


exports.getSurveySettingAPI = async (req, res, next) => {
    try {

        const { moduleId } = req.params;
        const userId = req.userId;

        const moduleSurvey = await ModuleSurvey.find({
            moduleId,
            createdBy: userId
        });

        if (!moduleSurvey) {
            return errorResponse(res, "Survey settings not found", {}, 404);
        }

        return successResponse(res, "Survey settings retrieved successfully", moduleSurvey);

    } catch (error) {
        next(error);
    }
}

exports.postSurveySettingAPI = async (req, res, next) => {
    try {
        const { moduleId } = req.params;
        const { questions } = req.body;
        const userId = req.userId;

        // Remove old survey questions
        await ModuleSurvey.deleteMany({
            moduleId,
            createdBy: userId
        });

        // Prepare insert operations
        const surveyDocs = questions.map(questionObj => ({
            moduleId,
            question: questionObj.text,
            questionsType: questionObj.type,
            multiOption: questionObj.multiOption || false,
            options: questionObj?.options || [],
            mandatory: questionObj.mandatory || false,
            createdBy: userId
        }));

        // Insert all at once
        await ModuleSurvey.insertMany(surveyDocs);

        return successResponse(res, "Survey settings saved successfully", {});
    } catch (error) {
        next(error);
    }
};

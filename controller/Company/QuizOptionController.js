const Question = require('../../model/Question');
const QuizSetting = require("../../model/QuizSetting")
const {
    successResponse
} = require('../../util/response');

exports.getQuizOptionAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const moduleId = req.params.moduleId;
        const activityId = req.params.activityId;

        const question = await Question.find({
            company_id: userId,
            activity_id: activityId,
            module_id: moduleId
        })

        return successResponse(res, "Question fetched successfully", question)

    } catch (error) {
        next(error)
    }
}

exports.postQuizOptionAPI = async (req, res, next) => {
    try {
        const {
            userId
        } = req;
        const {
            activityId,
            moduleId
        } = req.params;
        const data = req.body;

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No quiz data provided"
            });
        }

        const finalData = data.map(item => ({
            company_id: userId,
            activity_id: activityId,
            module_id: moduleId,
            question: item?.Question,
            option1: item?.['Option1'] !== undefined && item?.['Option1'] !== "" ? String(item['Option1']) : null,
            option2: item?.['Option2'] !== undefined && item?.['Option2'] !== "" ? String(item['Option2']) : null,
            option3: item?.['Option3'] !== undefined && item?.['Option3'] !== "" ? String(item['Option3']) : null,
            option4: item?.['Option4'] !== undefined && item?.['Option4'] !== "" ? String(item['Option4']) : null,
            option5: item?.['Option5'] !== undefined && item?.['Option5'] !== "" ? String(item['Option5']) : null,
            option6: item?.['Option6'] !== undefined && item?.['Option6'] !== "" ? String(item['Option6']) : null,
            section: item?.Section || null,
            score: 10,
            question_type: item?.['QuestionType'] || "Single Correct",
            use_answer_explanation: item?.["UseAnswerExplanation"] || false,
            correct_answer: item?.['CorrectAnswer'] || [],
            diffculty: item?.['DifficultyLevel'] || "1",
            answer_explanation: item?.['AnswerExplanation'] || null
        }));

        const quizSetting = new QuizSetting({
            module_id: moduleId,
            user_id: userId,
            activity_id: activityId,
            created_by: userId
        })

        // Save multiple documents at once
        await Question.insertMany(finalData);

        await quizSetting.save();

        return successResponse(res, "Quiz questions saved successfully");

    } catch (error) {
        console.error("Error saving quiz questions:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.putQuizOptionAPI = async (req, res, next) => {
    try {

        const userId = req.userId; // middleware sets this

        const {
            activityId,
            moduleId
        } = req.params;

        const {
            data,
            section
        } = req.body;

        if (!Array.isArray(data)) {
            return res.status(400).json({
                message: "Invalid data format: 'data' must be an array"
            });
        }

        const quizSetting = await QuizSetting.findOne({
            module_id: moduleId,
            activity_id: activityId,
            user_id: userId,
            created_by: userId
        })

        await Promise.all(
            data.map(async (item) => {
                if (!item) return; // skip falsy entries

                // Defensive: ensure options array exists
                if (!Array.isArray(item.options)) {
                    item.options = [];
                }

                // Prepare option fields: option1 ... option6
                const optionFields = {};
                for (let i = 0; i < 6; i++) {
                    optionFields[`option${i + 1}`] = item.options[i] || "";
                }

                const questionData = {
                    company_id: userId,
                    activity_id: activityId,
                    module_id: moduleId,
                    score: 10,
                    section: item?.section_name || "",
                    use_answer_explanation: item?.use_answer_explanation || false,
                    answer_explanation: item?.answer_explanation || "",
                    question_type: item.question_type,
                    question: item.question || "",
                    correct_answer: item.correct_answer || [],
                    diffculty: item.difficulty || 1, // fallback difficulty 1   
                    ...optionFields,
                    updated_at: new Date(),
                };

                if (item._id) {
                    // Update existing question
                    await Question.findByIdAndUpdate(item._id, questionData);
                } else {
                    // Create new question
                    const newQuestion = new Question({
                        ...questionData,
                        created_at: new Date(),
                    });
                    await newQuestion.save();
                }
            })
        );

        if (!quizSetting) {
            const quiz_setting = new QuizSetting({
                module_id: moduleId,
                user_id: userId,
                activity_id: activityId,
                created_by: userId
            })

            await quiz_setting.save()

        }

        return res.status(200).json({
            message: "Questions updated/created successfully"
        });
    } catch (error) {
        console.error("Error in putQuizOptionAPI:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}
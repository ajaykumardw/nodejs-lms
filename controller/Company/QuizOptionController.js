const Question = require('../../model/Question');
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
            option1: item?. ['Option 1'] !== undefined && item?. ['Option 1'] !== "" ? String(item['Option 1']) : null,
            option2: item?. ['Option 2'] !== undefined && item?. ['Option 2'] !== "" ? String(item['Option 2']) : null,
            option3: item?. ['Option 3'] !== undefined && item?. ['Option 3'] !== "" ? String(item['Option 3']) : null,
            option4: item?. ['Option 4'] !== undefined && item?. ['Option 4'] !== "" ? String(item['Option 4']) : null,
            option5: item?. ['Option 5'] !== undefined && item?. ['Option 5'] !== "" ? String(item['Option 5']) : null,
            option6: item?. ['Option 6'] !== undefined && item?. ['Option 6'] !== "" ? String(item['Option 6']) : null,
            section: item?.Section || null,
            score: 10,
            correct_answer: item?. ['Correct Answer'] || null,
            diffculty: item?. ['Difficulty Level'] || null,
            answer_explanation: item?. ['Answer Explanation'] || null
        }));

        // Save multiple documents at once
        await Question.insertMany(finalData);

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
                    question: item.question || "",
                    correct_answer: item.correct_answer || "",
                    diffculty: item.difficulty || 1, // fallback difficulty 1
                    answer_explanation: item.explanation || "",
                    section: section || "default",
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
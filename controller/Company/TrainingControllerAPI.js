require('dotenv').config();
const Training = require('../../model/Training.js');
const trainingService = require('../../services/trainingService.js');
const { successResponse, errorResponse, warningResponse } = require('../../util/response.js');

const getTrainingAPI = async (req, res, next) => {
    try {
        const companyId = req.user?._id || req.userId;

        const filter = { company_id: companyId };

        // If status is present in query, add it to the filter
        if (req.query.status !== undefined) {
            filter.status = req.query.status === 'true';
        }

        const data = await Training.find(filter)//.select('name status');

        return successResponse(res, "Training fetched successfully!", data);
    } catch (error) {
        next(error);
    }
};


const postTrainingAPI = async (req, res, next) => {
try {
    const { title, description, category_id } = req.body;
    const user = req.user;

//   //Check for existing training with same name under same company
    const existing = await Training.findOne({
        company_id: user._id,
        name: { $regex: new RegExp(`^${title}$`, 'i') } // case-insensitive match
    });

    if (existing) {
        return warningResponse(res, "Training with this name already exists.", {}, 409);
    }
    let image = '';
    if (req.file) {
        image = `${req.uploadPath}/${req.file.filename}`;
    }

    const training = new Training({
    company_id: user._id,
    title,
    description,
    category_id,
    status : 'draft',
    image
    });





    await training.save();

    return successResponse(res, "Training created successfully!", training);
} catch (err) {
    console.log('err', err);
    return errorResponse(res, "Failed to create training", err, 500);
}
};

const putTrainingAPI = async (req, res, next) => {
try {

    console.log('req.body', req.body);
    const { title, description, category_id, status } = req.body;
    const user = req.user;

    const training = await Training.findOne({ company_id: user._id, _id: req.params.id });
    if (!training) {
    return warningResponse(res, "Training not found.", {}, 404);
    }


    training.title = title;
    training.description = description;
    training.category_id = category_id;

if (req.file) {
    training.image = `${req.uploadPath}/${req.file.filename}`;
}
    await training.save();

    return successResponse(res, "Training updated successfully!", training);
} catch (err) {
    console.log('err', err)
    return errorResponse(res, "Failed to update training", err, 500);
}
};
  
const getTrainingByIdAPI = async (req, res, next) => {
    try {
        const companyId = req.user?._id || req.userId;
        const data = await Training.findOne({ company_id: companyId, _id: req.params.id });
        return successResponse(res, "Training fetched successfully!", data);
    } catch (error) {
        next(error);
    }
};

const updateSettings = async (req, res, next) => {
    try {
        const response = await trainingService.updateSettings(req);
        if(response['status']){
            return successResponse(res, response['message'], response['data']);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const getPaginatedTrainings = async (req, res, next) => {
    try {
        const response = await trainingService.getPaginatedTrainings(req, res);
        if(response['status']){
            return successResponse(res, response['message'], response);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const deleteTrainingAPI = async (req, res, next) => {
    try {
        const response = await trainingService.deleteTraining(req);
        if(response.status){
            return successResponse(res, response.message);
        }else{
            return errorResponse(res, response.message);
        }
        
    } catch (error) {
        next(error);
    }
}

const putTrainingStatusAPI = async (req, res, next) => {
    try {
        const response = await trainingService.updateStatus(req);
        if(response.status){
            return successResponse(res, response.message);
        }else{
            return errorResponse(res, response.message);
        }
        
    } catch (error) {
        next(error);
    }
}


module.exports = {
    getTrainingAPI,
    postTrainingAPI,
    putTrainingAPI,
    deleteTrainingAPI,
    getTrainingByIdAPI,
    updateSettings,
    getPaginatedTrainings,
    putTrainingStatusAPI,
};

require('dotenv').config();
const Module = require('../../model/Module');
const moduleService = require('../../services/moduleService');
const { successResponse, errorResponse, warningResponse } = require('../../util/response');

const getModuleAPI = async (req, res, next) => {
    try {
        const companyId = req.user?._id || req.userId;

        const filter = { company_id: companyId };

        // If status is present in query, add it to the filter
        if (req.query.status !== undefined) {
            filter.status = req.query.status === 'true';
        }

        const data = await Module.find(filter)//.select('name status');

        return successResponse(res, "Module fetched successfully!", data);
    } catch (error) {
        next(error);
    }
};


const postModuleAPI = async (req, res, next) => {
    try {
      const { title, description, category_id, status } = req.body;
      const user = req.user;
  
    //   //Check for existing module with same name under same company
    //   const existing = await Module.findOne({
    //     company_id: user._id,
    //     name: { $regex: new RegExp(`^${name}$`, 'i') } // case-insensitive match
    //   });
  
    //   if (existing) {
    //     return warningResponse(res, "Module with this name already exists.", {}, 409);
    //   }
    let image = '';
    if (req.file) {
        image = `${req.uploadPath}/${req.file.filename}`;
      }
  
      const module = new Module({
        company_id: user._id,
        title,
        description,
        category_id,
        status,
        image
      });




  
      await module.save();
  
      return successResponse(res, "Module created successfully!", module);
    } catch (err) {
      return errorResponse(res, "Failed to create module", err, 500);
    }
  };
  

  const putModuleAPI = async (req, res, next) => {
    try {
    
        console.log('req.body', req.body);
        const { title, description, category_id, status } = req.body;
        const user = req.user;

        console.log('title', title);
      const module = await Module.findOne({ company_id: user._id, _id: req.params.id });
      if (!module) {
        return warningResponse(res, "Module not found.", {}, 404);
      }

  
      module.title = title;
      module.description = description;
      module.category_id = category_id;
      module.status = 'active';

    if (req.file) {
        module.image = `${req.uploadPath}/${req.file.filename}`;
    }
      await module.save();
  
      return successResponse(res, "Module updated successfully!", module);
    } catch (err) {
        console.log('err', err)
      return errorResponse(res, "Failed to update module", err, 500);
    }
  };
  
const getModuleByIdAPI = async (req, res, next) => {
    try {
        const companyId = req.user?._id || req.userId;
        const data = await Module.findOne({ company_id: companyId, _id: req.params.id });
        return successResponse(res, "Module fetched successfully!", data);
    } catch (error) {
        next(error);
    }
};

const createOrUpdateCard = async (req, res, next) => {
    try {
        const response = await moduleService.createOrUpdateCard(req);
        console.log(response);
        if(response['status']){
            return successResponse(res, response['message'], response['cards']);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const deleteCard = async (req, res, next) => {
    try {
        const response = await moduleService.deleteCard(req);
        console.log(response);
        if(response['status']){
            return successResponse(res, response['message'], response['cards']);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const updateCardContentDocuments = async (req, res, next) => {
    try {
        const response = await moduleService.updateCardContentDocuments(req);
        console.log(response);
        if(response['status']){
            return successResponse(res, response['message'], response['data']);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const updateCardContentYoutubeVideo = async (req, res, next) => {
    try {
        const response = await moduleService.updateCardContentYoutubeVideo(req);
        console.log(response);
        if(response['status']){
            return successResponse(res, response['message'], response['data']);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const updateSettings = async (req, res, next) => {
    try {
        const response = await moduleService.updateSettings(req);
        if(response['status']){
            return successResponse(res, response['message'], response['data']);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const getPaginatedModules = async (req, res, next) => {
    try {
        const response = await moduleService.getPaginatedModules(req, res);
        if(response['status']){
            return successResponse(res, response['message'], response);
        }else{
            return errorResponse(res, response['message']);
        }
        
    } catch (error) {
        next(error);
    }
}

const deleteModuleAPI = async (req, res, next) => {
    try {
        const response = await moduleService.deleteModule(req);
        if(response.status){
            return successResponse(res, response.message);
        }else{
            return errorResponse(res, response.message);
        }
        
    } catch (error) {
        next(error);
    }
}

const updateCardContentScormContent = async (req, res, next) => {
    try {
        const response = await moduleService.updateCardContentDocuments(req);
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
    getModuleAPI,
    postModuleAPI,
    putModuleAPI,
    deleteModuleAPI,
    getModuleByIdAPI,
    createOrUpdateCard,
    deleteCard,
    updateCardContentDocuments,
    updateCardContentYoutubeVideo,
    updateSettings,
    getPaginatedModules,
    updateCardContentScormContent
};

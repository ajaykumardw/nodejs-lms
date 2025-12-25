require('dotenv').config();
const Module = require('../../model/Module');
const AppConfig = require('../../model/AppConfig');
const { successResponse, errorResponse, warningResponse } = require('../../util/response');
const ContentFolder = require('../../model/ContentFolder');

// const getModuleAPI = async (req, res, next) => {
//     try {
//         const companyId = req.user?._id || req.userId;

//         const filter = { company_id: companyId };

//         // If status is present in query, add it to the filter
//         if (req.query.status !== undefined) {
//             filter.status = req.query.status === 'true';
//         }

//         const data = await Module.find(filter)//.select('name status');

//         return successResponse(res, "Module fetched successfully!", data);
//     } catch (error) {
//         next(error);
//     }
// };


// const postModuleAPI = async (req, res, next) => {
//     try {
//       const { title, description, category_id } = req.body;
//       const user = req.user;

//     //   //Check for existing module with same name under same company
//     //   const existing = await Module.findOne({
//     //     company_id: user._id,
//     //     name: { $regex: new RegExp(`^${name}$`, 'i') } // case-insensitive match
//     //   });

//     //   if (existing) {
//     //     return warningResponse(res, "Module with this name already exists.", {}, 409);
//     //   }
//     let image = '';
//     if (req.file) {
//         image = `${req.uploadPath}/${req.file.filename}`;
//       }

//       const module = new Module({
//         company_id: user._id,
//         title,
//         description,
//         category_id,
//         status : 'draft',
//         image
//       });





//       await module.save();

//       return successResponse(res, "Module created successfully!", module);
//     } catch (err) {
//       return errorResponse(res, "Failed to create module", err, 500);
//     }
//   };


//   const putModuleAPI = async (req, res, next) => {
//     try {

//         console.log('req.body', req.body);
//         const { title, description, category_id, status } = req.body;
//         const user = req.user;

//         console.log('title', title);
//       const module = await Module.findOne({ company_id: user._id, _id: req.params.id });
//       if (!module) {
//         return warningResponse(res, "Module not found.", {}, 404);
//       }


//       module.title = title;
//       module.description = description;
//       module.category_id = category_id;
//     //   module.status = 'draft';

//     if (req.file) {
//         module.image = `${req.uploadPath}/${req.file.filename}`;
//     }
//       await module.save();

//       return successResponse(res, "Module updated successfully!", module);
//     } catch (err) {
//         console.log('err', err)
//       return errorResponse(res, "Failed to update module", err, 500);
//     }
//   };

// const getModuleByIdAPI = async (req, res, next) => {
//     try {
//         const companyId = req.user?._id || req.userId;
//         const data = await Module.findOne({ company_id: companyId, _id: req.params.id });
//         return successResponse(res, "Module fetched successfully!", data);
//     } catch (error) {
//         next(error);
//     }
// };

// const createOrUpdateCard = async (req, res, next) => {
//     try {
//         const response = await moduleService.createOrUpdateCard(req);
//         console.log(response);
//         if(response['status']){
//             return successResponse(res, response['message'], response['cards']);
//         }else{
//             return errorResponse(res, response['message']);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const deleteCard = async (req, res, next) => {
//     try {
//         const response = await moduleService.deleteCard(req);
//         console.log(response);
//         if(response['status']){
//             return successResponse(res, response['message'], response['cards']);
//         }else{
//             return errorResponse(res, response['message']);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const updateCardContentDocuments = async (req, res, next) => {
//     try {
//         const response = await moduleService.updateCardContentDocuments(req);
//         console.log(response);
//         if(response['status']){
//             return successResponse(res, response['message'], response['data']);
//         }else{
//             return errorResponse(res, response['message']);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const updateCardContentYoutubeVideo = async (req, res, next) => {
//     try {
//         const response = await moduleService.updateCardContentYoutubeVideo(req);
//         console.log(response);
//         if(response['status']){
//             return successResponse(res, response['message'], response['data']);
//         }else{
//             return errorResponse(res, response['message']);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const updateSettings = async (req, res, next) => {
//     try {
//         const response = await moduleService.updateSettings(req);
//         if(response['status']){
//             return successResponse(res, response['message'], response['data']);
//         }else{
//             return errorResponse(res, response['message']);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const getPaginatedModules = async (req, res, next) => {
//     try {
//         const response = await moduleService.getPaginatedModules(req, res);
//         if(response['status']){
//             return successResponse(res, response['message'], response);
//         }else{
//             return errorResponse(res, response['message']);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const deleteModuleAPI = async (req, res, next) => {
//     try {
//         const response = await moduleService.deleteModule(req);
//         if(response.status){
//             return successResponse(res, response.message);
//         }else{
//             return errorResponse(res, response.message);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const updateCardContentScormContent = async (req, res, next) => {
//     try {
//         const response = await moduleService.updateCardContentDocuments(req);
//         if(response.status){
//             return successResponse(res, response.message, response['data']);
//         }else{
//             return errorResponse(res, response.message);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const putModuleStatusAPI = async (req, res, next) => {
//     try {
//         const response = await moduleService.updateStatus(req);
//         if(response.status){
//             return successResponse(res, response.message);
//         }else{
//             return errorResponse(res, response.message);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// const updateCardContentQuizContent = async (req, res, next) => {
//     try {
//         const response = await moduleService.updateCardContentQuizContent(req);
//         if(response.status){
//             return successResponse(res, response.message);
//         }else{
//             return errorResponse(res, response.message);
//         }

//     } catch (error) {
//         next(error);
//     }
// }

// module.exports = {
//     getModuleAPI,
//     postModuleAPI,
//     putModuleAPI,
//     deleteModuleAPI,
//     getModuleByIdAPI,
//     createOrUpdateCard,
//     deleteCard,
//     updateCardContentDocuments,
//     updateCardContentYoutubeVideo,
//     updateSettings,
//     getPaginatedModules,
//     updateCardContentScormContent,
//     putModuleStatusAPI,
//     updateCardContentQuizContent
// };



exports.getModuleDataAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const cId = req.params.cId;

        const contentFolder = await ContentFolder.findById(cId);

        if (!contentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404);
        }

        const module = await Module.find({ created_by: userId, content_folder_id: cId })

        if (!module) {
            return errorResponse(res, "Module does not exist", {}, 404)
        }

        return successResponse(res, "Module data fetched successfully", module)

    } catch (error) {
        next(error)
    }
}

exports.getModuleCreateAPI = async (req, res, next) => {
    try {

        let data = {};

        const appConfig = await AppConfig.findOne({ type: "module_type" })

        if (!appConfig) {
            return errorResponse(res, "App config does not exist", {}, 404)
        }

        data.appConfig = appConfig?.module_data;

        return successResponse(res, "App Config fetched successfully", data)

    } catch (error) {
        next(error)
    }
}

exports.postModuleFormAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const moduleTypeId = req.params.id;
        const cId = req.params.cId;

        const contentFolder = await ContentFolder.findById(cId);
        if (!contentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404);
        }

        const appConfig = await AppConfig.findOne({ 'module_data._id': moduleTypeId });
        if (!appConfig) {
            return errorResponse(res, "Module type does not exist", {}, 404);
        }

        const matchedModule = appConfig.module_data.find(
            item => item._id.toString() === moduleTypeId.toString()
        );
        if (!matchedModule) {
            return errorResponse(res, "Module type not found in appConfig", {}, 404);
        }

        const { title, description, live_session_type } = req.body;

        if (!req.file || !req.file.filename) {
            return errorResponse(res, "Image file is required", {}, 400);
        }

        const imageName = req.file.filename;

        // Base module data
        const moduleData = {
            content_folder_id: cId,
            module_type_id: moduleTypeId,
            title,
            description,
            image_url: imageName,
            created_by: userId,
        };

        // Add live_session_id if the type matches
        if (moduleTypeId.toString() === '688219557b6953e899cb57d3') {
            moduleData.live_session_id = live_session_type;
        }

        const module = new Module(moduleData);
        await module.save();

        return successResponse(res, "Module saved successfully!");
    } catch (error) {
        next(error);
    }
};

exports.editModuleFormAPI = async (req, res, next) => {
    try {


        const userId = req.userId;
        const cId = req.params.cId;
        const id = req.params.id;

        const contentFolder = await ContentFolder.findById(cId);
        if (!contentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404);
        }

        const modules = await Module.findOne({ created_by: userId, content_folder_id: cId, _id: id })

        if (!modules) {
            return errorResponse(res, "Module does not exist")
        }

        return successResponse(res, "Module fetched successfully", modules)

    } catch (error) {
        next(error)
    }
}

exports.updateModuleFormAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;
        const cId = req.params.cId;

        const contentFolder = await ContentFolder.findById(cId);

        if (!contentFolder) {
            return errorResponse(res, "Content folder does not exist", {}, 404);
        }

        const modules = await Module.findOne({ created_by: userId, content_folder_id: cId, _id: id })

        if (!modules) {
            return errorResponse(res, "Module does not exist")
        }

        const { title, description } = req.body;

        const image = req?.file?.filename ?? modules?.image_url ?? '';

        await Module.findOneAndUpdate({ created_by: userId, _id: id, content_folder_id: cId }, {
            $set: {
                title,
                description,
                image_url: image,
                created_by: userId
            }
        })

        return successResponse(res, "Module updated successfully")

    } catch (error) {
        next(error)
    }
}
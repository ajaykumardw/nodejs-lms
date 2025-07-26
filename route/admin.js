const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const validation = require('../validation/Adminvalidation');
const ModuleValidation = require('../validation/ModuleValidation');
const roleController = require('../controller/Admin/RoleAPIController');
const packageAPIController = require('../controller/Admin/PackageAPIController');
const permissionController = require('../controller/Admin/PermissionAPIController');
const permissionModuleController = require('../controller/Admin/PermissionModuleAPIController');
const packageTypeController = require('../controller/Admin/PackageTypeAPIController');
const companyAPIController = require('../controller/Admin/CompanyAPIController');
const designationAPIController = require('../controller/Admin/DesignationAPIController');
const ParticipationTypeAPIController = require('../controller/Admin/ParticipationTypeAPIController');
const UserAPIController = require('../controller/Admin/UserAPIController');
const CategoryController = require('../controller/Admin/CategoryController');
const ModuleController = require('../controller/Company/ModuleController');
const TrainingController = require('../controller/Company/TrainingControllerAPI');

const createUpload = require('../util/upload');

const allowedTypesDocument = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

const { middleware: uploadDocument } = createUpload(
  allowedTypesDocument, // allowed types
  'uploads/module/content' // directory inside /public/
);

const { middleware: uploadVideo } = createUpload(
  ['video/mp4', 'video/webm'], // allowed types
  'uploads/module/content' // directory inside /public/
);

const { middleware: imageUpload } = createUpload(
  ['image/jpeg', 'image/png', 'image/jpg'], // allowed types
  'uploads/images' // directory inside /public/
);

const { middleware: uploadScorm } = createUpload(
  ['application/zip', 'application/x-zip-compressed'],
  'uploads/module/content/scorm', 1024
);

//routes for roles
router.get('/role', isAuth, roleController.getRoleAPI);
router.post('/role', isAuth, validation.postRoleValidation, roleController.postRoleAPI);
router.get('/role/create', isAuth, roleController.createDataAPI);
router.post('/role/user', isAuth, validation.roleUserPostValidation, roleController.postRoleUserAPI)
router.put('/role/:roleId', isAuth, validation.postRoleValidation, roleController.putRole);

//routes for permission
router.get('/permission-module', isAuth, permissionModuleController.getPermissionModuleAPI);
router.post('/permission-module', isAuth, validation.postPermissionModule, permissionModuleController.postPermissionModuleAPI);
router.put('/permission-module/:permissionId', isAuth, validation.postPermissionModule, permissionModuleController.putPermissionModuleAPI);

router.get('/permission', isAuth, permissionController.getPermission);
router.post('/permission', isAuth, validation.postPermission, permissionController.postPermission);
router.get('/permission/edit/:permissionId', isAuth, permissionController.editPermission);
router.get('/permission/create', isAuth, permissionController.createPermission);
router.put('/permission/:permissionModuleId/:permissionId', isAuth, validation.postPermission, permissionController.putPermission)

//routes for package type
router.get('/package-type', isAuth, packageTypeController.getPackageTypeAPI);
router.post('/package-type', isAuth, validation.packageTypePostValidation, packageTypeController.postPackageType);
router.put('/package-type/:packageTypeId', isAuth, validation.packageTypePostValidation, packageTypeController.updatePackageTypeAPI);

//routes for package
router.get('/package', isAuth, packageAPIController.getPackageAPI);
router.get('/package/create', isAuth, packageAPIController.createPackageAPI);
router.post('/package', isAuth, validation.postPackageValidation, packageAPIController.postPackageAPI);
router.put('/package/:packageTypeId/:packageId', isAuth, packageAPIController.putPackageAPI)

//routes for company
router.get('/company', isAuth, companyAPIController.getCompanyIndexAPI);
router.post('/company', isAuth, validation.postCompany, imageUpload('photo'), companyAPIController.postCompanyAPI);
router.get('/company/create', isAuth, companyAPIController.createCompanyAPI);
router.get('/company/:id/edit', isAuth, companyAPIController.editCompanyAPI);
router.put('/company/:id', isAuth, imageUpload('photo'), companyAPIController.putCompanyAPI);
router.get('/company/email/check/:email/:id', isAuth, companyAPIController.checkEmailCompanyAPI)


router.post('/designation', isAuth, designationAPIController.postDesignationAPI);
router.get('/designations', isAuth, designationAPIController.getDesignationAPI);
router.put('/designation/:id', isAuth, designationAPIController.putDesignationAPI)
router.delete('/designation/:id', isAuth, designationAPIController.deleteDesignationAPI)

router.post('/participation_type', isAuth, uploadVideo('file'), ParticipationTypeAPIController.postAPI);
router.get('/participation_types', isAuth, ParticipationTypeAPIController.getAPI);
router.put('/participation_type/:id', isAuth, uploadVideo('file'), ParticipationTypeAPIController.putAPI)
router.delete('/participation_type/:id', isAuth, ParticipationTypeAPIController.deleteAPI)

//user routes
router.post('/user', isAuth, uploadVideo('file'), UserAPIController.createUserAPI);
router.put('/user/:id', isAuth, validation.putUser, uploadVideo('file'), UserAPIController.updateUserAPI);
router.delete('/user/:id', isAuth, UserAPIController.deleteAPI);
router.get('/user/:id/edit', isAuth, UserAPIController.editAPI);
router.get('/user/search', isAuth, UserAPIController.searchUserAPI);
router.put('/user/update-password/:id', isAuth, uploadVideo('file'), UserAPIController.updatePasswordAPI);
router.put('/user/attach/empcode/:id', isAuth, uploadVideo('file'), UserAPIController.attachNewUserCodeAPI);
router.put('/user/mark/active/empcode/:id', isAuth, uploadVideo('file'), UserAPIController.markActiveUserCodeAPI);
router.put('/user/status/update/:id', isAuth, uploadVideo('file'), UserAPIController.updateStatusAPI);
router.post('/users/import', isAuth, uploadVideo('file'), UserAPIController.importAPI);
router.get('/users/stats', isAuth, UserAPIController.getUserStatsAPI);

router.get('/countries', isAuth, companyAPIController.getCountryAPI);

router.get('/role/allow/permission', isAuth, permissionController.getPermAllowAPI);

router.get('/categories', isAuth, CategoryController.getCategoryAPI);
router.post('/category', isAuth, CategoryController.postCategoryAPI);
router.put('/category/:id', isAuth, CategoryController.putCategoryAPI);
router.delete('/category/:id', isAuth, CategoryController.deleteCategoryAPI);

// router.get('/modules', isAuth, ModuleController.getModuleAPI);
// router.get('/modules/list', isAuth, ModuleController.getPaginatedModules);
// router.get('/module/:id', isAuth, ModuleController.getModuleByIdAPI);
// router.put('/module/:id', isAuth, ModuleValidation.putModuleAPI, imageUpload('file'), ModuleController.putModuleAPI);
// router.put('/module/update/status/:id', isAuth, ModuleValidation.putModuleStatusAPI, imageUpload('file'), ModuleController.putModuleStatusAPI);
// router.delete('/module/:id', isAuth, ModuleController.deleteModuleAPI);
// router.post('/module', isAuth, ModuleValidation.postModuleAPI, imageUpload('file'), ModuleController.postModuleAPI);
// router.post('/module/:id/cards', isAuth, uploadDocument('file'), ModuleController.createOrUpdateCard);
// router.delete('/module/:id/card/:card_id', isAuth, ModuleController.deleteCard);
// router.put('/module/:id/card/documents/:card_id', isAuth, uploadDocument('file'), ModuleController.updateCardContentDocuments);
// router.put('/module/:id/card/videos/:card_id', isAuth, uploadVideo('file'), ModuleController.updateCardContentDocuments);
// router.put('/module/:id/card/youtubeVideos/:card_id', isAuth, uploadVideo('file'), ModuleController.updateCardContentYoutubeVideo);
// router.put('/module/:id/card/scorm/:card_id', isAuth, uploadScorm('file'), ModuleController.updateCardContentScormContent);
// router.put('/module/:id/card/quiz/:card_id', isAuth, ModuleController.updateCardContentQuizContent);
// router.put('/module/setting/update/:id', isAuth, uploadVideo('file'), ModuleController.updateSettings);


// router.get('/trainings/list', isAuth, TrainingController.getPaginatedTrainings);
// router.get('/training/:id', isAuth, TrainingController.getTrainingByIdAPI);
// router.put('/training/:id', isAuth, ModuleValidation.putModuleAPI, imageUpload('file'), TrainingController.putTrainingAPI);
// router.put('/training/update/status/:id', isAuth, ModuleValidation.putModuleStatusAPI, imageUpload('file'), TrainingController.putTrainingStatusAPI);
// router.delete('/training/:id', isAuth, TrainingController.deleteTrainingAPI);
// router.post('/training', isAuth, ModuleValidation.postModuleAPI, imageUpload('file'), TrainingController.postTrainingAPI);

module.exports = router;
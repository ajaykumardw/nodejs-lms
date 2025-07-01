const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const languageController = require('../controller/Company/LanguageController');
const zoneController = require('../controller/Company/ZoneAPIController');
const regionController = require('../controller/Company/RegionAPIController');
const appMenuController = require('../controller/Company/AppMenuController');
const companyValidation = require('../validation/Companyvalidation')
const branchController = require('../controller/Company/BranchAPIController');
const roleController = require('../controller/Company/RoleAPIController')
const departmentController = require('../controller/Company/DepartmentAPIController');
const channelController = require('../controller/Company/ChannelControllerAPI')

//This route is for zone
router.get('/zone', isAuth, zoneController.getZoneAPIData);
router.post('/zone', isAuth, zoneController.postZoneAPI);
router.put('/zone/:id', isAuth, zoneController.putZoneAPI);


//This route is for region
router.get('/region', isAuth, regionController.getRegionAPI);
router.get('/region/create', isAuth, regionController.createRegionAPI);
router.post('/region', isAuth, regionController.postRegionAPI);
router.post('/data/region', isAuth, regionController.postRegionDataAPI);
router.put('/data/region/:id', isAuth, regionController.putRegionData);

//This route is for language
router.get('/language', isAuth, languageController.getLanguageAPI);
router.post('/language', isAuth, companyValidation.postLanguageAPI, languageController.postLanguageAPI);
router.put('/language/:id', isAuth, companyValidation.postLanguageAPI, languageController.putLanguageAPI);
router.get('/language/menu', isAuth, languageController.getMenuAPI);

//This route is for label
router.get('/terminology', isAuth, appMenuController.getAppMenuAPI);
router.get('/terminology/label/create', isAuth, appMenuController.createLabelAPI);
router.post('/terminology/label', isAuth, appMenuController.postLabelAPI);
router.post('/terminology/app/menu', isAuth, appMenuController.postAppMenuAPI);
router.get('/menu/list', isAuth, appMenuController.getMenuListingAPI)

router.get('/app/menu/label/listing/:sn', isAuth, appMenuController.getAppMenuCompanyListAPI);
router.post('/app/menu/label/listing/:sn', isAuth, appMenuController.postCompanyMenuListAPI);

//This route is for branch
router.get('/branch', isAuth, branchController.getBranchAPI);
router.post('/branch/data', isAuth, branchController.postBranchAPI)
router.put('/branch/data/:branchId', isAuth, branchController.putBranchUpdateAPI);
router.post('/branch/unique/check', isAuth, branchController.postBranchUniqueCheck)
router.post('/app/branch/region/:regionId', isAuth, branchController.postRegionBranchAPI)

//This route is for department
router.get('/department', isAuth, departmentController.getDepartmentAPI)
router.post('/department', isAuth, departmentController.postDepartmentAPI)
router.put('/department/:departmentId', isAuth, departmentController.putDepartmentAPI)

//This route is for channel
router.get('/channel', isAuth, channelController.getChannelAPI);
router.post('/channel', isAuth, channelController.postChannelAPI)
router.put('/channel/:channelId', isAuth, channelController.putChannelAPI)

//This route is for role
router.get('/role', isAuth, roleController.getRoleAPI)
router.get('/role/create', isAuth, roleController.createRoleAPI);
router.post('/role', isAuth, roleController.postRoleAPI)
router.put('/role/:roleId', isAuth, roleController.putRoleAPI)

module.exports = router;
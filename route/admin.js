const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const validation = require('../validation/validation');
const roleController = require('../controller/Admin/RoleAPIController');
const packageAPIController = require('../controller/Admin/PackageAPIController');
const permissionController = require('../controller/Admin/PermissionAPIController');
const permissionModuleController = require('../controller/Admin/PermissionModuleAPIController');
const packageTypeController = require('../controller/Admin/PackageTypeAPIController');
const companyAPIController = require('../controller/Admin/CompanyAPIController');

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
router.post('/company', isAuth, validation.postCompany, companyAPIController.postCompanyAPI);
router.get('/company/create', isAuth, companyAPIController.createCompanyAPI);
router.get('/company/email/check/:email', isAuth, companyAPIController.checkEmailCompanyAPI)

module.exports = router;
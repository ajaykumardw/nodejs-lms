const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const validation = require('../validation/validation');
const roleController = require('../controller/RoleAPIController');
const packageAPIController = require('../controller/PackageAPIController');
const permissionController = require('../controller/PermissionAPIController');
const permissionModuleController = require('../controller/PermissionModuleAPIController');
const packageTypeController = require('../controller/PackageTypeAPIController');

//routes for roles
router.get('/role', isAuth, roleController.getRoleAPI);
router.post('/role', isAuth, validation.postRoleValidation, roleController.postRoleAPI);
router.post('/role/user', isAuth, validation.roleUserPostValidation, roleController.postRoleUserAPI)

//routes for permission
router.get('/permission-module', isAuth, permissionModuleController.getPermissionModuleAPI);
router.post('/permission-module', isAuth, validation.postPermissionModule, permissionModuleController.postPermissionModuleAPI);
router.put('/permission-module/:permissionId', isAuth, validation.postPermissionModule, permissionModuleController.putPermissionModuleAPI);

router.get('/permission', isAuth, permissionController.getPermission);
router.post('/permission', isAuth, validation.postPermission, permissionController.postPermission);
router.get('/permission/create', isAuth, permissionController.createPermission);
router.put('/permission/:permissionModuleId/:permissionId', isAuth, validation.postPermission, permissionController.putPermission)

//routes for package type
router.get('/package-type', isAuth, packageTypeController.getPackageTypeAPI);
router.post('/package-type', isAuth, validation.packageTypePostValidation, packageTypeController.postPackageType)
router.put('/package-type/:packageTypeId', isAuth, validation.packageTypePostValidation, packageTypeController.updatePackageTypeAPI);

//routes for package
router.get('/package', isAuth, packageAPIController.getPackageAPI);
router.get('/package/create', isAuth, packageAPIController.createPackageAPI);
router.post('/package', isAuth, validation.postPackageValidation, packageAPIController.postPackageAPI);
router.put('/package/:packageTypeId/:packageId', isAuth, packageAPIController.putPackageAPI)

module.exports = router;
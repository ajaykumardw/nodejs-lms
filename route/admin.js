const express = require('express');
const router = express.Router();
const { body } = require('express-validator')
const isAuth = require('../middleware/is-auth')
const validation = require('../validation/validation');
const adminController = require('../controller/AdminAPIController');

router.get('/role', isAuth, adminController.getRoleAPI);
router.post('/role', isAuth, validation.postRoleValidation, adminController.postRoleAPI);
router.post('/role/user', isAuth, validation.roleUserPostValidation, adminController.postRoleUserAPI)



module.exports = router;
const express = require('express');
const router = express.Router();
const { body } = require('express-validator')
const adminController = require('../controller/AdminAPIController');

const isAuth = require('../middleware/is-auth')

router.get('/role', isAuth, adminController.getRoleAPI);
router.post('/role', isAuth, [
    body('company_id')
        .notEmpty().withMessage('Company ID is required')
        .isMongoId().withMessage('Invalid Company ID format'),
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 3, max: 20 }).withMessage('Role can be of min 3 and max 20 length'),
    body('description').notEmpty().withMessage('Description is required').isLength({ min: 4, max: 1000 }).withMessage('Description is min of 4 and max of 1000 length'),
    body('created_by').notEmpty().withMessage('Created by is required').isMongoId().withMessage("It should be a unique id")
], adminController.postRoleAPI);

router.post('/role/user', isAuth, [
    body('user_id').notEmpty().withMessage("User id is required")
        .isMongoId().withMessage('User id should be of object type id'),
    body('role_id').notEmpty().withMessage("Role id is required")
        .isMongoId().withMessage('Role id should be of object type id'),
], adminController.postRoleUserAPI)



module.exports = router;
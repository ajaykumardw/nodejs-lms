const { body, check } = require('express-validator');

exports.loginPostValidation = [
    check('email').isEmail().withMessage("Please enter a valid email").normalizeEmail(),
    body('password').trim().isLength({ min: 6, max: 32 }).withMessage("Password should be min of 6 digit and max 32 digit")

];

exports.postRoleValidation = [
    body('company_id')
        .notEmpty().withMessage('Company ID is required')
        .isMongoId().withMessage('Invalid Company ID format'),
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 3, max: 20 }).withMessage('Role can be of min 3 and max 20 length'),
    body('description').notEmpty().withMessage('Description is required').isLength({ min: 4, max: 1000 }).withMessage('Description is min of 4 and max of 1000 length'),
    body('created_by').notEmpty().withMessage('Created by is required').isMongoId().withMessage("It should be a unique id")
];

exports.roleUserPostValidation = [
    body('user_id').notEmpty().withMessage("User id is required")
        .isMongoId().withMessage('User id should be of object type id'),
    body('role_id').notEmpty().withMessage("Role id is required")
        .isMongoId().withMessage('Role id should be of object type id'),
];
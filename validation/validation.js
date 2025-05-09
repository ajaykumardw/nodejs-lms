const { body, check } = require('express-validator');

exports.loginPostValidation = [
    check('email').isEmail().withMessage("Please enter a valid email").normalizeEmail(),
    body('password').trim().isLength({ min: 6, max: 32 }).withMessage("Password should be min of 6 digit and max 32 digit")

];

exports.postRoleValidation = [
    body('status')
        .isBoolean().withMessage('Status should be true or false')
        .not().isEmpty().withMessage('Status is required'),
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 3, max: 20 }).withMessage('Role can be of min 3 and max 20 length'),
    body('description').notEmpty().withMessage('Description is required').isLength({ min: 4, max: 1000 }).withMessage('Description is min of 4 and max of 1000 length'),
];

exports.roleUserPostValidation = [
    body('user_id').notEmpty().withMessage("User id is required")
        .isMongoId().withMessage('User id should be of object type id'),
    body('role_id').notEmpty().withMessage("Role id is required")
        .isMongoId().withMessage('Role id should be of object type id'),
];

exports.permissionPostValidation = [

];

exports.packageTypePostValidation = [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 4, max: 25 }).withMessage("Package Type min length should be 4 and max 25"),
    body('status').notEmpty().withMessage("Status is required").isBoolean().withMessage("Status should be true or false")
];

exports.postPackageValidation = [
    body('name').notEmpty().withMessage("Name is required").isLength({ max: 255 }).withMessage("Name can be max of 255 length"),
    body('description').notEmpty().withMessage("Description is required").isLength({ max: 65535 }).withMessage("Description can be maximum 65535"),
    body('packagetype').notEmpty().withMessage('Package type is required').isMongoId().withMessage("Package Type should be object Id"),
    body('status').notEmpty().withMessage("Status is required").isBoolean().withMessage("Status should be of boolean type"),
    body('amount')
        .notEmpty().withMessage("Amount is required")
        .isNumeric().withMessage("Amount must be a number")
        .custom((value) => {
            if (Number(value) > 1_000_000_000_000) {
                throw new Error("Amount is too large");
            }
            return true;
        }),
]

exports.postPermissionModule = [
    body('name').notEmpty().withMessage("Name is required").isLength({ max: 255 }).withMessage("Permission module can be max of 255 length"),
    body('status').notEmpty().withMessage("Status is required").isBoolean().withMessage("It should be of true or false type")
]

exports.postPermission = [
    body('name').notEmpty().withMessage("Name is required").isLength({ max: 255 }).withMessage("Name max length should be 255"),
    body('status').notEmpty().withMessage("Status is required").isBoolean().withMessage("Status should be boolean"),
    body('permissionmodule').notEmpty().withMessage("Permission module is required")
];
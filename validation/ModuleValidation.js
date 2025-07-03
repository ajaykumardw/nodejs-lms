const { body, check } = require('express-validator')

exports.postModuleAPI = [
    body('title').notEmpty().withMessage('Title is required').isLength({ max: 400 }).withMessage("Title can be maximum of 400 length"),
    body('description').notEmpty().withMessage('Description is required'),
    body('category_id').notEmpty().withMessage('Category is required'),
    body('status').notEmpty().withMessage('Status is required'),
]

exports.putModuleAPI = [
    body('title').notEmpty().withMessage('Title is required').isLength({ max: 400 }).withMessage("Title can be maximum of 400 length"),
    body('description').notEmpty().withMessage('Description is required'),
    body('category_id').notEmpty().withMessage('Category is required'),
]

exports.putModuleStatusAPI = [
    body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['draft', 'published'])
    .withMessage('Status must be either "draft" or "published"'),
]

exports.postRegionAPI = [
    body('name').notEmpty().withMessage('Name is required').isLength({ max: 255 }).withMessage("Name can be maximum of 255 length"),
    body('zone_id').notEmpty().withMessage("Zone is required")
]
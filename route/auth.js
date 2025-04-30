const express = require('express');
const router = express.Router();
const { body, check } = require('express-validator');
const authController = require('../controller/AuthAPIController');

router.post('/login', [
    check('email').isEmail().withMessage("Please enter a valid email").normalizeEmail(),
    body('password').trim().isLength({ min: 6, max: 32 }).withMessage("Password should be min of 6 digit and max 32 digit")

], authController.postAPILogIn);

module.exports = router;

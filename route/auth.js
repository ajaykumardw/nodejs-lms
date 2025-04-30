const express = require('express');
const router = express.Router();
const validation = require('../validation/validation');
const authController = require('../controller/AuthAPIController');

router.post('/login', validation.loginPostValidation, authController.postAPILogIn);

module.exports = router;

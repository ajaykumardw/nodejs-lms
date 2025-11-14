const express = require('express')
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const programController = require('../controller/User/MyCourseController');

router.get('/program/data', isAuth, programController.getCourseAPIController);

module.exports = router;
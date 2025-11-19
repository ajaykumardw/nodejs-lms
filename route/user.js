const express = require('express')
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const programController = require('../controller/User/MyCourseController');
const activityController = require("../controller/User/ActivityControllerAPI")
const moduleController = require('../controller/User/ModuleControllerAPI')

router.get('/program/data', isAuth, programController.getCourseAPIController);

router.get('/module/data/:id', isAuth, moduleController.getModuleAPIController);

router.get('/activity/data/:id', isAuth, activityController.getActivityData);

router.get('/activity/fetch/data/:id', isAuth, activityController.getFetchActivity);

module.exports = router;
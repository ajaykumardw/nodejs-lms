const express = require('express')
const router = express.Router();
const isAuth = require('../middleware/is-auth')
const programController = require('../controller/User/MyCourseController');
const moduleController = require('../controller/User/ModuleControllerAPI');
const activityController = require("../controller/User/ActivityControllerAPI")
const selfEnrollController = require("../controller/User/SelfEnrollmentAPIController")
const userSurveryReportController = require("../controller/User/UserSurveyReportController")

router.get('/program/data', isAuth, programController.getCourseAPIController);

router.get('/module/data/:id', isAuth, moduleController.getModuleAPIController);

router.get('/activity/data/:id', isAuth, activityController.getActivityData);
router.get('/activity/fetch/data/:id', isAuth, activityController.getFetchActivity);
router.get('/activity/new/attempt/:moduleId/:contentFolderId/:activityId/:moduleTypeId', isAuth, activityController.getNewAttemptController)
router.post('/activity/end/attempt', activityController.getEndAttemptController);
router.post('/activity/set/report/data/:moduleId/:contentFolderId/:activityId/:moduleTypeId', isAuth, activityController.postReportController);
router.post('/activity/set/scorm/data/:moduleId/:contentFolderId/:activityId/:moduleTypeId', isAuth, activityController.postScormData);
router.post('/activity/insert/report/data/:moduleId/:contentFolderId/:activityId/:moduleTypeId', isAuth, activityController.postInsertReportController);
router.get("/activity/attempt/check/:moduleId/:contentFolderId/:activityId/:moduleTypeId", isAuth, activityController.getAttemptCheck)

router.get("/module/survey/data/:moduleId", isAuth, activityController.getModuleActivityData);

router.get("/survey/report/:moduleId", isAuth, userSurveryReportController.getSurveyDetail)

router.post("/survey/report/:moduleId", isAuth, userSurveryReportController.postSuveyDetail)

router.get("/self/enroll/data", isAuth, selfEnrollController.getSelfEnrollData)
router.get("/self/enroll/data/:moduleId", isAuth, selfEnrollController.getInsertSelfEnrollData)

module.exports = router;
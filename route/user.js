const express = require('express')
const router = express.Router()
const isAuth = require('../middleware/is-auth')
const programController = require('../controller/User/MyCourseController')
const moduleController = require('../controller/User/ModuleControllerAPI')
const activityController = require('../controller/User/ActivityControllerAPI')
const selfEnrollController = require('../controller/User/SelfEnrollmentAPIController')
const dashboardController = require('../controller/User/DashboardAPIController')
const certificateController = require('../controller/User/CertificateControllerAPI')
const contestBadgeController = require('../controller/User/ContestBadgeAPIController')
const userSurveryReportController = require('../controller/User/UserSurveyReportController')
const myProgramAPIController = require('../controller/User/MyProgramAPIController.')

router.get('/program/data', isAuth, programController.getCourseAPIController)

router.get('/module/data/:id', isAuth, moduleController.getModuleAPIController)

//This is the API for activity
router.get('/activity/data/:id', isAuth, activityController.getActivityData)
router.get(
  '/activity/fetch/data/:id',
  isAuth,
  activityController.getFetchActivity
)
router.get(
  '/activity/new/attempt/:moduleId/:contentFolderId/:activityId/:moduleTypeId',
  isAuth,
  activityController.getNewAttemptController
)
router.post('/activity/end/attempt', activityController.getEndAttemptController)
router.post(
  '/activity/set/report/data/:moduleId/:contentFolderId/:activityId/:moduleTypeId',
  isAuth,
  activityController.postReportController
)
router.post(
  '/activity/set/scorm/data/:moduleId/:contentFolderId/:activityId/:moduleTypeId',
  isAuth,
  activityController.postScormData
)
router.post(
  '/activity/insert/report/data/:moduleId/:contentFolderId/:activityId/:moduleTypeId',
  isAuth,
  activityController.postInsertReportController
)
router.get(
  '/activity/attempt/check/:moduleId/:contentFolderId/:activityId/:moduleTypeId',
  isAuth,
  activityController.getAttemptCheck
)

router.get(
  '/module/survey/data/:moduleId',
  isAuth,
  activityController.getModuleActivityData
)

router.get(
  '/survey/report/:moduleId',
  isAuth,
  userSurveryReportController.getSurveyDetail
)

router.post(
  '/survey/report/:moduleId',
  isAuth,
  userSurveryReportController.postSuveyDetail
)

router.get('/self/enroll/data', isAuth, selfEnrollController.getSelfEnrollData)
router.get(
  '/self/enroll/data/:moduleId',
  isAuth,
  selfEnrollController.getInsertSelfEnrollData
)

//This is the API of dashboard
router.get('/dashboard/user/data', isAuth, dashboardController.getDashboardAPI)

//This is the API of certificate
router.get(
  '/certificate/fetch/data',
  isAuth,
  certificateController.getCertificateDataAPIController
)

//This is the API of contest badge
router.get(
  '/contest-badge/data',
  isAuth,
  contestBadgeController.getContestBoardData
)

router.get(
  '/my-program/fetch/data',
  isAuth,
  myProgramAPIController.getMyProgramController
)

module.exports = router

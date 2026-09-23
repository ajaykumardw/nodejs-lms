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
const reportingManagerAPIController = require('../controller/User/ReportingManagerController')
const trainerController = require("../controller/User/TrainerAPIController")
const batchController = require("../controller/User/BatchAPIController")
const gradingController = require("../controller/User/GradingAPIController")
const attendanceController = require("../controller/User/AttendanceAPIController")
const learnerController = require("../controller/User/LearnerAPIController")
const sessionController = require("../controller/User/SessionAPIController")
const materialController = require("../controller/User/MaterialAPIController")
const preReadController = require("../controller/User/PreReadAPIController")
const postReadController = require("../controller/User/PostReadAPIController")
const noteController = require("../controller/User/NoteAPIController")

//Route for learner section
const LearnerBatchController = require("../controller/User/Learner/LearnerBatchAPIController");

const LearnerPreReadController = require("../controller/User/Learner/LearnerPreReadAPIController");

const LearnerMaterialController = require("../controller/User/Learner/LearnerMaterialAPIController");
const LearnerPostReadController = require("../controller/User/Learner/LearnerPostReadAPIController");
const LearnerAttendanceController = require("../controller/User/Learner/LearnerAttendanceAPIController");
const LearnerEnrollmentController = require("../controller/User/Learner/LearnerEnrollmentAPIController");

const { checkEnrollment } = require("../middleware/checkEnrollment");

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

router.get(
  '/my-modules/fetch/data/:slug',
  isAuth,
  myProgramAPIController.getMyModulesController
)

//This route is for reporting manager
router.get(
  '/reporting/manager',
  isAuth,
  reportingManagerAPIController.getReportingManagerController
)

//This is the route for my training
router.get("/trainer/overview", isAuth, trainerController.getTrainerOverview);
router.get("/trainer/profile", isAuth, trainerController.getTrainerProfile);
router.put("/trainer/profile", isAuth, trainerController.updateTrainerProfile);

// Batches
router.get("/trainer/batches", isAuth, batchController.getTrainerBatches);
router.get("/trainer/batches/:batchId", isAuth, batchController.getBatchDetail);

// Session detail
router.get("/trainer/batches/:batchId/sessions/:sessionId", isAuth, sessionController.getSessionDetail);

// Learners
router.get("/trainer/batches/:batchId/sessions/:sessionId/learners", isAuth, learnerController.getSessionLearners);

// Attendance
router.get("/trainer/batches/:batchId/sessions/:sessionId/attendance", isAuth, attendanceController.getSessionAttendance);
router.put("/trainer/batches/:batchId/sessions/:sessionId/attendance/:learnerId", isAuth, attendanceController.markAttendance);
router.post("/trainer/batches/:batchId/sessions/:sessionId/attendance/mark-all-present", isAuth, attendanceController.markAllPresent);
router.post("/trainer/batches/:batchId/sessions/:sessionId/attendance/bulk-save", isAuth, attendanceController.bulkSaveAttendance);

// Materials
router.get("/trainer/resource/material", isAuth, materialController.getMaterials);
router.post("/trainer/resource/material", isAuth, materialController.uploadMaterial);
router.delete("/trainer/resource/material/:materialId", isAuth, materialController.deleteMaterial);

// Pre-read
router.get("/trainer/resource/pre-read", isAuth, preReadController.getPreReadItems);
router.post("/trainer/resource/pre-read", isAuth, preReadController.createPreReadItem);
router.put("/trainer/resource/pre-read/:preReadId/toggle", isAuth, preReadController.togglePreReadDone);

// Post-read / assignments
router.get("/trainer/resource/post-read", isAuth, postReadController.getPostReadItems);
router.post("/trainer/resource/post-read", isAuth, postReadController.createPostReadItem);
router.post("/trainer/resource/post-read/:postReadId/submissions", isAuth, postReadController.submitPostRead);

// Grading
router.get("/trainer/resource/grading", isAuth, gradingController.getGradingQueue);
router.put("/trainer/resource/grading/:submissionId", isAuth, gradingController.setSubmissionScore);

// Session notes
router.get("/trainer/batches/:batchId/sessions/:sessionId/notes", isAuth, noteController.getSessionNotes);
router.put("/trainer/batches/:batchId/sessions/:sessionId/notes", isAuth, noteController.saveSessionNotes);
router.put("/trainer/batches/:batchId/sessions/:sessionId/complete", isAuth, noteController.completeSession);

// Dashboard
router.get("/learner/overview", isAuth, LearnerBatchController.getLearnerOverview);

// Enrollment — respond to a nomination. Not behind checkEnrollment, since
// a learner who hasn't confirmed yet still needs to be able to respond.
router.get("/learner/enrollments", isAuth, LearnerEnrollmentController.getMyEnrollments);
router.put("/learner/enrollments/:batchId/respond", isAuth, LearnerEnrollmentController.respondToEnrollment);

// Batches & sessions
router.get("/learner/batches", isAuth, LearnerBatchController.getMyBatches);
router.get("/learner/batches/:batchId", isAuth, checkEnrollment, LearnerBatchController.getBatchSessions);

// Attendance — read only, no write route exists
router.get(
  "/learner/batches/:batchId/sessions/:sessionId/attendance",
  isAuth,
  checkEnrollment,
  LearnerAttendanceController.getMyAttendance
);
router.get(
  "/learner/batches/:batchId/attendance",
  isAuth,
  checkEnrollment,
  LearnerAttendanceController.getMyAttendanceHistory
);

// Pre-read
router.get("/learner/resource/pre-read", isAuth, checkEnrollment, LearnerPreReadController.getPreReadItems);
router.put("/learner/resource/pre-read/:id/toggle", isAuth, checkEnrollment, LearnerPreReadController.togglePreReadDone);

// Material — read only
router.get("/learner/resource/material", isAuth, checkEnrollment, LearnerMaterialController.getMaterials);

// Post-read — read + submit (no delete/edit-after-grade route)
router.get("/learner/resource/post-read", isAuth, checkEnrollment, LearnerPostReadController.getPostReadItems);
router.post("/learner/resource/post-read/:id/submit", isAuth, checkEnrollment, LearnerPostReadController.submitPostRead);


module.exports = router

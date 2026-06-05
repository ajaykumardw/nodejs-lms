const express = require('express')

const router = express.Router()
const isAuth = require('../middleware/is-auth')
const languageController = require('../controller/Company/LanguageController')
const groupController = require('../controller/Company/GroupAPIContoller')
const zoneController = require('../controller/Company/ZoneAPIController')
const regionController = require('../controller/Company/RegionAPIController')
const appMenuController = require('../controller/Company/AppMenuController')
const companyValidation = require('../validation/Companyvalidation')
const branchController = require('../controller/Company/BranchAPIController')
const roleController = require('../controller/Company/RoleAPIController')
const departmentController = require('../controller/Company/DepartmentAPIController')
const channelController = require('../controller/Company/ChannelControllerAPI')
const certificateController = require('../controller/Company/CertificateAPIController')
const notificationController = require('../controller/Company/NotificationController')
const programController = require('../controller/Company/ProgramControllerAPI')
const quizAPIController = require('../controller/Company/QuizOptionController')
const contentFolderController = require('../controller/Company/ContentFolderControllerAPI')
const moduleController = require('../controller/Company/ModuleController')
const activityController = require('../controller/Company/ActivityController')
const programScheduleController = require('../controller/Company/ProgramScheduleController')
const quizSettingController = require('../controller/Company/QuizSettingController')
const surveySettingController = require('../controller/Company/SurveySettingController')
const moduleSettingController = require('../controller/Company/ModuleSettingController')
const reportController = require('../controller/Company/ReportAPIController')
const mailTemplateController = require('../controller/Company/MailTemplateController')
const exportCenterController = require('../controller/Company/ExportCenterAPIController')
const scheduleNotificationController = require('../controller/Company/ScheduleNotificationController')
const dashboardController = require('../controller/Company/DashboardAPIController')
const userProfileController = require('../controller/Company/UserProfileController')
const leaderboardAPIController = require('../controller/Company/LeaderboardAPIController')

const createUpload = require('../util/upload')

const certificateUpload = require('../util/uploadCertificate')

const uploadNotificationFiles = require('../util/createUploader')

const { middleware: imageUpload } = createUpload(
  [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/x-icon'
  ],
  'program_module'
)

const activityUpload = createUpload(
  [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/x-icon',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4'
  ],
  'activity',
  2000
)

const { uploadField: certificateUploads } = certificateUpload(
  ['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml'],
  {
    logoURL: 'company_logo',
    backgroundImage: 'frames',
    signature1URL: 'signature',
    signature2URL: 'signature'
  },
  [
    {
      name: 'logoURL',
      maxCount: 1
    },
    {
      name: 'backgroundImage',
      maxCount: 1
    },
    {
      name: 'signature1URL',
      maxCount: 1
    },
    {
      name: 'signature2URL',
      maxCount: 1
    }
  ]
)

//This route is for zone
router.get('/zone', isAuth, zoneController.getZoneAPIData)
router.post('/zone', isAuth, zoneController.postZoneAPI)
router.put('/zone/:id', isAuth, zoneController.putZoneAPI)

//This route is for region
router.get('/region', isAuth, regionController.getRegionAPI)
router.get('/region/create', isAuth, regionController.createRegionAPI)
router.post('/region', isAuth, regionController.postRegionAPI)
router.post('/data/region', isAuth, regionController.postRegionDataAPI)
router.put('/data/region/:id', isAuth, regionController.putRegionData)

//This route is for language
router.get('/language', isAuth, languageController.getLanguageAPI)
router.post(
  '/language',
  isAuth,
  companyValidation.postLanguageAPI,
  languageController.postLanguageAPI
)
router.put(
  '/language/:id',
  isAuth,
  companyValidation.postLanguageAPI,
  languageController.putLanguageAPI
)
router.get('/language/menu', isAuth, languageController.getMenuAPI)

//This route is for label
router.get('/terminology', isAuth, appMenuController.getAppMenuAPI)
router.get(
  '/terminology/label/create',
  isAuth,
  appMenuController.createLabelAPI
)
router.post('/terminology/label', isAuth, appMenuController.postLabelAPI)
router.post('/terminology/app/menu', isAuth, appMenuController.postAppMenuAPI)
router.get('/menu/list', isAuth, appMenuController.getMenuListingAPI)

router.get(
  '/app/menu/label/listing/:sn',
  isAuth,
  appMenuController.getAppMenuCompanyListAPI
)
router.post(
  '/app/menu/label/listing/:sn',
  isAuth,
  appMenuController.postCompanyMenuListAPI
)

//This route is for branch
router.get('/branch', isAuth, branchController.getBranchAPI)
router.post('/branch/data', isAuth, branchController.postBranchAPI)
router.put(
  '/branch/data/:branchId',
  isAuth,
  branchController.putBranchUpdateAPI
)
router.post(
  '/branch/unique/check',
  isAuth,
  branchController.postBranchUniqueCheck
)
router.post(
  '/app/branch/region/:regionId',
  isAuth,
  branchController.postRegionBranchAPI
)

//This route is for department
router.get('/department', isAuth, departmentController.getDepartmentAPI)
router.post('/department', isAuth, departmentController.postDepartmentAPI)
router.put(
  '/department/:departmentId',
  isAuth,
  departmentController.putDepartmentAPI
)

//This route is for channel
router.get('/channel', isAuth, channelController.getChannelAPI)
router.post('/channel', isAuth, channelController.postChannelAPI)
router.put('/channel/:channelId', isAuth, channelController.putChannelAPI)

//This route is for role
router.get('/role', isAuth, roleController.getRoleAPI)
router.get('/role/create', isAuth, roleController.createRoleAPI)
router.post('/role', isAuth, roleController.postRoleAPI)
router.put('/role/:roleId', isAuth, roleController.putRoleAPI)

//This route is for group
router.get('/group', isAuth, groupController.getGroupAPI)
router.post('/group', isAuth, groupController.postGroupAPI)
router.put('/group/:groupId', isAuth, groupController.putGroupAPI)
router.get(
  '/check/group/empId/:uploadData',
  isAuth,
  groupController.getCheckEmpId
)

//This route is for certificate
router.get(
  '/certificate/create',
  isAuth,
  certificateController.getCreateDataAPI
)
router.get('/certificate/data', isAuth, certificateController.getCertificateAPI)
router.post(
  '/certificate',
  isAuth,
  certificateUploads,
  certificateController.postCertificateAPI
)
router.get(
  '/certificate/edit/:id',
  isAuth,
  certificateController.getEditCertificateAPI
)
router.post(
  '/certificate/update/:id',
  isAuth,
  certificateUploads,
  certificateController.putUpdateCertificateAPI
)
router.post(
  '/certificate/change/frame/:id',
  isAuth,
  certificateController.putChangeFrameAPI
)

//This route is for notification
router.get(
  '/notification',
  isAuth,
  notificationController.getNotificationDataAPI
)
router.get(
  '/notification/create',
  isAuth,
  notificationController.getCreateNotificationAPI
)
router.post(
  '/notification',
  isAuth,
  uploadNotificationFiles,
  notificationController.postNotificationDataAPI
)
router.get(
  '/notification/edit/:id',
  isAuth,
  notificationController.getEditNotificationAPI
)
router.put(
  '/notification/update/:id',
  isAuth,
  uploadNotificationFiles,
  notificationController.putUpdateNotificationAPI
)
router.get(
  '/notification/form/:id',
  isAuth,
  notificationController.getFormNotificationAPI
)
router.put(
  '/notification/form/update/:id',
  isAuth,
  uploadNotificationFiles,
  notificationController.updateNotificationAPI
)
router.put(
  '/notification/check/select/:id',
  isAuth,
  notificationController.getCheckSelectNotificationAPI
)

//This route is for program
router.get('/program', isAuth, programController.getProgramAPI)
router.post(
  '/program',
  isAuth,
  imageUpload('image_url'),
  programController.postProgramAPI
)
router.get('/program/edit/:id', isAuth, programController.getEditDataAPI)
router.post(
  '/program/update/:id',
  isAuth,
  imageUpload('image_url'),
  programController.updateProgramDataAPI
)
router.get(
  '/program/category/data/:category',
  isAuth,
  programController.getCategoryAPI
)
router.get('/program/create/data', isAuth, programController.getCreateDataAPI)
router.get(
  '/program/category/breadcumb/:stage/:id',
  isAuth,
  programController.getCategoryBreadcumb
)

//This route is for content folder
router.get(
  '/content-folder/:id',
  isAuth,
  contentFolderController.getContentFolderAPI
)
router.post(
  '/content-folder/:id',
  isAuth,
  imageUpload('image_url'),
  contentFolderController.postContentFolderAPI
)
router.get(
  '/content-folder/:id/edit/:cfId',
  isAuth,
  contentFolderController.editContentFolderAPI
)
router.post(
  '/content-folder/:id/update/:cfId',
  isAuth,
  imageUpload('image_url'),
  contentFolderController.updateContentFolderAPI
)

//This route is for Module
router.get('/module/:cId', isAuth, moduleController.getModuleDataAPI)
router.get('/modules/create', isAuth, moduleController.getModuleCreateAPI)
router.post(
  '/module/:cId/create/:id',
  isAuth,
  imageUpload('image_url'),
  moduleController.postModuleFormAPI
)
router.get('/module/:cId/edit/:id', isAuth, moduleController.editModuleFormAPI)
router.post(
  '/module/:cId/update/:id',
  isAuth,
  imageUpload('image_url'),
  moduleController.updateModuleFormAPI
)

//This route is for app config
router.get('/activity/:moduleId', isAuth, activityController.getActivityAPI)
router.get('/activity/create/data', isAuth, activityController.getCreateFormAPI)
router.post(
  '/activity/form/:moduleId/:typeId',
  isAuth,
  activityController.postActivityFormAPI
)
router.delete(
  '/activity/delete/:moduleId/:id',
  isAuth,
  activityController.deleteActivityAPI
)
router.post(
  '/activity/set-name/:moduleId/:id',
  isAuth,
  activityController.setNameActivityAPI
)

//This is used for router uploading scrom, other files
router.post(
  '/activity/data/:moduleId/:moduleTypeId/:id',
  isAuth,
  ...activityUpload.middleware('file'),
  activityController.postActivityDataAPI
)

//This route is for quiz question
router.get(
  '/quiz/question/:moduleId/:activityId',
  isAuth,
  quizAPIController.getQuizOptionAPI
)
router.post(
  '/quiz/question/:moduleId/:activityId',
  isAuth,
  quizAPIController.postQuizOptionAPI
)
router.put(
  '/quiz/question/:moduleId/:activityId',
  isAuth,
  quizAPIController.putQuizOptionAPI
)

//This route is for program schedule
router.get(
  '/program/schedule/data/:moduleId',
  isAuth,
  programScheduleController.getProgramScheduleAPI
)
router.get(
  '/program/schedule/create',
  isAuth,
  programScheduleController.getCreateDataAPI
)
router.post(
  '/program/schedule/:moduleId',
  isAuth,
  programScheduleController.postProgramScheduleAPI
)

//This route is for quiz setting
router.get(
  '/quiz/setting/post/:mId/:aId',
  isAuth,
  quizSettingController?.getQuizSettingData
)
router.post(
  '/quiz/setting/post/:mId/:aId',
  isAuth,
  quizSettingController?.postQuizSettingController
)

//This is the route for module survey setting
router.get(
  '/module/survey/setting/:moduleId',
  isAuth,
  surveySettingController.getSurveySettingAPI
)
router.post(
  '/module/survey/setting/:moduleId',
  isAuth,
  surveySettingController.postSurveySettingAPI
)

// This route is fpr module setting
router.get(
  '/modules/save/settings/:moduleId',
  isAuth,
  moduleSettingController.getModuleSettingAPI
)
router.post(
  '/modules/save/settings/:moduleId',
  isAuth,
  moduleSettingController.postModuleSettingAPI
)

//This route is for Live session
router.get(
  '/live/session/:moduleId',
  isAuth,
  activityController.getLiveSessionController
)
router.post(
  '/live/session/:moduleId',
  isAuth,
  activityController.postLiveSessionController
)

//This route is for Dashboard completion report
router.get(
  '/dashboard/completion/report',
  isAuth,
  reportController.getDashboardCompleteRatioReport
)
router.get(
  '/dashboard/module/report',
  isAuth,
  reportController.getByModuleReportController
)
router.get(
  '/dashboard/program/report',
  isAuth,
  reportController.getByProgramReportController
)
router.get(
  '/dashboard/learner/report',
  isAuth,
  reportController.getByLearnerController
)
router.get(
  '/dashboard/filter/data',
  isAuth,
  reportController.getFilterDataController
)
router.get(
  '/dashboard/module/type/data/:moduleTypeId/:status',
  isAuth,
  reportController.getModuleTypeUserData
)
router.get(
  '/dashboard/advance/training/report',
  isAuth,
  reportController.getAdvanceTrainingReport
)
router.get(
  '/dashboard/miscellaneous/report',
  isAuth,
  reportController.getMiscellaneousReportController
)

//This route is for Quiz assessment report
router.get(
  '/quiz/assessment/report',
  isAuth,
  reportController.getQuizAssessmentReportController
)

//This route is for scorm report data
router.get(
  '/scorm/report/data',
  isAuth,
  reportController.getScormReportDataController
)
router.get(
  '/scorm/report/detail/data',
  isAuth,
  reportController.getScormDetailReportDataController
)
router.get(
  '/login/report/data',
  isAuth,
  reportController.getLogInReportController
)
router.get(
  '/user/report/data',
  isAuth,
  reportController.getUserReportController
)

//This route is for mail template
router.get(
  '/mail/template/data',
  isAuth,
  mailTemplateController.getMailTemplateController
)
router.post(
  '/mail/template/data',
  isAuth,
  mailTemplateController.postMailTemplateController
)
router.put(
  '/mail/template/data/:id',
  isAuth,
  mailTemplateController.putMailTemplateController
)

//This route is for export center
router.get(
  '/export/center/data',
  isAuth,
  exportCenterController.getExportCenterController
)
router.post(
  '/export/center/create',
  isAuth,
  exportCenterController.postExportCenterController
)

//This route is for schedule notification
router.get(
  '/schedule/notification',
  isAuth,
  scheduleNotificationController.getScheduleNotification
)
router.post(
  '/schedule/notification/data',
  isAuth,
  scheduleNotificationController.postScheduleNotification
)
router.get(
  '/schedule/notification/edit/data/:id',
  isAuth,
  scheduleNotificationController.getEditSchedNotification
)
router.get(
  '/schedule/notification/create/data',
  isAuth,
  scheduleNotificationController.getCreateScheduleNotification
)
router.delete(
  '/schedule/notification/delete/:id',
  isAuth,
  scheduleNotificationController.deleteScheduleNotificationController
)

//This route is for dashboard
router.get(
  '/dashboard/company/data',
  isAuth,
  dashboardController.getDashboardAPIController
)

router.get(
  '/user/profile/data',
  isAuth,
  dashboardController.getUserProfileAPIController
)

router.post(
  '/user/profile/change/password',
  isAuth,
  userProfileController.postProfileChangePasswordAPIController
)

router.get(
  '/certificate/setting/data',
  isAuth,
  certificateController.getCertificateSettings
)

router.post(
  '/certificate/setting/data',
  isAuth,
  certificateController.postCertificateSettingAPI
)

//This route is for leaderboard data
router.get(
  '/leaderboard/data',
  isAuth,
  leaderboardAPIController.getLeaderboardDataAPI
)

router.post(
  '/leaderboard/config',
  isAuth,
  leaderboardAPIController.postLeaderboardConfigAPI
)

//This route is for contest & badges
router.get(
  '/contest/badge',
  isAuth,
  leaderboardAPIController?.getContestBadgeDataControllerAPI
)

router.get(
  '/contest/badges/create',
  isAuth,
  leaderboardAPIController.getContestBadgeCreateDataAPI
)

router.post(
  '/contest/badge/create',
  isAuth,
  leaderboardAPIController?.postContestBadgeControllerAPI
)

router.get(
  '/contest/badge/edit/:id',
  isAuth,
  leaderboardAPIController?.getContestBadgeEditController
)

router.put(
  '/contest/badge/update/:id',
  isAuth,
  leaderboardAPIController?.putContestBadgeController
)

module.exports = router

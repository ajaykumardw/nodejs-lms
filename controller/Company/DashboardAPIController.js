const Module = require('../../model/Module')
const mongoose = require('mongoose')
const User = require('../../model/User')
const AppConfig = require('../../model/AppConfig')
const Activity = require('../../model/Activity')
const ActivityLog = require('../../model/ActivityFolderReport')
const { successResponse, errorResponse } = require('../../util/response')

const { decrypt } = require('../../util/encryption')

exports.getDashboardAPIController = async (req, res, next) => {
  try {
    const userId = req?.userId

    const totalLearner = await User.find({ created_by: userId })
      .select('_id first_name last_name')
      .lean()

    const activeLearner = await User.find({
      created_by: userId,
      status: true
    })
      .select('_id first_name last_name')
      .lean()

    const modules = await Module.find({ created_by: userId })
      .select('_id title description')
      .lean()

    const moduleIds = modules.map(m => m._id)

    const activities = await Activity.find({
      module_id: { $in: moduleIds }
    }).lean()

    const logs = await ActivityLog.find({
      is_completed: true,
      module_id: { $in: moduleIds }
    }).lean()

    const activityMap = {}

    activities.forEach(act => {
      const moduleId = String(act.module_id)

      if (!activityMap[moduleId]) {
        activityMap[moduleId] = []
      }

      activityMap[moduleId].push(String(act._id))
    })

    const completedMap = {}

    logs.forEach(log => {
      const moduleId = String(log.module_id)

      if (!completedMap[moduleId]) {
        completedMap[moduleId] = []
      }

      completedMap[moduleId].push(String(log.activity_id))
    })

    const completedModules = modules.filter(module => {
      const moduleId = String(module._id)

      const moduleActivities = activityMap[moduleId] || []
      const completedActivities = completedMap[moduleId] || []

      return (
        moduleActivities.length > 0 &&
        moduleActivities.every(actId => completedActivities.includes(actId))
      )
    })

    const activityProgressStatus = await ActivityLog.aggregate([
      {
        $match: {
          module_id: { $in: moduleIds }
        }
      },
      {
        $addFields: {
          moduleTypeId: {
            $cond: [
              { $eq: [{ $type: '$module_type_id' }, 'objectId'] },
              '$module_type_id',
              {
                $cond: [
                  { $eq: [{ $type: '$module_type_id' }, 'string'] },
                  { $toObjectId: '$module_type_id' },
                  null
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$moduleTypeId',
          totalLogs: { $sum: 1 },
          completedLogs: {
            $sum: {
              $cond: [{ $eq: ['$is_completed', true] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          completionPercentage: {
            $cond: [
              { $eq: ['$totalLogs', 0] },
              0,
              {
                $multiply: [{ $divide: ['$completedLogs', '$totalLogs'] }, 100]
              }
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'app_config',
          let: { moduleTypeId: '$_id' },
          pipeline: [
            { $match: { type: 'Activity_data' } },
            { $unwind: '$activity_data' },
            {
              $match: {
                $expr: {
                  $eq: ['$activity_data._id', '$$moduleTypeId']
                }
              }
            }
          ],
          as: 'moduleType'
        }
      },
      { $unwind: { path: '$moduleType', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          module_type_id: '$_id',
          totalLogs: 1,
          completedLogs: 1,
          completionPercentage: { $round: ['$completionPercentage', 2] },
          moduleType: '$moduleType.activity_data.title'
        }
      }
    ])

    const moduleProgressStatus = await ActivityLog.aggregate([
      {
        $match: {
          module_id: { $in: moduleIds }
        }
      },
      {
        $group: {
          _id: '$module_id',
          totalLogs: { $sum: 1 },
          completedLogs: {
            $sum: {
              $cond: [{ $eq: ['$is_completed', true] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          completionPercentage: {
            $cond: [
              { $eq: ['$totalLogs', 0] },
              0,
              {
                $multiply: [{ $divide: ['$completedLogs', '$totalLogs'] }, 100]
              }
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'modules',
          localField: '_id',
          foreignField: '_id',
          as: 'module'
        }
      },
      { $unwind: { path: '$module', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          module_id: '$_id',
          module_title: '$module.title',
          totalLogs: 1,
          completedLogs: 1,
          completionPercentage: { $round: ['$completionPercentage', 2] }
        }
      }
    ])

    const pendingTask = await AppConfig.aggregate([
      {
        $unwind: '$activity_data'
      },
      {
        $lookup: {
          from: 'activity',
          let: { moduleTypeId: '$activity_data._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$module_type_id', '$$moduleTypeId'] },
                    { $in: ['$module_id', moduleIds] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'activity_logs',
                localField: '_id',
                foreignField: 'activity_id',
                as: 'activityLog'
              }
            },
            {
              $match: {
                $expr: { $eq: [{ $size: '$activityLog' }, 0] } // no logs
              }
            }
          ],
          as: 'activities'
        }
      },
      {
        $project: {
          module_type_id: '$activity_data._id',
          title: '$activity_data.title',
          count: { $size: '$activities' }
        }
      },
      {
        $match: {
          count: { $gt: 0 } // optional: remove empty ones
        }
      }
    ])

    const [progressStatus] = await ActivityLog.aggregate([
      {
        $match: {
          module_id: { $in: moduleIds }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          not_started: {
            $sum: {
              $cond: [{ $eq: ['$progress_status', '1'] }, 1, 0]
            }
          },
          in_progress: {
            $sum: {
              $cond: [{ $eq: ['$progress_status', '2'] }, 1, 0]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$progress_status', '3'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          not_started: 1,
          in_progress: 1,
          completed: 1,
          not_started_percentage: {
            $multiply: [{ $divide: ['$not_started', '$total'] }, 100]
          },
          in_progress_percentage: {
            $multiply: [{ $divide: ['$in_progress', '$total'] }, 100]
          },
          completed_percentage: {
            $multiply: [{ $divide: ['$completed', '$total'] }, 100]
          }
        }
      }
    ])

    const [QuizProgressStatus] = await ActivityLog.aggregate([
      {
        $match: {
          module_id: { $in: moduleIds },
          module_type_id: mongoose.Types.ObjectId.createFromHexString(
            '68886902954c4d9dc7a379bd'
          )
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          not_passed: {
            $sum: {
              $cond: [{ $eq: ['$is_passed', false] }, 1, 0]
            }
          },
          passed: {
            $sum: {
              $cond: [{ $eq: ['$is_passed', true] }, 1, 0]
            }
          },
          not_started: {
            $sum: {
              $cond: [{ $eq: ['$progress_status', '2'] }, 1, 0] // change to 2 if number
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          not_passed: 1,
          passed: 1,
          not_started: 1,

          not_passed_percentage: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$not_passed', '$total'] }, 100] }
            ]
          },
          not_started_percentage: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$not_started', '$total'] }, 100] }
            ]
          },
          passed_percentage: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$passed', '$total'] }, 100] }
            ]
          }
        }
      }
    ])

    const recentActivity = await ActivityLog.aggregate([
      {
        $match: {
          module_id: { $in: moduleIds }
        }
      },
      {
        $lookup: {
          from: 'app_config',
          let: {
            moduleTypeId: {
              $cond: [
                { $eq: [{ $type: '$module_type_id' }, 'objectId'] },
                '$module_type_id',
                {
                  $cond: [
                    { $eq: [{ $type: '$module_type_id' }, 'string'] },
                    { $toObjectId: '$module_type_id' },
                    null
                  ]
                }
              ]
            }
          },
          pipeline: [
            { $match: { type: 'Activity_data' } },
            { $unwind: '$activity_data' },
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$moduleTypeId', null] },
                    {
                      $eq: ['$activity_data._id', '$$moduleTypeId']
                    }
                  ]
                }
              }
            }
          ],
          as: 'moduleType'
        }
      },
      {
        $unwind: {
          path: '$moduleType',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          title: '$moduleType.activity_data.title',
          description: '$moduleType.activity_data.description',
          current_attempt: 1
        }
      },
      {
        $sort: {
          current_attempt: -1
        }
      },
      {
        $limit: 5
      }
    ])

    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    // FY logic (India Apr–Mar)
    const currentFY = currentMonth >= 4 ? currentYear : currentYear - 1
    const previousFY = currentFY - 1

    const modesLearning = await AppConfig.aggregate([
      { $unwind: '$module_data' },
      {
        $lookup: {
          from: 'modules',
          localField: 'module_data._id',
          foreignField: 'module_type_id',
          as: 'modules'
        }
      },
      { $unwind: { path: '$modules', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'program_schedules',
          localField: 'modules._id',
          foreignField: 'module_id',
          as: 'schedule'
        }
      },
      { $unwind: { path: '$schedule', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'schedule_users',
          localField: 'schedule._id',
          foreignField: 'schedule_id',
          as: 'scheduleUsers'
        }
      },
      {
        $lookup: {
          from: 'schedule_type',
          localField: 'schedule._id',
          foreignField: 'schedule_id',
          as: 'scheduleTypes'
        }
      },
      {
        $lookup: {
          from: 'user_module_enroll',
          localField: 'modules._id',
          foreignField: 'module_id',
          as: 'enrollUsers'
        }
      },
      {
        $addFields: {
          allUsers: {
            $setUnion: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: '$scheduleTypes',
                      as: 'st',
                      cond: { $eq: ['$$st.type', '5'] }
                    }
                  },
                  as: 's',
                  in: '$$s.type_id'
                }
              },
              {
                $map: {
                  input: '$scheduleUsers',
                  as: 'su',
                  in: '$$su.user_id'
                }
              },
              {
                $map: {
                  input: '$enrollUsers',
                  as: 'eu',
                  in: '$$eu.user_id'
                }
              }
            ]
          }
        }
      },
      { $unwind: { path: '$allUsers', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          year: { $year: '$schedule.published_date' },
          month: { $month: '$schedule.published_date' }
        }
      },
      {
        $addFields: {
          financialYear: {
            $cond: [
              { $gte: ['$month', 4] },
              '$year',
              { $subtract: ['$year', 1] }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            module_type_id: '$module_data._id',
            title: '$module_data.title',
            fy: '$financialYear'
          },
          users: { $addToSet: '$allUsers' }
        }
      },
      {
        $project: {
          module_type_id: '$_id.module_type_id',
          title: '$_id.title',
          fy: '$_id.fy',
          userCount: {
            $size: {
              $filter: {
                input: '$users',
                as: 'u',
                cond: { $ne: ['$$u', null] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            module_type_id: '$module_type_id',
            title: '$title'
          },
          currentFYUsers: {
            $sum: {
              $cond: [{ $eq: ['$fy', currentFY] }, '$userCount', 0]
            }
          },
          previousFYUsers: {
            $sum: {
              $cond: [{ $eq: ['$fy', previousFY] }, '$userCount', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          module_type_id: '$_id.module_type_id',
          title: '$_id.title',
          currentFYUsers: { $ifNull: ['$currentFYUsers', 0] },
          previousFYUsers: { $ifNull: ['$previousFYUsers', 0] },
          previousFinancialYear: {
            $concat: [
              { $toString: currentFY },
              '-',
              { $toString: { $subtract: [currentFY, 1] } }
            ]
          },
          currentFinancialYear: {
            $concat: [
              { $toString: previousFY },
              '-',
              { $toString: { $subtract: [previousFY, 1] } }
            ]
          }
        }
      }
    ])

    const finalData = {
      totalModule: modules,
      totalLearner,
      activeLearner,
      completedModules,
      moduleActivity: activityProgressStatus,
      learnerProgress: moduleProgressStatus,
      pendingTask,
      CourseProgressStatus: progressStatus,
      QuizProgressStatus,
      modesLearning,
      recentActivity
    }

    return successResponse(
      res,
      'Dashboard data fetched successfully',
      finalData
    )
  } catch (error) {
    next(error)
  }
}

exports.getUserProfileAPIController = async (req, res, next) => {
  try {
    const userId = req.userId

    // VALIDATE USER ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return errorResponse(res, 'Invalid user id', {}, 400)
    }

    const users = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId)
        }
      },

      // ROLE USER MAPPINGS
      {
        $lookup: {
          from: 'role_users',
          localField: '_id',
          foreignField: 'user_id',
          as: 'role_users'
        }
      },

      {
        $unwind: {
          path: '$role_users',
          preserveNullAndEmptyArrays: true
        }
      },

      // ROLE DETAILS
      {
        $lookup: {
          from: 'roles',
          localField: 'role_users.role_id',
          foreignField: '_id',
          as: 'role'
        }
      },

      {
        $unwind: {
          path: '$role',
          preserveNullAndEmptyArrays: true
        }
      },

      // DESIGNATION
      {
        $lookup: {
          from: 'designations',
          localField: 'designation_id',
          foreignField: '_id',
          as: 'designation'
        }
      },

      {
        $unwind: {
          path: '$designation',
          preserveNullAndEmptyArrays: true
        }
      },

      // DEPARTMENT
      {
        $lookup: {
          from: 'departments',
          localField: 'department_id',
          foreignField: '_id',
          as: 'department'
        }
      },

      {
        $unwind: {
          path: '$department',
          preserveNullAndEmptyArrays: true
        }
      },

      // REGION
      {
        $lookup: {
          from: 'regions',
          localField: 'region_id',
          foreignField: '_id',
          as: 'region'
        }
      },

      {
        $unwind: {
          path: '$region',
          preserveNullAndEmptyArrays: true
        }
      },

      // ZONE
      {
        $lookup: {
          from: 'zones',
          localField: 'zone_id',
          foreignField: '_id',
          as: 'zone'
        }
      },

      {
        $unwind: {
          path: '$zone',
          preserveNullAndEmptyArrays: true
        }
      },

      // PARTICIPATION TYPE
      {
        $lookup: {
          from: 'participation_types',
          localField: 'participation_type_id',
          foreignField: '_id',
          as: 'participation_type'
        }
      },

      {
        $unwind: {
          path: '$participation_type',
          preserveNullAndEmptyArrays: true
        }
      },

      // GROUP DATA
      {
        $group: {
          _id: '$_id',

          first_name: {
            $first: '$first_name'
          },

          last_name: {
            $first: '$last_name'
          },

          email: {
            $first: '$email'
          },

          phone: {
            $first: '$phone'
          },

          employee_type: {
            $first: '$employee_type'
          },

          photo: {
            $first: '$photo'
          },

          status: {
            $first: '$status'
          },

          address: {
            $first: '$address'
          },

          pincode: {
            $first: '$pincode'
          },

          dob: {
            $first: '$dob'
          },

          urn_no: {
            $first: '$urn_no'
          },

          idfa_code: {
            $first: '$idfa_code'
          },

          application_no: {
            $first: '$application_no'
          },

          licence_no: {
            $first: '$licence_no'
          },

          created_at: {
            $first: '$created_at'
          },

          emp_id: {
            $first: {
              $let: {
                vars: {
                  activeCode: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$codes',
                          as: 'code',
                          cond: {
                            $eq: ['$$code.type', 'active']
                          }
                        }
                      },
                      0
                    ]
                  }
                },
                in: '$$activeCode.code'
              }
            }
          },

          designation: {
            $first: {
              _id: '$designation._id',
              name: '$designation.name'
            }
          },

          department: {
            $first: {
              _id: '$department._id',
              name: '$department.name'
            }
          },

          region: {
            $first: {
              _id: '$region._id',
              name: '$region.name'
            }
          },

          zone: {
            $first: {
              _id: '$zone._id',
              name: '$zone.name'
            }
          },

          participation_type: {
            $first: {
              _id: '$participation_type._id',
              name: '$participation_type.name'
            }
          },

          roles: {
            $push: {
              _id: '$role._id',
              name: '$role.name',
              description: '$role.description',
              status: '$role.status'
            }
          }
        }
      },

      // REMOVE NULL ROLES
      {
        $addFields: {
          roles: {
            $filter: {
              input: '$roles',
              as: 'role',
              cond: {
                $ne: ['$$role._id', null]
              }
            }
          }
        }
      }
    ])

    const user = users[0]

    if (!user) {
      return errorResponse(res, 'User not found', {}, 404)
    }

    // FINAL RESPONSE
    const finalUser = {
      _id: user._id,

      first_name: user.first_name,

      last_name: user.last_name,

      email: user.email ? decrypt(user.email) : null,

      phone: user.phone ? decrypt(user.phone) : null,

      employee_type: user.employee_type || null,

      photo: user.photo || null,

      status: user.status,

      address: user.address || null,

      pincode: user.pincode || null,

      dob: user.dob || null,

      urn_no: user.urn_no || null,

      idfa_code: user.idfa_code || null,

      application_no: user.application_no || null,

      licence_no: user.licence_no || null,

      emp_id: user.emp_id || null,

      designation: user.designation?._id ? user.designation : null,

      department: user.department?._id ? user.department : null,

      region: user.region?._id ? user.region : null,

      zone: user.zone?._id ? user.zone : null,

      participation_type: user.participation_type?._id
        ? user.participation_type
        : null,

      roles: user.roles || [],

      created_at: user.created_at,
    }

    return successResponse(res, 'User profile data fetched successfully', {
      user: finalUser
    })
  } catch (error) {
    next(error)
  }
}

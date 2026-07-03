const mongoose = require('mongoose')
const Module = require('../../model/Module')
const Activity = require('../../model/Activity')
const User = require('../../model/User')
const AppConfig = require('../../model/AppConfig')
const NotificationLog = require('../../model/NotificationLog')
const ActivityLog = require('../../model/ActivityFolderReport')
const SettingConfig = require('../../model/settingConfig')
const { successResponse } = require('../../util/response')

const dayjs = require('dayjs')

const LIVE_MODULE_TYPE_ID = mongoose.Types.ObjectId.createFromHexString(
  '688219557b6953e899cb57d3'
)

exports.getDashboardAPI = async (req, res, next) => {
  try {
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(
      req?.userId
    )

    const liveSessionId = mongoose.Types.ObjectId.createFromHexString(
      '688219557b6953e899cb57d3'
    )

    const user = await User.findById(userObjectId)

    if (!user) {
      return errorResponse(res, 'User does not exist', {}, 404)
    }

    const masterId = user?.created_by

    const now = new Date()

    const settingConfig = await SettingConfig.findOne({
      type: 'certificate_setting',
      created_by: masterId
    })

    const certificateSettingId = settingConfig?.certificate_setting_data_id
      ? settingConfig.certificate_setting_data_id
      : '6a153d4a393b1c736064377b'

    const module = await Module.aggregate([
      {
        $lookup: {
          from: 'activity_logs',
          let: { user_id: userObjectId, id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_id', '$$user_id'] },
                    { $eq: ['$module_id', '$$id'] }
                  ]
                }
              }
            }
          ],
          as: 'activity_logs'
        }
      },
      {
        $lookup: {
          from: 'program_schedules',
          let: { moduleId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$module_id', '$$moduleId']
                }
              }
            }
          ],
          as: 'programSchedule'
        }
      },
      {
        $unwind: {
          path: '$programSchedule',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'schedule_type',
          let: { scheduleId: '$programSchedule._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$schedule_id', '$$scheduleId']
                }
              }
            }
          ],
          as: 'scheduleType'
        }
      },
      {
        $lookup: {
          from: 'schedule_users',
          let: { scheduleId: '$programSchedule._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$schedule_id', '$$scheduleId']
                }
              }
            }
          ],
          as: 'scheduleUser'
        }
      },
      {
        $addFields: {
          allowedUser: {
            $setUnion: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: '$scheduleType',
                      as: 'st',
                      cond: { $eq: ['$$st.type', '5'] }
                    }
                  },
                  as: 't1',
                  in: '$$t1.type_id'
                }
              },
              {
                $map: {
                  input: '$scheduleUser',
                  as: 't2',
                  in: '$$t2.user_id'
                }
              }
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'user_module_enroll',
          let: { moduleId: '$_id', userId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$module_id', '$$moduleId'] },
                    { $eq: ['$user_id', '$$userId'] }
                  ]
                }
              }
            }
          ],
          as: 'moduleEnroll'
        }
      },
      {
        $match: {
          'programSchedule._id': { $exists: true },
          $or: [
            {
              $expr: {
                $in: [userObjectId, '$allowedUser']
              }
            },
            {
              $expr: {
                $and: [
                  { $eq: ['$programSchedule.pushEnrollmentSetting', 2] },
                  { $gt: [{ $size: '$moduleEnroll' }, 0] }
                ]
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'app_config',
          let: { moduleTypeId: '$module_type_id' },
          pipeline: [
            { $unwind: '$module_data' },
            {
              $match: {
                $expr: { $eq: ['$module_data._id', '$$moduleTypeId'] }
              }
            },
            { $project: { title: '$module_data.title' } }
          ],
          as: 'moduleTypeInfo'
        }
      },
      {
        $unwind: { path: '$moduleTypeInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          moduleTypeName: '$moduleTypeInfo.title'
        }
      }
    ])

    const moduleIds = module.map(m => m._id)

    const modules = await Module.aggregate([
      {
        $match: {
          created_by: masterId
        }
      },
      {
        $lookup: {
          from: 'activity',
          localField: '_id',
          foreignField: 'module_id',
          as: 'activity'
        }
      },

      // GET USER ACTIVITY LOGS
      {
        $lookup: {
          from: 'activity_logs',
          let: { user_id: userObjectId, module_id: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_id', '$$user_id'] },
                    { $eq: ['$module_id', '$$module_id'] }
                  ]
                }
              }
            }
          ],
          as: 'activity_logs'
        }
      },

      // PROGRAM SCHEDULE
      {
        $lookup: {
          from: 'program_schedules',
          localField: '_id',
          foreignField: 'module_id',
          as: 'programSchedule'
        }
      },

      {
        $unwind: {
          path: '$programSchedule',
          preserveNullAndEmptyArrays: true
        }
      },

      // MODULE ENROLL
      {
        $lookup: {
          from: 'user_module_enroll',
          let: { moduleId: '$_id', userId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$module_id', '$$moduleId'] },
                    { $eq: ['$user_id', '$$userId'] }
                  ]
                }
              }
            }
          ],
          as: 'moduleEnroll'
        }
      },

      {
        $lookup: {
          from: 'modulesettings',
          localField: '_id',
          foreignField: 'moduleId',
          as: 'module_setting'
        }
      },

      {
        $unwind: {
          path: '$module_setting',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $addFields: {
          is_certificate_enable: {
            $eq: ['$module_setting.certificateEnabled', true]
          }
        }
      },

      {
        $lookup: {
          from: 'certificates',
          let: { certificateId: '$module_setting.selectedCertificateId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$certificateId'] }]
                }
              }
            }
          ],
          as: 'certificate'
        }
      },

      {
        $unwind: {
          path: '$certificate',
          preserveNullAndEmptyArrays: true
        }
      },

      // RELATIVE DATE
      {
        $addFields: {
          relativeEndDate: {
            $cond: [
              { $eq: ['$programSchedule.dueType', 'relative'] },
              {
                $dateAdd: {
                  startDate: '$programSchedule.published_date',
                  unit: 'day',
                  amount: {
                    $toInt: {
                      $ifNull: ['$programSchedule.dueDays', 0]
                    }
                  }
                }
              },
              null
            ]
          }
        }
      },

      // DATE VISIBILITY
      {
        $addFields: {
          isDateVisible: {
            $cond: [
              { $eq: ['$programSchedule.dueType', 'relative'] },
              {
                $and: [
                  { $lte: ['$programSchedule.published_date', now] },
                  { $gte: ['$relativeEndDate', now] }
                ]
              },
              {
                $cond: [
                  { $eq: ['$programSchedule.dueType', 'fixed'] },
                  {
                    $and: [
                      { $lte: ['$programSchedule.dueDate.start_date', now] },
                      { $gte: ['$programSchedule.dueDate.end_date', now] }
                    ]
                  },
                  true
                ]
              }
            ]
          }
        }
      },

      // ENROLLMENT VISIBILITY
      {
        $addFields: {
          isVisible: {
            $cond: {
              if: { $eq: ['$programSchedule.pushEnrollmentSetting', 2] },
              then: { $gt: [{ $size: '$moduleEnroll' }, 0] },
              else: true
            }
          }
        }
      },

      // LIVE MODULE VISIBILITY
      {
        $addFields: {
          isLiveModuleVisible: {
            $cond: [
              { $eq: ['$module_type_id', LIVE_MODULE_TYPE_ID] },
              {
                $and: [
                  { $lte: ['$start_live_time', now] },
                  { $gte: ['$end_live_time', now] },
                  { $gt: [{ $size: '$moduleEnroll' }, 0] }
                ]
              },
              true
            ]
          }
        }
      },

      // COMPLETED ACTIVITY COUNT
      {
        $addFields: {
          total_activity: {
            $size: '$activity'
          },

          completed_activity: {
            $size: {
              $filter: {
                input: '$activity',
                as: 'act',
                cond: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: '$activity_logs',
                          as: 'log',
                          cond: {
                            $and: [
                              {
                                $eq: ['$$log.activity_id', '$$act._id']
                              },
                              {
                                $eq: ['$$log.is_completed', true]
                              }
                            ]
                          }
                        }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      },

      // COMPLETION PERCENTAGE
      {
        $addFields: {
          completion_percentage: {
            $cond: [
              { $eq: ['$total_activity', 0] },
              0,
              {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: ['$completed_activity', '$total_activity']
                      },
                      100
                    ]
                  },
                  0
                ]
              }
            ]
          }
        }
      },

      // HAS COMPLETED
      // HAS COMPLETED
      {
        $addFields: {
          has_completed: {
            $cond: [
              {
                $ne: [
                  certificateSettingId,
                  mongoose.Types.ObjectId.createFromHexString(
                    '6a153d4a393b1c736064377b'
                  )
                ]
              },
              false,
              {
                $cond: [
                  {
                    $ne: [
                      '$module_type_id',
                      mongoose.Types.ObjectId.createFromHexString(
                        '688219557b6953e899cb57d2'
                      )
                    ]
                  },
                  false,
                  {
                    $and: [
                      { $gt: ['$completed_activity', 0] },
                      {
                        $eq: ['$completed_activity', '$total_activity']
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },

      {
        $addFields: {
          module_completed_at: {
            $cond: [
              {
                $eq: ['$completed_activity', '$total_activity']
              },
              {
                $let: {
                  vars: {
                    completedLogs: {
                      $filter: {
                        input: '$activity_logs',
                        as: 'log',
                        cond: {
                          $eq: ['$$log.is_completed', true]
                        }
                      }
                    }
                  },
                  in: {
                    $max: '$$completedLogs.completed_at_time'
                  }
                }
              },
              null
            ]
          }
        }
      },

      {
        $lookup: {
          from: 'content_folder',
          localField: 'content_folder_id',
          foreignField: '_id',
          as: 'contentFolder'
        }
      },

      {
        $unwind: {
          path: '$contentFolder',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $lookup: {
          from: 'programs',
          localField: 'contentFolder.program_id',
          foreignField: '_id',
          as: 'program'
        }
      },
      {
        $unwind: {
          path: '$program',
          preserveNullAndEmptyArrays: true
        }
      },

      // FINAL FILTER
      {
        $match: {
          isLiveModuleVisible: true,
          isVisible: true,
          'programSchedule._id': { $exists: true },
          isDateVisible: true,
          ...completionFilter
        }
      },

      {
        $project: {
          title: 1,
          image_url: 1,
          completion_percentage: 1,
          has_completed: 1,
          module_completed_at: 1,
          total_activity: 1,
          completed_activity: 1,
          description: 1,
          contentFolderName: '$contentFolder.title',
          programName: '$program.title',
          contentFolderId: '$contentFolder._id',
          programId: '$program._id',
          activity: 1
        }
      }
    ])

    let total = modules.length
    let completed = 0
    let in_progress = 0
    let not_started = 0

    for (const module of modules) {
      const activities = module.activities || []

      // No activities => not started
      if (!activity.length) {
        not_started++
        continue
      }

      let completedActivities = 0
      let hasInProgress = false

      if (total_activity === completed_activity) {
        completed++
      } else if (module?.completion_percentage > 0) {
        in_progress++
      } else {
        not_started++
      }
    }

    const progressStatus = {
      total,
      not_started,
      in_progress,
      completed,
      not_started_percentage: total ? (not_started / total) * 100 : 0,
      in_progress_percentage: total ? (in_progress / total) * 100 : 0,
      completed_percentage: total ? (completed / total) * 100 : 0
    }

    const activity = await AppConfig.aggregate([
      {
        $unwind: '$activity_data'
      },
      {
        $lookup: {
          from: 'activity',
          let: { activityId: '$activity_data._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$module_id', moduleIds] },
                    { $eq: ['$module_type_id', '$$activityId'] }
                  ]
                }
              }
            }
          ],
          as: 'activities'
        }
      },
      {
        $addFields: {
          count: { $size: '$activities' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$count' },
          modules: {
            $push: {
              _id: '$activity_data._id',
              title: '$activity_data.title',
              count: '$count'
            }
          }
        }
      },
      {
        $unwind: '$modules'
      },
      {
        $project: {
          _id: '$modules._id',
          title: '$modules.title',
          count: '$modules.count',
          percentage: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              {
                $multiply: [{ $divide: ['$modules.count', '$total'] }, 100]
              }
            ]
          }
        }
      }
    ])

    const liveSession = await Module.aggregate([
      {
        $match: {
          _id: { $in: moduleIds },
          module_type_id: liveSessionId
        }
      },
      {
        $project: {
          title: 1,
          description: 1,

          start_live_time: {
            $let: {
              vars: {
                date: { $toDate: '$start_live_time' }
              },
              in: {
                $concat: [
                  {
                    $dateToString: {
                      format: '%d %b | ',
                      date: '$$date',
                      timezone: 'Asia/Kolkata'
                    }
                  },

                  // hour conversion
                  {
                    $toString: {
                      $let: {
                        vars: {
                          hour: {
                            $hour: { date: '$$date', timezone: 'Asia/Kolkata' }
                          }
                        },
                        in: {
                          $cond: [
                            { $eq: ['$$hour', 0] },
                            12,
                            {
                              $cond: [
                                { $gt: ['$$hour', 12] },
                                { $subtract: ['$$hour', 12] },
                                '$$hour'
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },

                  ':',
                  {
                    $dateToString: {
                      format: '%M',
                      date: '$$date',
                      timezone: 'Asia/Kolkata'
                    }
                  },
                  ' ',
                  {
                    $cond: [
                      {
                        $gte: [
                          {
                            $hour: { date: '$$date', timezone: 'Asia/Kolkata' }
                          },
                          12
                        ]
                      },
                      'PM',
                      'AM'
                    ]
                  }
                ]
              }
            }
          },

          end_live_time: {
            $let: {
              vars: {
                date: { $toDate: '$end_live_time' }
              },
              in: {
                $concat: [
                  {
                    $dateToString: {
                      format: '%d %b | ',
                      date: '$$date',
                      timezone: 'Asia/Kolkata'
                    }
                  },
                  {
                    $toString: {
                      $let: {
                        vars: {
                          hour: {
                            $hour: { date: '$$date', timezone: 'Asia/Kolkata' }
                          }
                        },
                        in: {
                          $cond: [
                            { $eq: ['$$hour', 0] },
                            12,
                            {
                              $cond: [
                                { $gt: ['$$hour', 12] },
                                { $subtract: ['$$hour', 12] },
                                '$$hour'
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  ':',
                  {
                    $dateToString: {
                      format: '%M',
                      date: '$$date',
                      timezone: 'Asia/Kolkata'
                    }
                  },
                  ' ',
                  {
                    $cond: [
                      {
                        $gte: [
                          {
                            $hour: { date: '$$date', timezone: 'Asia/Kolkata' }
                          },
                          12
                        ]
                      },
                      'PM',
                      'AM'
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ])

    const notificationLog = await NotificationLog.aggregate([
      {
        $match: {
          user_id: userObjectId
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          user: 1,
          template_name: 1,
          reason: 1,
          schedule_date: 1
        }
      }
    ])

    const activityLog = await ActivityLog.aggregate([
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
          start_activity_time: 1,
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

    activityLog.forEach(item => {
      item.start_activity_time = dayjs(item.start_activity_time).format(
        'hh:mm A DD MMM YYYY'
      )
    })

    const finalData = {
      enrolledData: module,
      activityLog,
      progressStatus,
      activitySummary: activity,
      liveSession,
      notificationLog
    }

    return successResponse(res, 'Module fetched successfully', finalData)
  } catch (error) {
    next(error)
  }
}

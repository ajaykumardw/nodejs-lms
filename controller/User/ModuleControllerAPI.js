const mongoose = require('mongoose')
const User = require('../../model/User')
const Module = require('../../model/Module')
const ContentFolder = require('../../model/ContentFolder')
const SettingConfig = require('../../model/settingConfig')

const { errorResponse, successResponse } = require('../../util/response')

exports.getModuleAPIController = async (req, res, next) => {
  try {
    const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId)

    const LIVE_MODULE_TYPE_ID = mongoose.Types.ObjectId.createFromHexString(
      '688219557b6953e899cb57d3'
    )

    const user = await User.findById(userId)

    if (!user) {
      return errorResponse(res, 'User does not exist', {}, 404)
    }

    const masterId = user?.created_by

    const settingConfig = await SettingConfig.findOne({
      type: 'certificate_setting',
      created_by: masterId
    })

    const certificateSettingId = settingConfig?.certificate_setting_data_id
      ? settingConfig.certificate_setting_data_id
      : '6a153d4a393b1c736064377b'

    const id = req?.params?.id

    const contentFolder = await ContentFolder.findById(id).populate(
      'activity_logs'
    )

    const now = new Date()

    const module = await Module.aggregate([
      {
        $match: {
          content_folder_id: mongoose.Types.ObjectId.createFromHexString(id),
          created_by: masterId
        }
      },

      // GET ALL ACTIVITIES
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
          let: { user_id: userId, module_id: '$_id' },
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
          let: { moduleId: '$_id', userId: userId },
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

      // FINAL FILTER
      {
        $match: {
          isLiveModuleVisible: true,
          isVisible: true,
          'programSchedule._id': { $exists: true },
          isDateVisible: true
        }
      }
    ])

    if (!module) {
      return errorResponse(res, 'Module does not exist', {}, 404)
    }

    return successResponse(res, 'Module fetched successfully', {
      courseDetails: contentFolder,
      courses: module
    })
  } catch (error) {
    next(error)
  }
}

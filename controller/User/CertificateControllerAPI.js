const mongoose = require('mongoose')

const User = require('../../model/User')
const Module = require('../../model/Module')
const Certificate = require('../../model/Certificate')
const ContentFolder = require('../../model/ContentFolder')
const SettingConfig = require('../../model/settingConfig')

const { successResponse, errorResponse } = require('../../util/response')

exports.downloadCertificate = async (req, res, next) => {
  try {
    const { certificateId } = req.params

    const certificate = await Certificate.findById(certificateId)

    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' })
    }

    // generate PDF (example using pdfkit / puppeteer)
    const filePath = await generateCertificatePDF(certificate, req.user)

    res.download(filePath, 'certificate.pdf')
  } catch (error) {
    next(error)
  }
}

exports.getCertificateDataAPIController = async (req, res, next) => {
  try {
    const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId)

    const user = await User.findById(userId)

    if (!user) {
      return errorResponse(res, 'User not found', {}, 404)
    }

    const masterId = user?.created_by

    const settingConfig = await SettingConfig.findOne({
      created_by: masterId,
      type: 'certificate_setting'
    })

    const certificateId = settingConfig
      ? settingConfig.certificate_setting_data_id
      : '6a153d4a393b1c736064377b'

    const now = new Date()

    const LIVE_MODULE_TYPE_ID = mongoose.Types.ObjectId.createFromHexString(
      '688219557b6953e899cb57d3'
    )

    let finalData = {}

    if (certificateId == '6a153d4a393b1c736064377b') {
      finalData = await Module.aggregate([
        {
          $match: {
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
            as: 'certificates'
          }
        },

        {
          $unwind: {
            path: '$certificates',
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
                    certificateId,
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
            from: 'users',
            localField: 'created_by',
            foreignField: '_id',
            as: 'user'
          }
        },

        {
          $unwind: {
            path: '$user',
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
            has_completed: true
          }
        }
      ])
    } else {
      finalData = await ContentFolder.aggregate([
        {
          $match: {
            created_by: masterId
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'created_by',
            foreignField: '_id',
            as: 'user'
          }
        },

        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },

        {
          $lookup: {
            from: 'certificates',
            let: {
              certificate_id: '$certificateId'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ['$_id', '$$certificate_id']
                      },
                      {
                        $eq: ['$created_by', masterId]
                      }
                    ]
                  }
                }
              }
            ],
            as: 'certificates'
          }
        },

        {
          $unwind: {
            path: '$certificates',
            preserveNullAndEmptyArrays: true
          }
        },

        // MODULES
        {
          $lookup: {
            from: 'modules',
            let: {
              contentFolderId: '$_id'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: ['$content_folder_id', '$$contentFolderId']
                      },
                      {
                        $eq: ['$created_by', masterId]
                      }
                    ]
                  }
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
                  let: {
                    user_id: userId,
                    module_id: '$_id'
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ['$user_id', '$$user_id']
                            },
                            {
                              $eq: ['$module_id', '$$module_id']
                            }
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
                  let: {
                    moduleId: '$_id',
                    userId: userId
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ['$module_id', '$$moduleId']
                            },
                            {
                              $eq: ['$user_id', '$$userId']
                            }
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
                  let: {
                    certificateId: '$module_setting.selectedCertificateId'
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ['$_id', '$$certificateId']
                            }
                          ]
                        }
                      }
                    }
                  ],
                  as: 'certificates'
                }
              },

              {
                $unwind: {
                  path: '$certificates',
                  preserveNullAndEmptyArrays: true
                }
              },

              // RELATIVE DATE
              {
                $addFields: {
                  relativeEndDate: {
                    $cond: [
                      {
                        $eq: ['$programSchedule.dueType', 'relative']
                      },
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
                      {
                        $eq: ['$programSchedule.dueType', 'relative']
                      },
                      {
                        $and: [
                          {
                            $lte: ['$programSchedule.published_date', now]
                          },
                          {
                            $gte: ['$relativeEndDate', now]
                          }
                        ]
                      },
                      {
                        $cond: [
                          {
                            $eq: ['$programSchedule.dueType', 'fixed']
                          },
                          {
                            $and: [
                              {
                                $lte: [
                                  '$programSchedule.dueDate.start_date',
                                  now
                                ]
                              },
                              {
                                $gte: ['$programSchedule.dueDate.end_date', now]
                              }
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
                      if: {
                        $eq: ['$programSchedule.pushEnrollmentSetting', 2]
                      },
                      then: {
                        $gt: [
                          {
                            $size: '$moduleEnroll'
                          },
                          0
                        ]
                      },
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
                      {
                        $eq: ['$module_type_id', LIVE_MODULE_TYPE_ID]
                      },
                      {
                        $and: [
                          {
                            $lte: ['$start_live_time', now]
                          },
                          {
                            $gte: ['$end_live_time', now]
                          },
                          {
                            $gt: [
                              {
                                $size: '$moduleEnroll'
                              },
                              0
                            ]
                          }
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

              // COMPLETION %
              {
                $addFields: {
                  completion_percentage: {
                    $cond: [
                      {
                        $eq: ['$total_activity', 0]
                      },
                      0,
                      {
                        $round: [
                          {
                            $multiply: [
                              {
                                $divide: [
                                  '$completed_activity',
                                  '$total_activity'
                                ]
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

              // MODULE HAS COMPLETED
              {
                $addFields: {
                  has_completed: {
                    $cond: [
                      {
                        $ne: [
                          certificateId,
                          mongoose.Types.ObjectId.createFromHexString(
                            '6a153d4a393b1c736064377c'
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
                              {
                                $gt: ['$completed_activity', 0]
                              },
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

              // MODULE COMPLETED TIME
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
                  'programSchedule._id': {
                    $exists: true
                  },
                  isDateVisible: true
                }
              }
            ],
            as: 'modules'
          }
        },

        // CONTENT FOLDER MODULE COUNT
        {
          $addFields: {
            total_modules: {
              $size: '$modules'
            },

            completed_modules: {
              $size: {
                $filter: {
                  input: '$modules',
                  as: 'mod',
                  cond: {
                    $eq: ['$$mod.has_completed', true]
                  }
                }
              }
            }
          }
        },

        // CONTENT FOLDER COMPLETION %
        {
          $addFields: {
            completion_percentage: {
              $cond: [
                {
                  $eq: ['$total_modules', 0]
                },
                0,
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: ['$completed_modules', '$total_modules']
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

        // CONTENT FOLDER HAS COMPLETED
        {
          $addFields: {
            has_completed: {
              $cond: [
                {
                  $ne: [
                    certificateId,
                    mongoose.Types.ObjectId.createFromHexString(
                      '6a153d4a393b1c736064377c'
                    )
                  ]
                },
                false,
                {
                  $and: [
                    {
                      $gt: ['$total_modules', 0]
                    },
                    {
                      $eq: ['$completed_modules', '$total_modules']
                    }
                  ]
                }
              ]
            }
          }
        },

        // CONTENT FOLDER COMPLETED TIME
        {
          $addFields: {
            content_folder_completed_at: {
              $max: '$modules.module_completed_at'
            }
          }
        },
        {
          $match: {
            has_completed: true
          }
        }
      ])
    }

    return successResponse(res, 'Certificate fetched successfully', finalData)
  } catch (error) {
    next(error)
  }
}

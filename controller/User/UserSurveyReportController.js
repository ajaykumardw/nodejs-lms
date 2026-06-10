const mongoose = require('mongoose')

const User = require('../../model/User')
const Module = require('../../model/Module')
const UserSurveyReport = require('../../model/UserSurveyReport')
const { errorResponse, successResponse } = require('../../util/response')

const LearnerPoint = require('../../util/earnPoints')

exports.getSurveyDetail = async (req, res, next) => {
  try {
    const { moduleId } = req?.params
    const userId = req?.userId

    const user = await User.findById(userId)

    if (!user) {
      return errorResponse(res, 'User does not exist', {}, 404)
    }

    const masterId = user.created_by

    const modules = await Module.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId.createFromHexString(moduleId)
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
        $lookup: {
          from: 'activity',
          localField: '_id',
          foreignField: 'module_id',
          as: 'activities'
        }
      },
      {
        $addFields: {
          activities: {
            $filter: {
              input: '$activities',
              as: 'activity',
              cond: {
                $switch: {
                  branches: [
                    // Document
                    {
                      case: {
                        $eq: [
                          '$$activity.module_type_id',
                          mongoose.Types.ObjectId.createFromHexString(
                            '688723af5dd97f4ccae68834'
                          )
                        ]
                      },
                      then: {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: [
                                '$$activity.document_data.image_url',
                                ''
                              ]
                            }
                          },
                          0
                        ]
                      }
                    },

                    // Video
                    {
                      case: {
                        $eq: [
                          '$$activity.module_type_id',
                          mongoose.Types.ObjectId.createFromHexString(
                            '688723af5dd97f4ccae68835'
                          )
                        ]
                      },
                      then: {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: ['$$activity.video_data.video_url', '']
                            }
                          },
                          0
                        ]
                      }
                    },

                    // Youtube
                    {
                      case: {
                        $eq: [
                          '$$activity.module_type_id',
                          mongoose.Types.ObjectId.createFromHexString(
                            '688723af5dd97f4ccae68836'
                          )
                        ]
                      },
                      then: {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: ['$$activity.video_data.video_url', '']
                            }
                          },
                          0
                        ]
                      }
                    },

                    // SCORM
                    {
                      case: {
                        $eq: [
                          '$$activity.module_type_id',
                          mongoose.Types.ObjectId.createFromHexString(
                            '688723af5dd97f4ccae68837'
                          )
                        ]
                      },
                      then: {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: ['$$activity.scorm_data.folder_url', '']
                            }
                          },
                          0
                        ]
                      }
                    },

                    // Hide these module types
                    {
                      case: {
                        $in: [
                          '$$activity.module_type_id',
                          [
                            mongoose.Types.ObjectId.createFromHexString(
                              '688723af5dd97f4ccae68838'
                            ),
                            mongoose.Types.ObjectId.createFromHexString(
                              '688723af5dd97f4ccae68839'
                            ),
                            mongoose.Types.ObjectId.createFromHexString(
                              '688723af5dd97f4ccae6883a'
                            )
                          ]
                        ]
                      },
                      then: false
                    },

                    // Quiz
                    {
                      case: {
                        $eq: [
                          '$$activity.module_type_id',
                          mongoose.Types.ObjectId.createFromHexString(
                            '68886902954c4d9dc7a379bd'
                          )
                        ]
                      },
                      then: {
                        $gt: [
                          {
                            $size: {
                              $ifNull: ['$$activity.questions', []]
                            }
                          },
                          0
                        ]
                      }
                    }
                  ],
                  default: true
                }
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'activity_logs',
          let: {
            activityIds: '$activities._id'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$activity_id', '$$activityIds']
                }
              }
            }
          ],
          as: 'logs'
        }
      },
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
      {
        $addFields: {
          relativeEndDate: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$programSchedule.dueType', 'relative'] },
                  then: {
                    $dateAdd: {
                      startDate: '$programSchedule.published_date',
                      unit: 'day',
                      amount: {
                        $toInt: {
                          $ifNull: ['$programSchedule.dueDays', 0]
                        }
                      }
                    }
                  }
                },
                {
                  case: { $eq: ['$programSchedule.dueType', 'fixed'] },
                  then: '$programSchedule.dueDate.end_date'
                }
              ],
              default: null
            }
          }
        }
      }
    ])

    const module = modules?.[0]

    if (!module) {
      return errorResponse(res, 'Module does not exist', {}, 404)
    }

    const activities = module.activities || []
    const logs = module.logs || []

    const isCompleted =
      activities.length > 0 &&
      activities.every(activity =>
        logs.some(
          log =>
            log.activity_id.toString() === activity._id.toString() &&
            log.progress_status === '3'
        )
      )

    const moduleData = module
    moduleData.completed = isCompleted

    return successResponse(res, 'Module fetched successfully', moduleData)
  } catch (error) {
    next(error)
  }
}

exports.postSuveyDetail = async (req, res, next) => {
  try {
    const userId = req?.userId

    const { moduleId } = req?.params

    const { data } = req?.body

    const user = await User.findById(userId)

    if (!user) {
      return errorResponse(res, 'User does not exist', {}, 404)
    }

    const masterId = user.created_by

    const userSurvey = await UserSurveyReport.findOne({
      user_id: userId,
      module_id: moduleId
    })

    if (userSurvey) {
      await UserSurveyReport.findOneAndUpdate(
        {
          user_id: userId,
          module_id: moduleId
        },
        {
          created_by: userId,
          survey_data: data
        }
      )
    } else {
      const user_survey = new UserSurveyReport({
        module_id: moduleId,
        user_id: userId,
        survey_data: data,
        created_by: userId
      })

      await user_survey.save()
    }

    await LearnerPoint('6a1eba182ff5cb1b286b97c0', userId, moduleId)

    return successResponse(res, 'Survey completed for user')
  } catch (error) {
    next(error)
  }
}

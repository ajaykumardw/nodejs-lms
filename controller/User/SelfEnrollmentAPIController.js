const mongoose = require('mongoose')

const Module = require('../../model/Module')
const User = require('../../model/User')
const SelfEnroll = require('../../model/UserSelfEnroll')
const ModuleEnroll = require('../../model/UserModuleEnroll')
const ProgramSchedule = require('../../model/ProgramSchedule')

const { successResponse } = require('../../util/response')

exports.getSelfEnrollData = async (req, res, next) => {
  try {
    const userId = mongoose.Types.ObjectId.createFromHexString(req.userId)

    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 8
    const skip = (page - 1) * limit

    // Get enrolled module IDs
    const userSelfEnroll = await SelfEnroll.find({
      user_id: userId
    }).select('module_id')

    const moduleIds = userSelfEnroll.map(item => item.module_id)

    const LIVE_MODULE_TYPE_ID = mongoose.Types.ObjectId.createFromHexString(
      '688219557b6953e899cb57d3'
    )

    const now = new Date()

    const pipeline = [
      {
        $match: {
          _id: { $in: moduleIds }
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
          preserveNullAndEmptyArrays: false
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

      // Relative end date
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

      // Date visibility
      {
        $addFields: {
          isDateVisible: {
            $switch: {
              branches: [
                {
                  case: {
                    $eq: ['$programSchedule.dueType', 'relative']
                  },
                  then: {
                    $and: [
                      {
                        $lte: ['$programSchedule.published_date', now]
                      },
                      {
                        $gte: ['$relativeEndDate', now]
                      }
                    ]
                  }
                },
                {
                  case: {
                    $eq: ['$programSchedule.dueType', 'fixed']
                  },
                  then: {
                    $and: [
                      {
                        $lte: ['$programSchedule.dueDate.start_date', now]
                      },
                      {
                        $gte: ['$programSchedule.dueDate.end_date', now]
                      }
                    ]
                  }
                }
              ],
              default: true
            }
          }
        }
      },

      // Enrollment visibility
      {
        $addFields: {
          isVisible: {
            $cond: {
              if: {
                $eq: ['$programSchedule.pushEnrollmentSetting', 2]
              },
              then: {
                $eq: [{ $size: '$moduleEnroll' }, 0]
              },
              else: true
            }
          }
        }
      },

      // Live module visibility
      {
        $addFields: {
          isLiveModuleVisible: {
            $cond: [
              {
                $eq: ['$module_type_id', LIVE_MODULE_TYPE_ID]
              },
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

      {
        $addFields: {
          isUserNotEnrolled: {
            $eq: [{ $size: '$moduleEnroll' }, 0]
          }
        }
      },

      // FINAL FILTER
      {
        $match: {
          isLiveModuleVisible: true,
          isVisible: true,
          isDateVisible: true,
          isUserNotEnrolled: true
        }
      },

      // Remove duplicates if any
      {
        $group: {
          _id: '$_id',
          doc: { $first: '$$ROOT' }
        }
      },

      {
        $replaceRoot: {
          newRoot: '$doc'
        }
      },

      {
        $sort: {
          createdAt: -1
        }
      }
    ]

    // Total count after filters
    const totalResult = await Module.aggregate([
      ...pipeline,
      {
        $count: 'total'
      }
    ])

    const totalItems = totalResult[0]?.total || 0

    // Paginated data
    const modules = await Module.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: limit }
    ])

    return successResponse(res, 'Self enroll data fetched successfully', {
      data: modules,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit)
      }
    })
  } catch (error) {
    next(error)
  }
}

exports.getInsertSelfEnrollData = async (req, res, next) => {
  try {
    const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId)

    const { moduleId } = req?.params

    const programSchedule = await ProgramSchedule.findOne({
      module_id: moduleId
    })

    await ModuleEnroll.deleteMany({
      module_id: mongoose.Types.ObjectId.createFromHexString(moduleId),
      schedule_id: programSchedule._id,
      user_id: userId
    })

    const module_enroll = new ModuleEnroll({
      module_id: mongoose.Types.ObjectId.createFromHexString(moduleId),
      schedule_id: programSchedule._id,
      user_id: userId,
      created_by: userId,
      created_at: Date.now()
    })

    await module_enroll.save()

    await SelfEnroll.deleteMany({
      module_id: mongoose.Types.ObjectId.createFromHexString(moduleId),
      user_id: userId
    })

    return successResponse(res, 'Self enroll data saved successfully')
  } catch (error) {
    next(error)
  }
}

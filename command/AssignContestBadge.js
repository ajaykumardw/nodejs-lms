const mongoose = require('mongoose')

const Module = require('../model/Module')
const ContestBadge = require('../model/ContestBadge')
const LearnerPoint = require('../model/LearnerPoints')
const ProgramSchedule = require('../model/ProgramSchedule')
const ActivityLog = require('../model/ActivityFolderReport')

const calculateStreak = dates => {
  if (!dates.length) return 0

  const dateSet = new Set(
    dates.map(date => {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      return d.toISOString().split('T')[0]
    })
  )

  let streak = 0

  const currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)

  while (dateSet.has(currentDate.toISOString().split('T')[0])) {
    streak++
    currentDate.setDate(currentDate.getDate() - 1)
  }

  return streak
}

const getLearningStreakLearners = async (learnerIds, masterId) => {
  try {
    const schedules = await ProgramSchedule.find({
      company_id: masterId
    })
      .select('module_id activity_id dueDate dueType published_date dueDays')
      .lean()

    const logs = await ActivityLog.find({
      user_id: {
        $in: learnerIds
      },
      is_completed: true
    })
      .select('user_id module_id activity_id completed_at_time')
      .lean()

    const qualifiedLearners = []

    for (const learnerId of learnerIds) {
      const learnerLogs = logs.filter(
        log => log.user_id.toString() === learnerId.toString()
      )

      const streakDays = calculateStreak(
        learnerLogs
          .filter(log => log.completed_at_time)
          .map(log => log.completed_at_time)
      )

      let overdueCount = 0

      let assignedModules = 0

      let onTimeCompleted = 0

      for (const schedule of schedules) {
        const dueType = schedule?.dueType
        const publishDate = schedule?.published_date
        const dueDay = schedule?.dueDays

        let dueDate = schedule?.dueDate?.end_date

        if (dueType === 'relative' && publishDate && dueDay) {
          // 1. Convert the ISO string into a proper JavaScript Date object
          const dateInstance = new Date(publishDate)

          // 2. Parse dueDay to an integer (e.g., "50" becomes 50)
          const daysToAdd = parseInt(dueDay, 10)

          // 3. Add the days to the date object
          dateInstance.setDate(dateInstance.getDate() + daysToAdd)

          // 4. Assign the final result back in ISO format (or a regular Date object if required)
          dueDate = dateInstance.toISOString()
        }

        if (!dueDate) continue

        assignedModules++

        const moduleLogs = learnerLogs.filter(
          log => log.module_id?.toString() === schedule.module_id?.toString()
        )

        const latestCompletion = moduleLogs
          .filter(log => log.completed_at_time)
          .sort(
            (a, b) =>
              new Date(b.completed_at_time) - new Date(a.completed_at_time)
          )[0]

        // not completed and overdue
        if (!latestCompletion) {
          if (new Date() > dueDate) {
            overdueCount++
          }

          continue
        }

        // completed after due date
        if (latestCompletion.completed_at_time > dueDate) {
          overdueCount++
        } else {
          onTimeCompleted++
        }
      }

      const onTimePercentage =
        assignedModules === 0
          ? 0
          : Math.round((onTimeCompleted / assignedModules) * 100)

      const isQualified =
        streakDays >= 30 && overdueCount === 0 && onTimePercentage >= 90

      if (isQualified) {
        qualifiedLearners.push({
          user_id: learnerId,
          streakDays,
          overdueCount,
          onTimePercentage
        })
      }
    }

    return qualifiedLearners
  } catch (error) {
    throw new Error(error.message)
  }
}

const getMostImprovedLearner = async learnerIds => {
  const now = new Date()

  // Current Month
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Previous Month
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

  const result = await LearnerPoint.aggregate([
    {
      $match: {
        user_id: {
          $in: learnerIds
        }
      }
    },

    {
      $group: {
        _id: '$user_id',

        currentMonthPoints: {
          $sum: {
            $cond: [
              {
                $gte: ['$created_at', currentMonthStart]
              },
              '$learner_point',
              0
            ]
          }
        },

        previousMonthPoints: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gte: ['$created_at', previousMonthStart]
                  },
                  {
                    $lt: ['$created_at', previousMonthEnd]
                  }
                ]
              },
              '$learner_point',
              0
            ]
          }
        }
      }
    },

    {
      $project: {
        user_id: '$_id',
        improvement: {
          $subtract: ['$currentMonthPoints', '$previousMonthPoints']
        },
        currentMonthPoints: 1,
        previousMonthPoints: 1
      }
    },

    {
      $sort: {
        improvement: -1
      }
    },

    {
      $limit: 1
    }
  ])

  // Winner found
  if (result.length > 0) {
    return result[0].user_id
  }

  // Fallback → alphabetical first learner
  const firstUser = await User.findOne({
    _id: { $in: learnerIds }
  })
    .sort({
      first_name: 1,
      last_name: 1
    })
    .select('_id')

  return firstUser?._id || null
}

const getDifficultCertificate = async (learnerIds, masterId) => {
  let activityIds = []

  const programSchedule = await ProgramSchedule.findOne({
    company_id: masterId
  })

  if (programSchedule) {
    activityIds.push(...programSchedule.activity_id)
  }

  const modules = await Module.aggregate([
    {
      $match: {
        created_by: masterId
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
        let: {
          moduleId: '$_id'
        },
        pipeline: [
          {
            $match: {
              _id: {
                $in: activityIds
              },
              $expr: {
                $eq: ['$module_id', '$$moduleId']
              }
            }
          },

          // Questions for each activity
          {
            $lookup: {
              from: 'questions',
              localField: '_id',
              foreignField: 'activity_id',
              as: 'questions'
            }
          }
        ],
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
                            $ifNull: ['$$activity.document_data.image_url', '']
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

                  // Hidden types
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
    }
  ])

  const activities = modules?.activities || []
  const logs = modules?.logs || []

  const isPreCompleted =
    activities.length > 0 &&
    activities.every(activity =>
      logs.some(
        log =>
          log.activity_id.toString() === activity._id.toString() &&
          log.progress_status === '3'
      )
    )
}

const AnnounceBadgeResult = async () => {
  try {
    const topLearnerBadgeId = mongoose.Types.ObjectId.createFromHexString(
      '6a2018630ac3ae2a79e47dd9'
    )

    const difficultAssessmentBadgeId =
      mongoose.Types.ObjectId.createFromHexString('6a2018630ac3ae2a79e47dda')

    const learningStreakBadgeId = mongoose.Types.ObjectId.createFromHexString(
      '6a2018630ac3ae2a79e47ddb'
    )

    const improvedLearnerBadgeId = mongoose.Types.ObjectId.createFromHexString(
      '6a2018630ac3ae2a79e47ddc'
    )

    const imperiumEagleBadgeId = mongoose.Types.ObjectId.createFromHexString(
      '6a2018630ac3ae2a79e47ddd'
    )

    const now = new Date()

    const today = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)

    const contest_badge = await ContestBadge.aggregate([
      {
        $match: {
          start_date: { $lte: today },
          end_date: { $gte: today },
          is_result_announced: { $in: [false, null] }
        }
      },
      {
        $lookup: {
          from: 'user_contest_badge_enroll',
          localField: '_id',
          foreignField: 'contest_badge_id',
          as: 'badge_enroll'
        }
      },
      {
        $lookup: {
          from: 'user_contest_badge_enroll',
          let: { contestId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$contest_badge_id', '$$contestId']
                }
              }
            },

            // Get user details
            {
              $lookup: {
                from: 'users',
                localField: 'user_id',
                foreignField: '_id',
                as: 'user'
              }
            },
            {
              $unwind: '$user'
            },

            // Get user points
            {
              $lookup: {
                from: 'contest_learner_points',
                let: {
                  userId: '$user_id',
                  contestId: '$contest_badge_id'
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$user_id', '$$userId'] },
                          { $eq: ['$contest_id', '$$contestId'] }
                        ]
                      }
                    }
                  },
                  {
                    $group: {
                      _id: null,
                      totalPoints: {
                        $sum: '$learner_point'
                      }
                    }
                  }
                ],
                as: 'points'
              }
            },

            // Assign 0 if no points found
            {
              $addFields: {
                totalPoints: {
                  $ifNull: [{ $arrayElemAt: ['$points.totalPoints', 0] }, 0]
                }
              }
            },

            // Sort by points desc, then name asc
            {
              $sort: {
                totalPoints: -1,
                'user.first_name': 1,
                'user.last_name': 1
              }
            },

            {
              $project: {
                _id: 0,
                user_id: 1,
                totalPoints: 1,
                first_name: '$user.first_name',
                last_name: '$user.last_name'
              }
            }
          ],
          as: 'leaderboard'
        }
      },
      {
        $project: {
          leaderboard: 1,
          contest_name: 1,
          badge_id: 1,
          created_by: 1
        }
      }
    ])

    // Generate rank in Node.js
    contest_badge.forEach(contest => {
      contest.leaderboard = contest.leaderboard.map((user, index) => ({
        ...user,
        rank: index + 1
      }))
    })

    let finalData = []

    for (const cb of contest_badge) {
      const masterId = cb?.created_by
      const badgeId = cb?.badge_id
      const contestId = cb?._id
      const leaderboard = cb?.leaderboard || []

      const topLearner = leaderboard?.[0]

      const learnerIds = leaderboard.map(lb => lb?.user_id)

      const topLearnerRank = Math.trunc(leaderboard?.length / 100)

      const topLearnersList = leaderboard.slice(0, topLearnerRank)

      const mostImprovedLearner = await getMostImprovedLearner(learnerIds)

      const getStreakLearners = await getLearningStreakLearners(
        learnerIds,
        masterId
      )

      //This is the code for diamond vanguard
      if (
        topLearnersList?.length > 0 &&
        badgeId.some(id => id.toString() === topLearnerBadgeId.toString())
      ) {
        const data = topLearnersList.map(tL => ({
          user_id: tL.user_id,
          badge_id: topLearnerBadgeId,
          contest_id: contestId,
          created_by: tL?.user_id
        }))

        finalData.push(...data)
      }

      //This is for the dragon heart
      if (
        badgeId.some(
          id => id.toString() === difficultAssessmentBadgeId.toString()
        )
      ) {
      }

      //This code is for ghost walker
      if (
        getStreakLearners?.length > 0 &&
        badgeId.some(id => id.toString() === learningStreakBadgeId.toString())
      ) {
        const datas = getStreakLearners.map(sl => ({
          user_id: sl?.user_id,
          contest_id: contestId,
          badge_id: learningStreakBadgeId,
          created_by: sl?.user_id
        }))

        finalData.push(...datas)
      }

      //This is the code for Phoenix Ascendant
      if (
        mostImprovedLearner &&
        badgeId.some(id => id.toString() === improvedLearnerBadgeId.toString())
      ) {
        finalData.push({
          user_id: mostImprovedLearner,
          contest_id: contestId,
          badge_id: improvedLearnerBadgeId,
          created_by: mostImprovedLearner
        })
      }

      //This is the code for imperium eagle badge
      if (
        topLearner &&
        badgeId.some(id => id.toString() === imperiumEagleBadgeId.toString())
      ) {
        const topLearnerId = topLearner?.user_id

        finalData.push({
          user_id: topLearnerId,
          contest_id: contestId,
          badge_id: imperiumEagleBadgeId,
          created_by: topLearnerId
        })
      }

      console.log('Final data', finalData)
    }
  } catch (error) {
    throw new Error(error.message)
  }
}

module.exports = AnnounceBadgeResult

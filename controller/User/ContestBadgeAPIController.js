const mongoose = require('mongoose') // Added for ObjectId casting if needed

const User = require('../../model/User')
const ContestBadge = require('../../model/ContestBadge')
const AppConfig = require('../../model/AppConfig')
const LeaderboardConfig = require('../../model/LeaderboadConfig')
const UserContestEnroll = require('../../model/UserContestBadgeEnroll')
const { errorResponse, successResponse } = require('../../util/response')

exports.getContestBoardData = async (req, res, next) => {
  try {
    const now = new Date()

    const today = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)

    const userId = req?.userId

    if (!userId) {
      return errorResponse(res, 'User ID is missing from request', {}, 400)
    }

    const user = await User.findById(userId).select('_id first_name last_name')

    const leaderboardConfig = await LeaderboardConfig.find({
      created_by: user?.created_by
    }).lean()

    const appConfig = await AppConfig.findOne({
      type: 'leadership_data'
    }).lean()

    const badgeConfig = await AppConfig.findOne({
      type: 'badge_data'
    }).lean()

    const badgeData = badgeConfig?.badge_data

    const leadershipData = appConfig?.leadership_data || []

    // Create lookup map
    const configMap = new Map(
      leaderboardConfig.map(item => [item.label_id.toString(), item.value])
    )

    // Replace label_data value with user's configured value
    const updatedLeadershipData = leadershipData.map(section => ({
      ...section,
      label_data: section.label_data.map(label => ({
        ...label,
        value: configMap.get(label._id.toString()) ?? label.value
      }))
    }))

    const userContest = await UserContestEnroll.find({
      user_id: userId
    })

    const userContestIds = userContest.map(uc => uc.contest_badge_id)

    const contest_badge = await ContestBadge.aggregate([
      {
        $match: {
          _id: { $in: userContestIds },
          start_date: { $lte: today },
          end_date: { $gte: today }
        }
      },
      // Get all enrolled users
      {
        $lookup: {
          from: 'user_contest_badge_enroll',
          localField: '_id',
          foreignField: 'contest_badge_id',
          as: 'badge_enroll'
        }
      },
      // Build leaderboard
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
                badgeEarnedCount: -1,
                'user.first_name': 1,
                'user.last_name': 1
              }
            },
            {
              $lookup: {
                from: 'contest_badge_earned',
                let: {
                  userId: '$user_id',
                  contestId: '$contest_badge_id'
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: ['$user_id', '$$userId']
                          },
                          {
                            $eq: ['$contest_id', '$$contestId']
                          }
                        ]
                      }
                    }
                  },
                  {
                    $project: {
                      _id: 1,
                      badge_id: 1,
                      contest_id: 1,
                      user_id: 1,
                      created_at: 1
                    }
                  }
                ],
                as: 'badge_earned'
              }
            },
            {
              $addFields: {
                badgeEarnedCount: {
                  $size: {
                    $ifNull: ['$badge_earned', []]
                  }
                }
              }
            },
            {
              $project: {
                _id: 0,
                user_id: 1,
                totalPoints: 1,
                first_name: '$user.first_name',
                last_name: '$user.last_name',
                badge_earned: 1,
                badgeEarnedCount: 1
              }
            }
          ],
          as: 'leaderboard'
        }
      },
      {
        $addFields: {
          remainingSeconds: {
            $max: [
              {
                $dateDiff: {
                  startDate: today,
                  endDate: '$end_date',
                  unit: 'second'
                }
              },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          days: {
            $floor: {
              $divide: ['$remainingSeconds', 86400]
            }
          },
          hours: {
            $floor: {
              $mod: [{ $divide: ['$remainingSeconds', 3600] }, 24]
            }
          },
          minutes: {
            $floor: {
              $mod: [{ $divide: ['$remainingSeconds', 60] }, 60]
            }
          }
        }
      },
      {
        $addFields: {
          remainingTime: {
            $concat: [
              { $toString: '$days' },
              ' Days ',
              { $toString: '$hours' },
              ' Hours'
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'contest_badge_earned',
          let: {
            user_id: mongoose.Types.ObjectId.createFromHexString(userId),
            contest_id: '$_id'
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
                      $eq: ['$contest_id', '$$contest_id']
                    }
                  ]
                }
              }
            }
          ],
          as: 'badge_earned'
        }
      },
      {
        $lookup: {
          from: 'app_config',
          pipeline: [
            {
              $match: {
                type: 'badge_data'
              }
            },
            {
              $project: {
                badge_data: 1
              }
            }
          ],
          as: 'badge_config'
        }
      },
      {
        $addFields: {
          badge_config: {
            $ifNull: [
              {
                $arrayElemAt: ['$badge_config.badge_data', 0]
              },
              []
            ]
          }
        }
      },
      {
        $addFields: {
          badge_earned: {
            $map: {
              input: '$badge_earned',
              as: 'earned',
              in: {
                $mergeObjects: [
                  '$$earned',
                  {
                    badge_detail: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$badge_config',
                            as: 'badge',
                            cond: {
                              $eq: ['$$badge._id', '$$earned.badge_id']
                            }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          badgeEarnedCount: {
            $size: {
              $ifNull: ['$badge_earned', []]
            }
          }
        }
      },
      {
        $addFields: {
          contest_status: {
            $switch: {
              branches: [
                {
                  // Upcoming
                  case: {
                    $gt: ['$start_date', today]
                  },
                  then: 'Upcoming'
                },
                {
                  // Live
                  case: {
                    $and: [
                      { $lte: ['$start_date', today] },
                      { $gte: ['$end_date', today] }
                    ]
                  },
                  then: 'Live'
                },
                {
                  // Result Processing
                  case: {
                    $and: [
                      { $lt: ['$end_date', today] },
                      { $eq: ['$is_result_announced', false] }
                    ]
                  },
                  then: 'Result Processing'
                },
                {
                  // Result Announced
                  case: {
                    $and: [
                      { $lt: ['$end_date', today] },
                      { $eq: ['$is_result_announced', true] }
                    ]
                  },
                  then: 'Result Announced'
                }
              ],
              default: 'Unknown'
            }
          }
        }
      },
      {
        $project: {
          leaderboard: 1,
          contest_name: 1,
          badge_id: 1,
          completion_status: 1,
          is_contest_end: 1,
          badge_enroll: 1,
          remainingTime: 1,
          badge_earned: 1,
          badgeEarnedCount: 1,
          contest_status: 1
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

    const currentUserId = userId.toString()

    contest_badge.forEach(contest => {
      let previous = null
      let currentRank = 0

      contest.leaderboard = contest.leaderboard.map((user, index) => {
        if (
          !previous ||
          previous.totalPoints !== user.totalPoints ||
          previous.badgeEarnedCount !== user.badgeEarnedCount
        ) {
          currentRank = index + 1
        }

        previous = user

        return {
          ...user,
          rank: currentRank
        }
      })
    })

    contest_badge.forEach(contest => {
      const leaderboard = contest.leaderboard

      const currentIndex = leaderboard.findIndex(
        item => item.user_id.toString() === currentUserId
      )

      if (currentIndex !== -1) {
        contest.currentUser = leaderboard[currentIndex]

        // User above current user
        contest.nextUser =
          currentIndex > 0 ? leaderboard[currentIndex - 1] : null
      } else {
        contest.currentUser = null
        contest.nextUser = null
      }
    })

    const finalData = {
      contest_badge,
      user,
      leaderPoint: updatedLeadershipData,
      badgeData
    }

    return successResponse(res, 'Contest badge fetched successfully', finalData)
  } catch (error) {
    next(error)
  }
}

const mongoose = require('mongoose')
const AppConfig = require('../../model/AppConfig')
const LeaderboardConfig = require('../../model/LeaderboadConfig')
const Zone = require('../../model/Zone')
const department = require('../../model/Department')
const designation = require('../../model/Designation')
const group = require('../../model/Group')
const user = require('../../model/User')
const ContestBadge = require('../../model/ContestBadge')
const contestBadgeScheduleType = require('../../model/ContestScheduleType')
const contestBadgeScheduleUser = require('../../model/ContestBadgeScheduleUser')
const userContestBadgeEnroll = require('../../model/UserContestBadgeEnroll')
const { errorResponse, successResponse } = require('../../util/response')

exports.getLeaderboardDataAPI = async (req, res, next) => {
  try {
    const userId = req?.userId

    const leaderboardConfig = await LeaderboardConfig.find({
      created_by: userId
    }).lean()

    const appConfig = await AppConfig.findOne({
      type: 'leadership_data'
    }).lean()

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

    return successResponse(
      res,
      'Leaderboard data retrieved successfully',
      updatedLeadershipData
    )
  } catch (error) {
    next(error)
  }
}

exports.postLeaderboardConfigAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const { leaderboard_data } = req.body

    // Remove old configuration
    await LeaderboardConfig.deleteMany({
      created_by: userId
    })

    // Prepare documents
    const configs = leaderboard_data.map(data => ({
      label_id: data.label_id,
      value: data.value,
      created_by: userId,
      created_at: new Date()
    }))

    // Insert new configuration
    await LeaderboardConfig.insertMany(configs)

    return successResponse(res, 'Leaderboard config saved successfully')
  } catch (error) {
    next(error)
  }
}

exports.getContestBadgeDataControllerAPI = async (req, res, next) => {
  try {
    const userId = req?.userId

    const contestBadge = await ContestBadge.aggregate([
      {
        $match: {
          created_by: mongoose.Types.ObjectId.createFromHexString(userId)
        }
      },

      {
        $lookup: {
          from: 'user_contest_badge_enroll',
          localField: '_id',
          foreignField: 'contest_badge_id',
          as: 'user_contest_badge_enroll'
        }
      },

      {
        $lookup: {
          from: 'app_config',
          let: {
            badgeIds: '$badge_id'
          },
          pipeline: [
            {
              $match: {
                type: 'badge_data'
              }
            },
            {
              $unwind: '$badge_data'
            },
            {
              $match: {
                $expr: {
                  $in: ['$badge_data._id', '$$badgeIds']
                }
              }
            },
            {
              $replaceRoot: {
                newRoot: '$badge_data'
              }
            }
          ],
          as: 'badges'
        }
      }
    ])

    return successResponse(
      res,
      'Contest Badge fetched successfully',
      contestBadge
    )
  } catch (error) {
    next(error)
  }
}

exports.getContestBadgeCreateDataAPI = async (req, res, next) => {
  try {
    const userId = req?.userId

    const finalData = {}

    const objectId = mongoose.Types.ObjectId.createFromHexString(userId)

    const regions = await Zone.aggregate([
      {
        $match: { created_by: objectId } // filter zones created by this user
      },
      {
        $unwind: '$region' // split region array into individual docs
      },
      {
        $replaceRoot: { newRoot: '$region' } // keep only region data
      }
    ])

    finalData['department'] = await department.find({
      created_by: userId,
      status: true
    })

    finalData['designation'] = await designation.find({
      company_id: userId,
      status: true
    })

    finalData['group'] = await group.find({ company_id: userId, status: true })

    finalData['user'] = await user
      .find({ created_by: userId, status: true })
      .populate('company_id')

    finalData['region'] = regions

    const appConfig = await AppConfig.findOne({
      type: 'badge_data'
    })

    const badgeData = appConfig?.badge_data || []

    finalData['badges'] = badgeData

    return successResponse(res, 'Badge data retrieved successfully', finalData)
  } catch (error) {
    next(error)
  }
}

exports.postContestBadgeControllerAPI = async (req, res, next) => {
  try {
    const userId = req?.userId

    const {
      contest_name,
      start_date,
      end_date,
      targetOptionPairs,
      badges,
      status
    } = req.body

    const contest_badge = new ContestBadge({
      contest_name,
      badge_id: badges,
      start_date,
      end_date,
      target_pair: targetOptionPairs,
      created_by: userId,
      status,
      created_at: Date.now()
    })

    await contest_badge.save()

    const contestScheduleType = []

    for (const pair of targetOptionPairs) {
      if (!pair.target || !Array.isArray(pair.options)) continue

      for (const optionId of pair.options) {
        contestScheduleType.push({
          created_by: userId,
          contest_badge_id: contest_badge?._id,
          type: Number(pair.target),
          type_id: mongoose.Types.ObjectId.isValid(optionId)
            ? mongoose.Types.ObjectId.createFromHexString(optionId)
            : optionId
        })
      }
    }

    if (contestScheduleType.length === 0) {
      return successResponse(res, 'Settings saved successfully')
    }

    await contestBadgeScheduleType.insertMany(contestScheduleType)

    const bulkUsers = []
    const finalUserSet = new Set()

    for (const item of contestScheduleType) {
      const { type, type_id } = item

      let targetUsers = []

      switch (type) {
        case 1:
          targetUsers = await user
            .find({ designation_id: type_id })
            .select('_id')
          break
        case 2:
          targetUsers = await user
            .find({ department_id: type_id })
            .select('_id')
          break
        case 3:
          targetUsers = await user.find({ group_id: type_id }).select('_id')
          break
        case 4:
          targetUsers = await user.find({ region_id: type_id }).select('_id')
          break
        case 5:
          finalUserSet.add(type_id.toString())
          continue
      }

      for (const u of targetUsers) {
        finalUserSet.add(u._id.toString())
        bulkUsers.push({
          created_by: userId,
          contest_badge_id: contest_badge?._id,
          type,
          type_id,
          user_id: u._id
        })
      }
    }

    if (bulkUsers.length) {
      await contestBadgeScheduleUser.insertMany(bulkUsers)
    }

    const finalUsers = [...finalUserSet].map(id => ({
      user_id: mongoose.Types.ObjectId.createFromHexString(id),
      contest_badge_id: contest_badge?._id,
      created_by: userId,
      created_at: Date.now()
    }))

    await userContestBadgeEnroll.deleteMany({
      created_by: userId,
      contest_badge_id: contest_badge?._id
    })

    await userContestBadgeEnroll.insertMany(finalUsers)

    return successResponse(res, 'Contest badge saved successfully')
  } catch (error) {
    next(error)
  }
}

exports.getContestBadgeEditController = async (req, res, next) => {
  try {
    const userId = req?.userId

    const { id } = req?.params

    const contestBadge = await ContestBadge.findOne({
      created_by: userId,
      _id: id
    })

    return successResponse(
      res,
      'Contest badge edit data fetched successfully',
      contestBadge
    )
  } catch (error) {
    next(error)
  }
}

exports.putContestBadgeController = async (req, res, next) => {
  try {
    const userId = req?.userId
    const { id } = req?.params

    const contestBadgeId = mongoose.Types.ObjectId.createFromHexString(id)

    const {
      contest_name,
      start_date,
      end_date,
      targetOptionPairs,
      badges,
      status
    } = req?.body

    const existContestBadge = await ContestBadge.findOne({
      created_by: userId,
      _id: id
    })

    if (!existContestBadge) {
      return errorResponse(res, 'Contest badge not found', {}, 404)
    }

    await ContestBadge.findOneAndUpdate(
      {
        created_by: userId,
        _id: id
      },
      {
        contest_name,
        badge_id: badges,
        start_date,
        end_date,
        target_pair: targetOptionPairs,
        created_by: userId,
        status,
        updated_by: userId,
        update_at: Date.now()
      }
    )

    await contestBadgeScheduleType.deleteMany({
      created_by: userId,
      contest_badge_id: contestBadgeId
    })

    await contestBadgeScheduleUser.deleteMany({
      created_by: userId,
      contest_badge_id: contestBadgeId
    })

    const contestScheduleType = []

    for (const pair of targetOptionPairs) {
      if (!pair.target || !Array.isArray(pair.options)) continue

      for (const optionId of pair.options) {
        contestScheduleType.push({
          created_by: userId,
          contest_badge_id: contestBadgeId,
          type: Number(pair.target),
          type_id: mongoose.Types.ObjectId.isValid(optionId)
            ? mongoose.Types.ObjectId.createFromHexString(optionId)
            : optionId
        })
      }
    }

    if (contestScheduleType.length === 0) {
      return successResponse(res, 'Settings saved successfully')
    }

    await contestBadgeScheduleType.insertMany(contestScheduleType)

    const bulkUsers = []
    const finalUserSet = new Set()

    for (const item of contestScheduleType) {
      const { type, type_id } = item

      let targetUsers = []

      switch (type) {
        case 1:
          targetUsers = await user
            .find({ designation_id: type_id })
            .select('_id')
          break
        case 2:
          targetUsers = await user
            .find({ department_id: type_id })
            .select('_id')
          break
        case 3:
          targetUsers = await user.find({ group_id: type_id }).select('_id')
          break
        case 4:
          targetUsers = await user.find({ region_id: type_id }).select('_id')
          break
        case 5:
          finalUserSet.add(type_id.toString())
          continue
      }

      for (const u of targetUsers) {
        finalUserSet.add(u._id.toString())
        bulkUsers.push({
          created_by: userId,
          contest_badge_id: contestBadgeId,
          type,
          type_id,
          user_id: u._id
        })
      }
    }

    if (bulkUsers.length) {
      await contestBadgeScheduleUser.insertMany(bulkUsers)
    }

    const finalUsers = [...finalUserSet].map(id => ({
      user_id: mongoose.Types.ObjectId.createFromHexString(id),
      contest_badge_id: contestBadgeId,
      created_by: userId,
      created_at: Date.now()
    }))

    await userContestBadgeEnroll.deleteMany({
      created_by: userId,
      contest_badge_id: contestBadgeId
    })

    await userContestBadgeEnroll.insertMany(finalUsers)

    return successResponse(res, 'Content Badge updated successfully')
  } catch (error) {
    next(error)
  }
}

exports.deleteContestBadgeController = async (req, res, next) => {
  try {
    const userId = req?.userId
    const { id } = req?.params

    const contestBadgeId = mongoose.Types.ObjectId.createFromHexString(id)

    await ContestBadge.findOneAndDelete({
      created_by: userId,
      _id: contestBadgeId
    })

    await contestBadgeScheduleType.deleteMany({
      created_by: userId,
      contest_badge_id: contestBadgeId
    })

    await contestBadgeScheduleUser.deleteMany({
      created_by: userId,
      contest_badge_id: contestBadgeId
    })

    await userContestBadgeEnroll.deleteMany({
      created_by: userId,
      contest_badge_id: contestBadgeId
    })

    return successResponse(res, 'Contest badge deleted successfully')
  } catch (error) {
    next(error)
  }
}

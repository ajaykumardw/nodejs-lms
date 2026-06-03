const AppConfig = require('../../model/AppConfig')
const LeaderboardConfig = require('../../model/LeaderboadConfig')
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

const User = require('../model/User')
const AppConfig = require('../model/AppConfig')
const ContestBadge = require('../model/ContestBadge')
const LoginSession = require('../model/LoginSession')
const LearnerPoint = require('../model/LearnerPoints')
const ContestLearnerPoint = require('../model/ContestLearnerPoints')
const UserContestEnroll = require('../model/UserContestBadgeEnroll')
const LeaderboardConfig = require('../model/LeaderboadConfig')

const fetchLeaderboardPoints = async (masterId, leaderboardId) => {
  const leaderboardConfig = await LeaderboardConfig.findOne({
    created_by: masterId,
    label_id: leaderboardId
  }).lean()

  const appConfig = await AppConfig.findOne({
    type: 'leadership_data'
  }).lean()

  const leadershipData = appConfig?.leadership_data || []

  for (const section of leadershipData) {
    const label = section.label_data.find(
      item => item._id.toString() === leaderboardId.toString()
    )

    if (label) {
      return leaderboardConfig?.value ?? label.value
    }
  }

  return 0
}

const saveContestLearnerPoint = async (
  userId,
  leaderboardId,
  contestBadge,
  learnerPoint,
  moduleId = null,
  activityId = null,
  moduleTypeId = null,
  isNotUnique = false
) => {
  try {
    if (!contestBadge?.length) return

    let contestPoints = []

    if (isNotUnique) {
      contestPoints = contestBadge.map(cB => ({
        contest_id: cB._id,
        user_id: userId,
        leaderboard_id: leaderboardId,
        learner_point: learnerPoint,
        created_by: userId,
        module_id: moduleId,
        activity_id: activityId,
        module_type_id: moduleTypeId,
        created_at: Date.now()
      }))
    } else {
      const contestIds = contestBadge.map(cB => cB._id)

      const existingRecords = await ContestLearnerPoint.find({
        contest_id: { $in: contestIds },
        user_id: userId,
        leaderboard_id: leaderboardId,
        created_by: userId,
        module_id: moduleId,
        activity_id: activityId,
        module_type_id: moduleTypeId
      }).select('contest_id')

      const existingContestIds = new Set(
        existingRecords.map(record => record.contest_id.toString())
      )

      contestPoints = contestBadge
        .filter(cB => !existingContestIds.has(cB._id.toString()))
        .map(cB => ({
          contest_id: cB._id,
          user_id: userId,
          leaderboard_id: leaderboardId,
          learner_point: learnerPoint,
          created_by: userId,
          module_id: moduleId,
          activity_id: activityId,
          module_type_id: moduleTypeId,
          created_at: Date.now()
        }))
    }

    if (contestPoints.length) {
      await ContestLearnerPoint.insertMany(contestPoints)
    }
  } catch (error) {
    throw error
  }
}

const saveLearnerPoint = async (
  leaderboardId,
  userId,
  learnerPoint,
  moduleId = null,
  activityId = null,
  moduleTypeId = null,
  isNotUnique = false
) => {
  try {
    if (isNotUnique) {
      await LearnerPoint.create({
        leaderboard_id: leaderboardId,
        user_id: userId,
        activity_id: activityId,
        module_id: moduleId,
        learner_point: learnerPoint,
        module_type_id: moduleTypeId,
        created_by: userId,
        created_at: Date.now()
      })

      return
    }

    const existLearnerPoint = await LearnerPoint.findOne({
      leaderboard_id: leaderboardId,
      user_id: userId,
      activity_id: activityId,
      module_id: moduleId,
      module_type_id: moduleTypeId,
      created_by: userId
    })

    if (!existLearnerPoint) {
      await LearnerPoint.create({
        leaderboard_id: leaderboardId,
        user_id: userId,
        activity_id: activityId,
        module_id: moduleId,
        learner_point: learnerPoint,
        module_type_id: moduleTypeId,
        created_by: userId,
        created_at: Date.now()
      })
    }
  } catch (error) {
    throw new Error(error)
  }
}

const LearnerPoints = async (
  leaderboardId,
  userId,
  moduleId = null,
  activityId = null,
  moduleTypeId = null,
  isNotUnique = false
) => {
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const now = new Date()

    const today = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)

    const user = await User.findById(userId).lean()
    const masterId = user?.created_by

    const userContest = await UserContestEnroll.find({
      user_id: userId
    }).lean()

    const contestIds = userContest.map(
      enrollment => enrollment.contest_badge_id
    )

    const contestBadge = await ContestBadge.find({
      _id: {
        $in: contestIds
      },
      start_date: {
        $lte: today
      },
      end_date: {
        $gte: today
      }
    }).lean()

    const learnerPoint = await fetchLeaderboardPoints(masterId, leaderboardId)

    if (leaderboardId === '6a1eba182ff5cb1b286b97b4') {
      const existLogSession = await LoginSession.findOne({
        user_id: userId,
        session_type: '1',
        activity_time: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      })

      if (!existLogSession) {
        await saveLearnerPoint(
          leaderboardId,
          userId,
          learnerPoint,
          null,
          null,
          null,
          isNotUnique
        )

        await saveContestLearnerPoint(
          userId,
          leaderboardId,
          contestBadge,
          learnerPoint,
          null,
          null,
          null,
          isNotUnique
        )
      }
    } else if (leaderboardId === '6a1eba182ff5cb1b286b97b5') {
      const existLogSession = await LoginSession.findOne({
        user_id: userId,
        session_type: '1'
      })

      if (!existLogSession) {
        await saveLearnerPoint(
          leaderboardId,
          userId,
          learnerPoint,
          null,
          null,
          null,
          isNotUnique
        )

        await saveContestLearnerPoint(
          userId,
          leaderboardId,
          contestBadge,
          learnerPoint,
          null,
          null,
          null,
          isNotUnique
        )
      }
    } else if (
      leaderboardId == '6a1eba182ff5cb1b286b97b7' ||
      leaderboardId == '6a1eba182ff5cb1b286b97c0' ||
      leaderboardId == '6a1eba182ff5cb1b286b97b8'
    ) {
      await saveLearnerPoint(
        leaderboardId,
        userId,
        learnerPoint,
        moduleId,
        null,
        null,
        isNotUnique
      )

      await saveContestLearnerPoint(
        userId,
        leaderboardId,
        contestBadge,
        learnerPoint,
        moduleId,
        null,
        null,
        isNotUnique
      )
    } else if (
      leaderboardId == '6a1eba182ff5cb1b286b97ba' ||
      leaderboardId == '6a1eba182ff5cb1b286b97bd' ||
      leaderboardId == '6a1eba182ff5cb1b286b97be' ||
      leaderboardId == '6a1eba182ff5cb1b286b97bb' ||
      leaderboardId == '6a1eba182ff5cb1b286b97bc' ||
      leaderboardId == '6a1eba182ff5cb1b286b97b9' ||
      leaderboardId == '6a1eba182ff5cb1b286b97bf'
    ) {
      await saveLearnerPoint(
        leaderboardId,
        userId,
        learnerPoint,
        moduleId,
        activityId,
        moduleTypeId,
        isNotUnique
      )

      await saveContestLearnerPoint(
        userId,
        leaderboardId,
        contestBadge,
        learnerPoint,
        moduleId,
        activityId,
        moduleTypeId,
        isNotUnique
      )
    }
  } catch (error) {
    throw error
  }
}

module.exports = LearnerPoints

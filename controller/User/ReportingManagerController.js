const mongoose = require('mongoose')

const User = require('../../model/User')
const AppConfig = require('../../model/AppConfig')
const Zone = require('../../model/Zone')
const { decrypt } = require('../../util/encryption')
const { successResponse, errorResponse } = require('../../util/response')

const getAllSubordinatesFlat = async (managerId, result = []) => {
    
  const users = await User.find({ reporting_manager_id: managerId })
    .populate(
      'reporting_manager_id',
      'first_name last_name reporting_manager_id'
    )
    .lean()

  for (let user of users) {
    //  Manager Name
    const manager = user.reporting_manager_id

    user.reporting_manager_name = manager
      ? `${manager.first_name || ''} ${manager.last_name || ''}`.trim()
      : null

    //  Decrypt fields
    user.email = user.email ? decrypt(user.email) : null
    user.phone = user.phone ? decrypt(user.phone) : null

    //  Clean response
    delete user.reporting_manager_id

    // Instead push directly
    result.push(user)

    //  Recursive call (keep flattening)
    await getAllSubordinatesFlat(user._id, result)
  }

  return result
}

exports.getReportingManagerController = async (req, res, next) => {
  try {
    const userId = req.userId

    //  Get flat hierarchy
    const hierarchy = await getAllSubordinatesFlat(userId)

    return successResponse(res, 'Hierarchy fetched successfully', hierarchy)
  } catch (error) {
    next(error)
  }
}

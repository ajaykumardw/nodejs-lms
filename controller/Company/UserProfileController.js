const bcrypt = require('bcryptjs')

const User = require('../../model/User')

const { successResponse, errorResponse } = require('../../util/response')

exports.postProfileChangePasswordAPIController = async (req, res, next) => {
  try {

    const { current_password, new_password, confirm_password } = req.body

    const userId = req.userId

    // VALIDATION
    if (!current_password || !new_password || !confirm_password) {
      return errorResponse(res, 'All fields are required', {}, 400)
    }

    const user = await User.findById(userId)

    if (!user) {
      return errorResponse(res, 'User not found', {}, 404)
    }

    // CHECK CURRENT PASSWORD
    const isMatch = await bcrypt.compare(current_password, user.password)

    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', {}, 400)
    }

    // CHECK NEW PASSWORD MATCH
    if (new_password !== confirm_password) {
      return errorResponse(res, 'New password and confirm password  do not match', {}, 400)
    }

    // HASH NEW PASSWORD
    const encryptedNewPassword = await bcrypt.hash(new_password, 10)

    user.password = encryptedNewPassword

    await user.save()

    return successResponse(res, 'Password updated successfully')
  } catch (error) {
    console.log(error)

    next(error)
  }
}

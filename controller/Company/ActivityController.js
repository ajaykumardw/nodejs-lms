const path = require('path')
const fs = require('fs')
const unzipper = require('unzipper')

const AppConfig = require('../../model/AppConfig')
const Activity = require('../../model/Activity')
const mongoose = require('mongoose')
const { errorResponse, successResponse } = require('../../util/response')
const Module = require('../../model/Module')

const scormQueue = require('../../queues/scormQueue')

exports.getActivityAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const module_id = req.params.moduleId

    const activities = await Activity.aggregate([
      {
        $match: {
          created_by: mongoose.Types.ObjectId.createFromHexString(userId),
          module_id: mongoose.Types.ObjectId.createFromHexString(module_id)
        }
      },
      {
        $lookup: {
          from: 'app_config',
          let: { moduleTypeId: '$module_type_id' },
          pipeline: [
            { $unwind: '$activity_data' },
            {
              $match: {
                $expr: { $eq: ['$activity_data._id', '$$moduleTypeId'] }
              }
            },
            { $project: { _id: 0, activity_data: 1 } }
          ],
          as: 'activity_type'
        }
      },
      {
        $unwind: {
          path: '$activity_type',
          preserveNullAndEmptyArrays: true
        }
      },
      // Populate virtual 'questions'
      {
        $lookup: {
          from: 'questions', // collection name
          localField: '_id', // Activity _id
          foreignField: 'activity_id', // questions.activity_id
          as: 'questions' // result array
        }
      }
    ])

    if (!activities) {
      return errorResponse(res, 'Activity does not exist', {}, 404)
    }

    return successResponse(res, 'Activity fetched successfully', activities)
  } catch (error) {
    next(error)
  }
}

exports.getCreateFormAPI = async (req, res, next) => {
  try {
    const appConfig = await AppConfig.aggregate([
      {
        $match: { type: 'Activity_data' }
      },
      {
        $project: {
          activity_data: {
            $filter: {
              input: '$activity_data',
              as: 'item',
              cond: { $eq: ['$$item.status', true] }
            }
          }
        }
      }
    ])

    if (!appConfig) {
      return errorResponse(res, 'App config does not exist', {}, 404)
    }

    return successResponse(res, 'Create data fetched successfully', {
      appConfig: appConfig?.[0]
    })
  } catch (error) {
    console.error('getCreateFormAPI error:', error)
    return errorResponse(res, 'Internal Server Error', {}, 500)
  }
}

exports.postActivityFormAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const mId = req.params.moduleId
    const typeId = req.params.typeId

    const activity = new Activity({
      created_by: userId,
      module_id: mId,
      module_type_id: typeId
    })

    await activity.save()

    await Module.findByIdAndUpdate(mId, {
      is_survey_completed: false,
      is_survey_done: false
    })

    return successResponse(res, 'Activity saved successfully')
  } catch (error) {
    next(error)
  }
}

exports.deleteActivityAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const moduleId = req.params.moduleId
    const id = req.params.id

    const activity = await Activity.findOne({
      created_by: userId,
      module_id: moduleId,
      _id: id
    })

    if (!activity) {
      return errorResponse(res, 'Activity does not exist', {}, 404)
    }

    await Activity.findOneAndDelete({
      created_by: userId,
      module_id: moduleId,
      _id: id
    })

    return successResponse(res, 'Activity deleted successfully')
  } catch (error) {
    next(error)
  }
}

exports.setNameActivityAPI = async (req, res, next) => {
  try {
    const userId = req.userId
    const moduleId = req.params.moduleId
    const id = req.params.id

    const { title } = req.body

    const activity = await Activity.findOne({
      created_by: userId,
      module_id: moduleId,
      _id: id
    })

    if (!activity) {
      return errorResponse(res, 'Activity does not exist', {}, 404)
    }

    await Activity.findOneAndUpdate(
      { created_by: userId, module_id: moduleId, _id: id },
      {
        $set: {
          name: title
        }
      }
    )

    return successResponse(res, 'Activity saved successfully')
  } catch (error) {
    next(error)
  }
}

exports.postActivityDataAPI = async (req, res, next) => {
  try {
    const { moduleId, moduleTypeId, id } = req.params
    const userId = req.userId

    const activity = await Activity.findOne({
      created_by: userId,
      module_id: moduleId,
      module_type_id: moduleTypeId,
      _id: id
    })

    if (!activity) {
      return errorResponse(res, 'Activity does not exist', {}, 404)
    }

    const { title, video_url } = req.body
    const file = req.file
    const updatePayload = {}

    // ---------------------------------------------------
    // DOCUMENT
    // ---------------------------------------------------
    if (moduleTypeId === '688723af5dd97f4ccae68834') {
      updatePayload.document_data = {
        title,
        image_url: file?.filename || activity.document_data?.image_url || ''
      }
    }

    // ---------------------------------------------------
    // VIDEO FILE
    // ---------------------------------------------------
    else if (moduleTypeId === '688723af5dd97f4ccae68835') {
      updatePayload.video_data = {
        title,
        video_url: file?.filename || activity.video_data?.video_url || ''
      }
    }

    // ---------------------------------------------------
    // VIDEO URL
    // ---------------------------------------------------
    else if (moduleTypeId === '688723af5dd97f4ccae68836') {
      updatePayload.video_data = {
        title,
        video_url: video_url || activity.video_data?.video_url || ''
      }
    }

    // ---------------------------------------------------
    // SCORM
    // ---------------------------------------------------
    else if (moduleTypeId === '688723af5dd97f4ccae68837') {
      if (!file?.filename) {
        return errorResponse(res, 'SCORM ZIP required', {}, 400)
      }

      const folderName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`

      await Activity.findByIdAndUpdate(id, {
        $set: {
          scorm_data: {
            title,
            folder_url: `activity/${folderName}`,
            folder_name: folderName,
            zip_file: file.filename,
            scorm_status: 'queued'
          }
        }
      })

      await scormQueue.add('extract', {
        activityId: id,
        fileName: file.filename,
        folderName
      })

      return successResponse(res, 'SCORM queued for processing')
    }

    // ---------------------------------------------------
    // UPDATE NORMAL
    // ---------------------------------------------------
    await Activity.findByIdAndUpdate(id, { $set: updatePayload })

    return successResponse(res, 'Activity data uploaded successfully')
  } catch (error) {
    next(error)
  }
}

exports.getLiveSessionController = async (req, res, next) => {
  try {
    const userId = req?.userId
    const { moduleId } = req?.params

    const module = await Module.findOne({
      created_by: userId,
      _id: moduleId
    })

    if (!module) {
      return errorResponse(res, 'Module not found', {}, 404)
    }

    return successResponse(res, 'Module fetched successfully', module)
  } catch (error) {
    next(error)
  }
}

exports.postLiveSessionController = async (req, res, next) => {
  try {
    const userId = req?.userId

    const { moduleId } = req?.params

    const { presenter, startDateTime, endDateTime } = req?.body

    const module = await Module.findOne({
      created_by: userId,
      _id: moduleId
    })

    if (!module) {
      return errorResponse(res, 'Module not found', {}, 404)
    }

    await Module.findOneAndUpdate(
      {
        created_by: userId,
        _id: moduleId
      },
      {
        presenter_id: presenter,
        start_live_time: startDateTime,
        end_live_time: endDateTime
      }
    )

    return successResponse(res, 'Live session saved successfully')
  } catch (error) {
    next(error)
  }
}

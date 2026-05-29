const path = require('path')
const fs = require('fs')
const unzipper = require('unzipper')

const AppConfig = require('../../model/AppConfig')
const Activity = require('../../model/Activity')
const mongoose = require('mongoose')
const { errorResponse, successResponse } = require('../../util/response')
const Module = require('../../model/Module')

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
    const appConfig = await AppConfig.findOne({ type: 'Activity_data' })

    if (!appConfig) {
      return errorResponse(res, 'App config does not exist', {}, 404)
    }

    return successResponse(res, 'Create data fetched successfully', {
      appConfig
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
      if (!activity?.document_data?.image_url && !file?.filename) {
        return errorResponse(res, 'File does not exist', {}, 400)
      }

      updatePayload.document_data = {
        title,
        image_url: file?.filename || activity.document_data?.image_url || ''
      }
    }

    // ---------------------------------------------------
    // VIDEO FILE
    // ---------------------------------------------------
    else if (moduleTypeId === '688723af5dd97f4ccae68835') {
      if (!activity?.video_data?.video_url && !file?.filename) {
        return errorResponse(res, 'File does not exist', {}, 404)
      }

      updatePayload.video_data = {
        title,
        video_url: file?.filename || activity.video_data?.video_url || ''
      }
    }

    // ---------------------------------------------------
    // VIDEO URL
    // ---------------------------------------------------
    else if (moduleTypeId === '688723af5dd97f4ccae68836') {
      if (!activity?.video_data?.video_url && !video_url) {
        return errorResponse(res, 'File does not exist', {}, 404)
      }

      updatePayload.video_data = {
        title,
        video_url: video_url || activity.video_data?.video_url || ''
      }
    }

    // SCORM
    // ---------------------------------------------------
    else if (moduleTypeId === '688723af5dd97f4ccae68837') {
      if (!file?.filename && !activity?.scorm_data?.folder_url) {
        return errorResponse(res, 'SCORM ZIP required', {}, 400)
      }

      // ---------------------------------------------------
      // ZIP VALIDATION
      // ---------------------------------------------------

      if (file && path.extname(file.originalname).toLowerCase() !== '.zip') {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }

        return errorResponse(res, 'Only ZIP files are allowed', {}, 400)
      }

      // ---------------------------------------------------
      // NEW SCORM FILE
      // ---------------------------------------------------

      if (file?.filename) {
        const folderName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}`

        const PUBLIC_ACTIVITY_PATH = path.resolve(
          process.cwd(),
          'public',
          'activity'
        )

        const zipFilePath = path.join(PUBLIC_ACTIVITY_PATH, file.filename)

        const extractPath = path.join(PUBLIC_ACTIVITY_PATH, folderName)

        // ---------------------------------------------------
        // SAVE PROCESSING STATUS
        // ---------------------------------------------------

        updatePayload.scorm_data = {
          title,
          folder_url: `activity/${folderName}`,
          folder_name: folderName,
          zip_file: file.filename,
          scorm_status: 'processing'
        }

        await Activity.findByIdAndUpdate(
          id,
          {
            $set: updatePayload
          },
          {
            new: true
          }
        )

        // ---------------------------------------------------
        // START BACKGROUND PROCESS
        // ---------------------------------------------------

        setTimeout(async () => {
          try {
            // ---------------------------------------------------
            // CREATE DIRECTORY
            // ---------------------------------------------------

            await fs.promises.mkdir(extractPath, {
              recursive: true
            })

            // ---------------------------------------------------
            // OPEN ZIP
            // ---------------------------------------------------

            const zip = await unzipper.Open.file(zipFilePath)

            // ---------------------------------------------------
            // EXTRACT FILES
            // ---------------------------------------------------

            for (const entry of zip.files) {
              const fullPath = path.join(extractPath, entry.path)

              // ---------------------------------------------------
              // SECURITY CHECK
              // ---------------------------------------------------

              const normalizedPath = path.normalize(fullPath)

              if (!normalizedPath.startsWith(extractPath)) {
                throw new Error('Invalid ZIP structure')
              }

              // ---------------------------------------------------
              // DIRECTORY
              // ---------------------------------------------------

              if (entry.type === 'Directory') {
                await fs.promises.mkdir(fullPath, {
                  recursive: true
                })

                continue
              }

              // ---------------------------------------------------
              // CREATE PARENT DIRECTORY
              // ---------------------------------------------------

              await fs.promises.mkdir(path.dirname(fullPath), {
                recursive: true
              })

              // ---------------------------------------------------
              // WRITE FILE
              // ---------------------------------------------------

              await new Promise((resolve, reject) => {
                entry
                  .stream()
                  .pipe(fs.createWriteStream(fullPath))
                  .on('finish', resolve)
                  .on('error', reject)
              })
            }

            // ---------------------------------------------------
            // FIND imsmanifest.xml
            // ---------------------------------------------------

            const findManifest = dir => {
              const entries = fs.readdirSync(dir, {
                withFileTypes: true
              })

              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                  const nested = findManifest(fullPath)

                  if (nested) {
                    return nested
                  }
                } else {
                  const normalized = entry.name
                    .trim()
                    .replace(/\0/g, '')
                    .toLowerCase()

                  if (normalized === 'imsmanifest.xml') {
                    return fullPath
                  }
                }
              }

              return null
            }

            const manifestPath = findManifest(extractPath)

            console.log('MANIFEST PATH:', manifestPath)

            if (!manifestPath) {
              throw new Error('imsmanifest.xml missing')
            }

            // ---------------------------------------------------
            // VALIDATE MANIFEST
            // ---------------------------------------------------

            const manifestContent = await fs.promises.readFile(
              manifestPath,
              'utf8'
            )

            if (!manifestContent.includes('<manifest')) {
              throw new Error('Invalid SCORM manifest')
            }

            // ---------------------------------------------------
            // VERIFY scormdriver.js
            // ---------------------------------------------------

            const findFileRecursive = (dir, fileName) => {
              const entries = fs.readdirSync(dir, {
                withFileTypes: true
              })

              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                  const nested = findFileRecursive(fullPath, fileName)

                  if (nested) {
                    return nested
                  }
                } else {
                  if (
                    entry.name.trim().toLowerCase() === fileName.toLowerCase()
                  ) {
                    return fullPath
                  }
                }
              }

              return null
            }

            const scormDriverPath = findFileRecursive(
              extractPath,
              'scormdriver.js'
            )

            if (scormDriverPath) {
              const stat = fs.statSync(scormDriverPath)

              console.log('SCORM DRIVER:', scormDriverPath)

              if (stat.size === 0) {
                throw new Error('Corrupted scormdriver.js')
              }
            }

            // ---------------------------------------------------
            // DELETE ZIP
            // ---------------------------------------------------

            if (fs.existsSync(zipFilePath)) {
              fs.unlinkSync(zipFilePath)
            }

            // ---------------------------------------------------
            // UPDATE SUCCESS
            // ---------------------------------------------------

            await Activity.findByIdAndUpdate(id, {
              $set: {
                'scorm_data.scorm_status': 'completed'
              }
            })

            console.log('SCORM extracted successfully:', folderName)
          } catch (err) {
            console.error('SCORM extraction failed:', err.stack)

            // ---------------------------------------------------
            // CLEANUP FOLDER
            // ---------------------------------------------------

            if (fs.existsSync(extractPath)) {
              fs.rmSync(extractPath, {
                recursive: true,
                force: true
              })
            }

            // ---------------------------------------------------
            // CLEANUP ZIP
            // ---------------------------------------------------

            if (fs.existsSync(zipFilePath)) {
              fs.unlinkSync(zipFilePath)
            }

            // ---------------------------------------------------
            // UPDATE FAILED
            // ---------------------------------------------------

            await Activity.findByIdAndUpdate(id, {
              $set: {
                'scorm_data.scorm_status': 'failed'
              }
            })
          }
        }, 100)

        // ---------------------------------------------------
        // SEND RESPONSE AFTER BACKGROUND START
        // ---------------------------------------------------

        return successResponse(
          res,
          'SCORM uploaded successfully. Processing started.'
        )
      }
    }

    // ---------------------------------------------------
    // INVALID MODULE
    // ---------------------------------------------------
    else {
      return errorResponse(res, 'Unsupported moduleTypeId', {}, 400)
    }

    // ---------------------------------------------------
    // UPDATE NORMAL MODULES
    // ---------------------------------------------------

    await Activity.findByIdAndUpdate(
      id,
      {
        $set: updatePayload
      },
      {
        new: true
      }
    )

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

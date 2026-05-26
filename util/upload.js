const multer = require('multer')
const path = require('path')
const fs = require('fs')
const unzipper = require('unzipper')

function createUpload (allowedTypes, directory = 'uploads', maxSizeMB = 2000) {
  const absPath = path.join(process.cwd(), 'public', directory)

  // ---------------------------------------------------
  // CREATE DIRECTORY
  // ---------------------------------------------------

  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, {
      recursive: true
    })
  }

  // ---------------------------------------------------
  // STORAGE
  // ---------------------------------------------------

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, absPath)
    },

    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)

      const fileName = `${Date.now()}-${Math.round(Math.random() * 9999)}${ext}`

      cb(null, fileName)
    }
  })

  const upload = multer({
    storage,

    limits: {
      fileSize: maxSizeMB * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Invalid file type'))
      }
    }
  })

  const validateScormZip = async filePath => {
    const directory = await unzipper.Open.file(filePath)

    const manifest = directory.files.find(
      file => path.basename(file.path).toLowerCase() === 'imsmanifest.xml'
    )

    if (!manifest) {
      throw new Error('Invalid SCORM package. imsmanifest.xml missing.')
    }

    const content = await manifest.buffer()

    const manifestText = content.toString('utf8')

    if (!manifestText.includes('<manifest')) {
      throw new Error('Invalid SCORM manifest.')
    }

    return true
  }

  // ---------------------------------------------------
  // MIDDLEWARE
  // ---------------------------------------------------

  return {
    middleware: (fieldName = 'file') => [
      (req, res, next) => {
        req.uploadPath = directory

        next()
      },

      (req, res, next) => {
        upload.single(fieldName)(req, res, async err => {
          try {
            // ---------------------------------------------------
            // MULTER ERRORS
            // ---------------------------------------------------

            if (err instanceof multer.MulterError) {
              if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                  status: 'Failure',
                  message: 'File too large'
                })
              }

              return res.status(400).json({
                status: 'Failure',
                message: err.message
              })
            }

            if (err) {
              return res.status(400).json({
                status: 'Failure',
                message: err.message
              })
            }

            // ---------------------------------------------------
            // NO FILE
            // ---------------------------------------------------

            if (!req.file) {
              return next()
            }

            // ---------------------------------------------------
            // SCORM VALIDATION
            // ---------------------------------------------------

            const isScormRoute =
              req.params?.moduleTypeId === '688723af5dd97f4ccae68837'

            if (isScormRoute) {
              try {
                // ZIP EXTENSION CHECK

                const ext = path.extname(req.file.originalname).toLowerCase()

                if (ext !== '.zip') {
                  fs.unlinkSync(req.file.path)

                  return res.status(400).json({
                    status: 'Failure',
                    message: 'Only ZIP files are allowed'
                  })
                }

                // VALIDATE SCORM

                await validateScormZip(req.file.path)
              } catch (validationError) {
                // DELETE INVALID ZIP

                if (fs.existsSync(req.file.path)) {
                  fs.unlinkSync(req.file.path)
                }

                return res.status(400).json({
                  status: 'Failure',
                  message: validationError.message
                })
              }
            }

            next()
          } catch (internalError) {
            console.error(internalError)

            // cleanup

            if (req.file?.path && fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path)
            }

            return res.status(500).json({
              status: 'Failure',
              message: 'Upload validation failed'
            })
          }
        })
      }
    ]
  }
}

module.exports = createUpload

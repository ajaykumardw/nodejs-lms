const multer = require('multer')
const path = require('path')
const fs = require('fs')
const unzipper = require('unzipper')

function createUpload (allowedTypes, directory = 'uploads', maxSizeMB = 2000) {
  const absPath = path.join(process.cwd(), 'public', directory)

  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true })
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, absPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname)
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}${ext}`
      cb(null, fileName)
    }
  })

  const upload = multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) cb(null, true)
      else cb(new Error('Invalid file type'))
    }
  })

  return {
    middleware: (field = 'file') => [
      (req, res, next) => {
        upload.single(field)(req, res, err => {
          if (err) {
            return res.status(400).json({
              status: 'Failure',
              message: err.message
            })
          }

          if (!req.file) return next()

          // SCORM ONLY VALIDATION (NO EXTRACTION)
          const isScorm =
            req.params?.moduleTypeId === '688723af5dd97f4ccae68837'

          if (isScorm) {
            const ext = path.extname(req.file.originalname).toLowerCase()

            if (ext !== '.zip') {
              fs.unlinkSync(req.file.path)
              return res.status(400).json({
                status: 'Failure',
                message: 'Only ZIP allowed'
              })
            }
          }

          next()
        })
      }
    ]
  }
}

module.exports = createUpload

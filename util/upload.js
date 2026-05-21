const multer = require('multer')
const path = require('path')
const fs = require('fs')

function createUpload (allowedTypes, directory = 'uploads/', maxSizeMB = 2000) {
  const uploadPath = `/public/${directory}`

  const absPath = path.join(__dirname, '..', uploadPath)

  // create directory
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true })
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

  // ---------------------------------------------------
  // MULTER
  // ---------------------------------------------------

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
        upload.single(fieldName)(req, res, err => {
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

          next()
        })
      }
    ]
  }
}

module.exports = createUpload

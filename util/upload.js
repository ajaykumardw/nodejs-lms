const multer = require('multer')
const path = require('path')
const fs = require('fs')
const unzipper = require('unzipper')

function createUpload(
  allowedTypes,
  directory = 'uploads',
  maxSizeMB = 2000
) {
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

      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}${ext}`

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
  // FIND FILE RECURSIVELY
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
          entry.name.trim().toLowerCase() ===
          fileName.toLowerCase()
        ) {
          return fullPath
        }
      }
    }

    return null
  }

  // ---------------------------------------------------
  // VALIDATE SCORM ZIP
  // ---------------------------------------------------

  const validateScormZip = async filePath => {
    try {
      const zip = await unzipper.Open.file(filePath)

      console.log(
        'ZIP FILES:',
        zip.files.map(f => f.path)
      )

      // ---------------------------------------------------
      // FIND imsmanifest.xml
      // ---------------------------------------------------

      const manifest = zip.files.find(file => {
        const normalized = file.path
          .replace(/\\/g, '/')
          .trim()
          .toLowerCase()

        return (
          normalized.endsWith('/imsmanifest.xml') ||
          normalized === 'imsmanifest.xml'
        )
      })

      if (!manifest) {
        throw new Error(
          'Invalid SCORM package. imsmanifest.xml missing.'
        )
      }

      // ---------------------------------------------------
      // VALIDATE XML CONTENT
      // ---------------------------------------------------

      const content = await manifest.buffer()

      const manifestText = content.toString('utf8')

      if (!manifestText.includes('<manifest')) {
        throw new Error('Invalid SCORM manifest.')
      }

      return true
    } catch (error) {
      console.error('SCORM VALIDATION ERROR:', error)

      throw error
    }
  }

  // ---------------------------------------------------
  // EXTRACT SCORM
  // ---------------------------------------------------

  const extractScormPackage = async (
    zipFilePath,
    extractPath
  ) => {
    const zip = await unzipper.Open.file(zipFilePath)

    // ---------------------------------------------------
    // CREATE EXTRACTION DIRECTORY
    // ---------------------------------------------------

    await fs.promises.mkdir(extractPath, {
      recursive: true
    })

    // ---------------------------------------------------
    // EXTRACT FILES
    // ---------------------------------------------------

    for (const entry of zip.files) {
      const fullPath = path.join(
        extractPath,
        entry.path
      )

      // SECURITY FIX
      // PREVENT ZIP SLIP ATTACK

      const normalizedPath = path.normalize(fullPath)

      if (!normalizedPath.startsWith(extractPath)) {
        throw new Error('Invalid ZIP structure.')
      }

      // DIRECTORY

      if (entry.type === 'Directory') {
        await fs.promises.mkdir(fullPath, {
          recursive: true
        })

        continue
      }

      // CREATE PARENT

      await fs.promises.mkdir(
        path.dirname(fullPath),
        {
          recursive: true
        }
      )

      // WRITE FILE

      await new Promise((resolve, reject) => {
        entry
          .stream()
          .pipe(fs.createWriteStream(fullPath))
          .on('finish', resolve)
          .on('error', reject)
      })
    }

    // ---------------------------------------------------
    // VERIFY imsmanifest.xml EXISTS
    // ---------------------------------------------------

    const manifestPath = findFileRecursive(
      extractPath,
      'imsmanifest.xml'
    )

    if (!manifestPath) {
      throw new Error(
        'imsmanifest.xml missing after extraction.'
      )
    }

    // ---------------------------------------------------
    // OPTIONAL VERIFY scormdriver.js
    // ---------------------------------------------------

    const scormDriverPath = findFileRecursive(
      extractPath,
      'scormdriver.js'
    )

    if (scormDriverPath) {
      const stat = fs.statSync(scormDriverPath)

      console.log(
        'SCORM DRIVER:',
        scormDriverPath
      )

      if (stat.size === 0) {
        throw new Error(
          'Corrupted scormdriver.js'
        )
      }
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
        upload.single(fieldName)(
          req,
          res,
          async err => {
            try {
              // ---------------------------------------------------
              // MULTER ERRORS
              // ---------------------------------------------------

              if (
                err instanceof multer.MulterError
              ) {
                if (
                  err.code === 'LIMIT_FILE_SIZE'
                ) {
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
                req.params?.moduleTypeId ===
                '688723af5dd97f4ccae68837'

              if (isScormRoute) {
                try {
                  // ---------------------------------------------------
                  // ZIP EXTENSION CHECK
                  // ---------------------------------------------------

                  const ext = path
                    .extname(req.file.originalname)
                    .toLowerCase()

                  if (ext !== '.zip') {
                    if (
                      fs.existsSync(req.file.path)
                    ) {
                      fs.unlinkSync(
                        req.file.path
                      )
                    }

                    return res.status(400).json({
                      status: 'Failure',
                      message:
                        'Only ZIP files are allowed'
                    })
                  }

                  // ---------------------------------------------------
                  // VALIDATE ZIP
                  // ---------------------------------------------------

                  await validateScormZip(
                    req.file.path
                  )

                  // ---------------------------------------------------
                  // OPTIONAL TEST EXTRACTION
                  // ---------------------------------------------------

                  const tempExtractPath =
                    path.join(
                      absPath,
                      `temp-${Date.now()}`
                    )

                  await extractScormPackage(
                    req.file.path,
                    tempExtractPath
                  )

                  // CLEAN TEMP

                  if (
                    fs.existsSync(
                      tempExtractPath
                    )
                  ) {
                    fs.rmSync(
                      tempExtractPath,
                      {
                        recursive: true,
                        force: true
                      }
                    )
                  }
                } catch (validationError) {
                  console.error(
                    'SCORM ERROR:',
                    validationError
                  )

                  // DELETE INVALID ZIP

                  if (
                    fs.existsSync(req.file.path)
                  ) {
                    fs.unlinkSync(
                      req.file.path
                    )
                  }

                  return res.status(400).json({
                    status: 'Failure',
                    message:
                      validationError.message
                  })
                }
              }

              next()
            } catch (internalError) {
              console.error(
                'UPLOAD ERROR:',
                internalError
              )

              // CLEANUP FILE

              if (
                req.file?.path &&
                fs.existsSync(req.file.path)
              ) {
                fs.unlinkSync(req.file.path)
              }

              return res.status(500).json({
                status: 'Failure',
                message:
                  'Upload validation failed'
              })
            }
          }
        )
      }
    ],

    extractScormPackage
  }
}

module.exports = createUpload

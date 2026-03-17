const multer = require('multer')
const path = require('path')
const fs = require('fs')

const CONFIG = {
    header_logo: {
        dir: 'public/template_mail_logo/header',
        maxSize: 5 * 1024 * 1024,
        types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
        required: true
    },
    footer_logo: {
        dir: 'public/template_mail_logo/footer',
        maxSize: 5 * 1024 * 1024,
        types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
        required: false
    }
}

Object.values(CONFIG).forEach(cfg => {

    if (!fs.existsSync(cfg.dir)) {
        fs.mkdirSync(cfg.dir, { recursive: true })
    }
})

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const cfg = CONFIG[file.fieldname]
        if (!cfg) return cb(new Error('Invalid file field'))
        cb(null, cfg.dir)
    },
    filename: (req, file, cb) => {
        const unique =
            Date.now() +
            '-' +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname)
        cb(null, unique)
    }
})

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const cfg = CONFIG[file.fieldname]
        if (!cfg) return cb(new Error('Invalid file field'))

        if (!cfg.types.includes(file.mimetype)) {
            return cb(new Error(`Invalid file type for ${file.fieldname}`))
        }
        cb(null, true)
    },
    limits: {
        fileSize: 2 * 1024 * 1024
    }
})

// per-file size validation
const validateSizes = (req, res, next) => {
    for (const field in req.files || {}) {
        const file = req.files[field][0]
        const cfg = CONFIG[field]

        if (file.size > cfg.maxSize) {
            return next(
                new Error(`${field} exceeds allowed size`)
            )
        }
    }
    next()
}

module.exports = [
    upload.fields([
        { name: 'header_logo', maxCount: 1 },
        { name: 'footer_logo', maxCount: 1 }
    ]),
    validateSizes
]

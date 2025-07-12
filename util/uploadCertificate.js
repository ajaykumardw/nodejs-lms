const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Create a multer middleware for certificate asset uploads.
 * 
 * @param {string[]} allowedTypes - MIME types allowed (e.g., ['image/jpeg']).
 * @param {string} directory - Directory inside /public to save files.
 * @param {number} [maxSizeMB=5] - Max file size in MB.
 * @returns {{ fieldsMiddleware: any, uploadPath: string }}
 */
function certificateUpload(allowedTypes, directory, maxSizeMB = 5) {
    const relativePath = `public/${directory}`;
    const absPath = path.join(__dirname, '..', relativePath);

    // Ensure directory exists
    if (!fs.existsSync(absPath)) {
        fs.mkdirSync(absPath, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, absPath);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const timestamp = Math.floor(Date.now() / 1000);
            const sanitizedField = file.fieldname.replace(/[^a-zA-Z0-9]/g, '');
            cb(null, `${sanitizedField}-${timestamp}${ext}`);
        }
    });

    const fileFilter = (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    };

    const upload = multer({
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 }, // Max size in bytes
        fileFilter
    });

    return {
        fieldsMiddleware: upload.fields([
            { name: 'logoURL', maxCount: 1 },
            { name: 'backgroundImage', maxCount: 1 },
            { name: 'signature1URL', maxCount: 1 },
            { name: 'signature2URL', maxCount: 1 }
        ]),
        uploadPath: `/${directory}` // for DB or frontend use
    };
}

module.exports = certificateUpload;

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * This function will be used to upload data on any folder.
 * 
 * @param {string[]} allowedTypes
 * @param {number} [maxSizeMB=5]
 * @returns {{ uploadField: Object, uploadPaths: object }}
 */

function certificateUpload(allowedTypes, directFolder, folderArr, maxSizeMB = 2) {

    const baseDir = path.join(__dirname, '..', 'public');

    // Map field names to their directories
    const fieldDirectoryMap = directFolder

    // Ensure all target directories exist
    Object.values(fieldDirectoryMap).map(item => {
        const fullPath = path.join(baseDir, item)
        if (!fs.existsSync(fullPath)) {

        }
        fs.mkdirSync(item, { recursive: true })
    })

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const subDir = fieldDirectoryMap[file.fieldname]
            if (!subDir) {
                return cb(new Error(`Invalid field: ${file.fieldname}`), null);
            }
            cb(null, path.join(baseDir, subDir))
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase()
            const timestamp = Math.floor(Date.now() / 1000)
            const santized = file.fieldname.replace(/[^A-Za-z0-9]/g, '')
            cb(null, `${santized}-${timestamp}${ext}`)
        }
    })

    const fileFilter = (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(Error('Invalid file type'), false);
        }
    };

    const upload = multer({
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
        fileFilter
    });

    return {
        uploadField: upload.fields(folderArr),
        uploadPaths: fieldDirectoryMap
    };
}

module.exports = certificateUpload;

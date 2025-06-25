const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Creates a multer upload instance with custom allowed file types,
 * and automatically extracts PDF page count to `req.pdfPageCount`.
 *
 * @param {string[]} allowedTypes - Array of allowed MIME types
 * @param {string} directory - Folder to save uploaded files (default: 'uploads/')
 * @param {number} maxSizeMB - Max file size in MB (default: 5)
 * @returns Middleware array: [multerMiddleware, pageCountMiddleware]
 */
function createUpload(allowedTypes, directory = 'uploads/', maxSizeMB = 5) {
  const uploadPath = `/public/${directory}`;
  const absPath = path.join(__dirname, '..', uploadPath);

  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, absPath);
    },
    filename: function (req, file, cb) {
      const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
      cb(null, uniqueName);
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
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter
  });

  // Middleware to extract PDF page count
  const extractPdfPageCount = async (req, res, next) => {
    try {
      if (
        req.file &&
        req.file.mimetype === 'application/pdf' &&
        allowedTypes.includes('application/pdf')
      ) {
        const fullPath = path.join(absPath, req.file.filename);
        const dataBuffer = fs.readFileSync(fullPath);
        const pdfData = await pdfParse(dataBuffer);
        req.pdfPageCount = pdfData.numpages;
      }
    } catch (err) {
      console.error('PDF parsing error:', err);
      req.pdfPageCount = 0;
    }
    next();
  };

  // Return a middleware array: [multer.single('file'), extractPdfPageCount]
  return (fieldName = 'file') => [upload.single(fieldName), extractPdfPageCount];
}

module.exports = createUpload;

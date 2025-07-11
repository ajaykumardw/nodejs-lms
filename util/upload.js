const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const unzipper = require('unzipper');

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
      let uniqueName;
    
      if (file.mimetype === 'application/zip') {
        uniqueName = generateCustomId() + '.zip'; // optional: add extension
      } else {
        uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
      }
    
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

  const handleZipOrPdf = async (req, res, next) => {
    try {
      if (!req.file) return next();

      const fullPath = path.join(absPath, req.file.filename);

      // ✅ Extract if it's a zip
      if (req.file.mimetype === 'application/zip') {
        const extractFolder = fullPath.replace(/\.zip$/, '');
        fs.mkdirSync(extractFolder, { recursive: true });
        console.log('extractFolder', extractFolder);
        await fs.createReadStream(fullPath)
          .pipe(unzipper.Extract({ path: extractFolder }))
          .promise();
        req.extractedPath = `${directory}/${req.file.filename.replace(/\.zip$/, '')}`; 
        console.log('req.extractedPath', req.extractedPath);       
      }

      // ✅ Extract page count if PDF
      if (req.file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(fullPath);
        const pdfData = await pdfParse(dataBuffer);
        req.pdfPageCount = pdfData.numpages;
      }

      req.uploadDir = `${directory}/${req.file.filename}`; 
      next();
    } catch (err) {
      console.error('File processing error:', err);
      next(err);
    }
  };

  return {
    middleware: (fieldName = 'file') => [
      (req, res, next) => {
        req.uploadPath = directory;
        next();
      },
      upload.single(fieldName),
      handleZipOrPdf
    ],
    uploadPath
  };
}

function certificateUpload(allowedTypes, directory = 'uploads/', maxSizeMB = 5) {
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

  return {
    fieldsMiddleware: upload.fields([
      { name: 'logoURL', maxCount: 1 },
      { name: 'backgroundImage', maxCount: 1 },
      { name: 'signature1URL', maxCount: 1 },
      { name: 'signature2URL', maxCount: 1 }
    ]),
    uploadPath
  };
}


function generateCustomId(segmentCount = 4, segmentLength = 4) {
  const randomSegment = () =>
    Array.from({ length: segmentLength }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)) // a-z
    ).join('');

  return Array.from({ length: segmentCount }, randomSegment).join('-');
}

module.exports = createUpload;

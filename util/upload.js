const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const unzipper = require("unzipper");

const { DOMParser } = require("xmldom"); // npm i xmldom

function createUpload(allowedTypes, directory = "uploads/", maxSizeMB = 2000) {
  const uploadPath = `/public/${directory}`;
  const absPath = path.join(__dirname, "..", uploadPath);

  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }

  // Storage system
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, absPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.round(Math.random() * 9999)}${ext}`;
      cb(null, name);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 }, // 2GB support
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Invalid file type"), false);
    },
  });

  // FIXED & SAFE HANDLER
  const handleZipOrPdf = async (req, res, next) => {
    try {
      if (!req.file) return next();

      const filePath = path.join(absPath, req.file.filename);

      // PDF Processing
      if (req.file.mimetype === "application/pdf") {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        req.pdfPageCount = data.numpages;
      }

      // SCORM ZIP Extraction
      if (
        req.file.mimetype === "application/zip" ||
        req.file.mimetype === "application/x-zip-compressed" ||
        req.file.mimetype === "multipart/x-zip"
      ) {
        const folderName = req.file.filename.replace(".zip", "");
        const extractPath = path.join(absPath, folderName);

        if (!fs.existsSync(extractPath)) {
          fs.mkdirSync(extractPath);
        }

        // STREAMED EXTRACTION — FIXES CRASHING
        await new Promise((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: extractPath }))
            .on("close", resolve)
            .on("error", reject);
        });

        fs.unlinkSync(filePath); // Delete ZIP only AFTER extraction

        req.scormExtractedPath = `${directory}/${folderName}`;
      }

      next();
    } catch (err) {
      console.error("SCORM/PDF Processing Error:", err);
      next(err);
    }
  };

  return {
    middleware: (fieldName = "file") => [
      (req, res, next) => {
        req.uploadPath = directory;
        next();
      },
      upload.single(fieldName),
      handleZipOrPdf,
    ],
  };
}

module.exports = createUpload;

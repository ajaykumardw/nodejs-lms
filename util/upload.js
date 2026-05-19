const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { exec } = require("child_process");

function createUpload(
  allowedTypes,
  directory = "uploads/",
  maxSizeMB = 2000
) {

  const uploadPath = `/public/${directory}`;
  const absPath = path.join(__dirname, "..", uploadPath);

  /**
   * Create upload directory
   */
  if (!fs.existsSync(absPath)) {
    fs.mkdirSync(absPath, { recursive: true });
  }

  /**
   * Multer Storage
   */
  const storage = multer.diskStorage({

    destination: (req, file, cb) => {
      cb(null, absPath);
    },

    filename: (req, file, cb) => {

      const ext = path.extname(file.originalname);

      const fileName =
        `${Date.now()}-${Math.round(Math.random() * 999999)}${ext}`;

      cb(null, fileName);
    },
  });

  /**
   * Multer Upload Config
   */
  const upload = multer({

    storage,

    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },

    fileFilter: (req, file, cb) => {

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type"), false);
      }
    },
  });

  /**
   * Handle PDF + SCORM
   */
  const handleZipOrPdf = async (req, res, next) => {

    try {

      if (!req.file) {
        return next();
      }

      console.log("================================");
      console.log("FILE UPLOAD STARTED");
      console.log("Original Name:", req.file.originalname);
      console.log("Saved Name:", req.file.filename);
      console.log(
        "Size:",
        (req.file.size / 1024 / 1024).toFixed(2),
        "MB"
      );
      console.log("MimeType:", req.file.mimetype);
      console.log("================================");

      const filePath = path.join(absPath, req.file.filename);

      /**
       * PDF Processing
       */
      if (req.file.mimetype === "application/pdf") {

        try {

          const buffer = fs.readFileSync(filePath);

          const data = await pdfParse(buffer);

          req.pdfPageCount = data.numpages || 0;

          console.log("PDF Pages:", req.pdfPageCount);

        } catch (pdfErr) {

          console.error("PDF Parse Error:", pdfErr);
        }
      }

      /**
       * SCORM ZIP Processing
       */
      const zipMimeTypes = [
        "application/zip",
        "application/x-zip-compressed",
        "multipart/x-zip",
        "application/octet-stream",
      ];

      if (zipMimeTypes.includes(req.file.mimetype)) {

        const folderName = req.file.filename.replace(
          path.extname(req.file.filename),
          ""
        );

        const extractPath = path.join(absPath, folderName);

        /**
         * Create extraction folder
         */
        if (!fs.existsSync(extractPath)) {
          fs.mkdirSync(extractPath, { recursive: true });
        }

        /**
         * Save extracted path
         */
        req.scormExtractedPath = `${directory}/${folderName}`;

        console.log("SCORM Extraction Path:", extractPath);

        /**
         * IMPORTANT:
         * Background extraction
         * Avoid nginx timeout
         */
        setImmediate(() => {

          console.log("SCORM Extraction Started");

          exec(
            `unzip -o "${filePath}" -d "${extractPath}"`,
            {
              maxBuffer: 1024 * 1024 * 500,
            },
            (error, stdout, stderr) => {

              if (error) {

                console.error("================================");
                console.error("SCORM EXTRACTION FAILED");
                console.error(error);
                console.error(stderr);
                console.error("================================");

                return;
              }

              console.log("================================");
              console.log("SCORM Extraction Completed");
              console.log("Folder:", folderName);
              console.log("================================");

              /**
               * Delete uploaded zip
               */
              try {

                if (fs.existsSync(filePath)) {

                  fs.unlinkSync(filePath);

                  console.log("ZIP deleted:", filePath);
                }

              } catch (unlinkErr) {

                console.error("ZIP delete error:", unlinkErr);
              }
            }
          );
        });
      }

      next();

    } catch (err) {

      console.error("================================");
      console.error("UPLOAD PROCESSING ERROR");
      console.error(err);
      console.error("================================");

      next(err);
    }
  };

  /**
   * Middleware Export
   */
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
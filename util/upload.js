const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const unzipper = require("unzipper");

function createUpload(
  allowedTypes,
  directory = "uploads/",
  maxSizeMB = 2000
) {
  const uploadPath = `/public/${directory}`;
  const absPath = path.join(__dirname, "..", uploadPath);

  // Create upload directory if not exists
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

      const fileName = `${Date.now()}-${Math.round(
        Math.random() * 999999
      )}${ext}`;

      cb(null, fileName);
    },
  });

  /**
   * Multer Upload Config
   */
  const upload = multer({
    storage,

    limits: {
      fileSize: maxSizeMB * 1024 * 1024, // MB → Bytes
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
   * PDF + SCORM Processing
   */
  const handleZipOrPdf = async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
      }

      const filePath = path.join(absPath, req.file.filename);

      /**
       * Handle PDF
       */
      if (req.file.mimetype === "application/pdf") {
        try {
          const buffer = fs.readFileSync(filePath);

          const data = await pdfParse(buffer);

          req.pdfPageCount = data.numpages || 0;
        } catch (pdfErr) {
          console.error("PDF Parse Error:", pdfErr);
        }
      }

      /**
       * Handle SCORM ZIP
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

        // Create extraction folder
        if (!fs.existsSync(extractPath)) {
          fs.mkdirSync(extractPath, { recursive: true });
        }

        /**
         * IMPORTANT:
         * Extract in background to avoid nginx timeout
         */
        setImmediate(() => {
          fs.createReadStream(filePath)
            .pipe(unzipper.Extract({ path: extractPath }))

            .on("close", () => {
              console.log("SCORM extraction completed:", folderName);

              // Delete zip after extraction
              try {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                }
              } catch (unlinkErr) {
                console.error("ZIP delete error:", unlinkErr);
              }
            })

            .on("error", (zipErr) => {
              console.error("SCORM extraction error:", zipErr);
            });
        });

        req.scormExtractedPath = `${directory}/${folderName}`;
      }

      next();
    } catch (err) {
      console.error("Upload Processing Error:", err);
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
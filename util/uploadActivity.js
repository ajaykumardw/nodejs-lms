const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const unzipper = require('unzipper');

const docxConverter = require('docx2pdf-converter');
const pptx2pdf = require('pptx2pdf');

async function convertOfficeToPDF(inputPath) {

    const ext = path.extname(inputPath).toLowerCase();
    const outputPath = inputPath.replace(ext, '.pdf');

    if (ext === '.doc' || ext === '.docx') {
        return new Promise((resolve, reject) => {
            docxConverter.convert(inputPath, outputPath, (err) => {
                if (err) return reject(err);
                resolve(outputPath);
            });
        });
    }

    if (ext === '.ppt' || ext === '.pptx') {
        return pptx2pdf(inputPath, outputPath).then(() => outputPath);
    }

    throw new Error('Unsupported file type for conversion');
}

function createUpload(allowedTypes, directory = 'uploads/', maxSizeMB = 10) {

    const absPath = path.join(__dirname, '..', 'public', directory);

    if (!fs.existsSync(absPath)) fs.mkdirSync(absPath, {
        recursive: true
    });

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, absPath),
        filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
            cb(null, uniqueName);
        }
    });

    const fileFilter = (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type'), false);
    };

    const upload = multer({
        storage,
        limits: {
            fileSize: maxSizeMB * 1024 * 1024
        },
        fileFilter
    });

    const handleFileProcessing = async (req, res, next) => {
        try {
            if (!req.file) return next();

            const fullPath = path.join(absPath, req.file.filename);
            const mimetype = req.file.mimetype;

            if (mimetype === 'application/zip') {

                const extractFolder = fullPath.replace(/\.zip$/, '');

                fs.mkdirSync(extractFolder, {
                    recursive: true
                });

                await fs.createReadStream(fullPath)
                    .pipe(unzipper.Extract({
                        path: extractFolder
                    }))
                    .promise();

                req.extractedPath = `${directory}/${req.file.filename.replace(/\.zip$/, '')}`;
            }

            const officeTypes = [
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            ];

            if (officeTypes.includes(mimetype)) {
                try {

                    const pdfPath = await convertOfficeToPDF(fullPath);

                    req.file.filename = path.basename(pdfPath);
                    req.file.path = pdfPath;
                    req.file.mimetype = 'application/pdf';

                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

                } catch (err) {
                    console.error('Conversion to PDF failed:', err);
                }
            }

            if (req.file.mimetype === 'application/pdf') {

                const buffer = fs.readFileSync(req.file.path);
                const pdfData = await pdfParse(buffer);
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
        middleware: (fieldName = 'file') => [upload.single(fieldName), handleFileProcessing],
        uploadPath: absPath
    };
}

module.exports = createUpload;
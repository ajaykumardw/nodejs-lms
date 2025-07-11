const AppConfig = require('../../model/AppConfig');
const Certificate = require('../../model/Certificate')
const { errorResponse, successResponse } = require('../../util/response');


exports.getCreateDataAPI = async (req, res, next) => {
    try {

        const appConfig = await AppConfig.findOne({ type: 'certificate' })

        if (!appConfig) {

            return errorResponse(res, "Certificate data does not exist", {}, 404)

        }

        return successResponse(res, "Certificate data fetched successfully", appConfig)

    } catch (error) {
        next(error);
    }
}

exports.postCertificateAPI = async (req, res, next) => {
    try {
        const userId = req.userId;

        // Helper to get the uploaded filename or fallback
        const getFilename = (field, defaultName) => {
            const file = req.files?.[field]?.[0];
            const inputValue = req.body[field];
            if (file) return file.filename;
            if (inputValue && inputValue.includes(defaultName)) return defaultName;
            return '';
        };

        const {
            templateName,
            title,
            content,
            content2,
        } = req.body;

        // Default filenames if using system assets
        const logoFile = getFilename('logoURL', 'demo39.svg');
        const bgFile = getFilename('backgroundImage', 'bg1.jpg');
        const signature1File = getFilename('signature1URL', 'signature1.png');
        const signature2File = getFilename('signature2URL', 'signature1.png');

        // Build the certificate object
        const certificate = new Certificate({
            templateName,
            title,
            content,
            content2,
            logoURL: logoFile,
            backgroundImage: bgFile,
            signature1URL: signature1File,
            signature2URL: signature2File,
            created_by: userId,
            company_id: userId
        });

        await certificate.save();

        return successResponse(res, "Certificate saved successfully");
    } catch (error) {
        next(error);
    }
};


const AppConfig = require('../../model/AppConfig');
const Certificate = require('../../model/Certificate')
const { errorResponse, successResponse } = require('../../util/response');

exports.getCertificateAPI = async (req, res, next) => {

    try {
        const userId = req.userId;
        const certificate = await Certificate.find({ created_by: userId });

        if (!certificate) {
            return errorResponse(res, "Certificate does not exist", {}, 500)
        }

        return successResponse(res, "Data fetched successfully", certificate)

    } catch (error) {
        next(error)
    }

}

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

        const {
            templateName,
            title,
            content,
            content2,
            signatureName,
            signatureContent,
            signature2Name,
            signature2Content
        } = req.body;

        // Helper to get the uploaded filename or fallback
        const getFilename = (field, defaultName) => {

            const file = req.files?.[field]?.[0];
            const inputValue = req.body[field];

            // Handle signature1URL
            if (field === 'signature1URL') {
                if (signatureName && signatureName.trim() !== '') {
                    return file ? file.filename : defaultName;
                }
                return '';
            }

            // Handle signature2URL
            if (field === 'signature2URL') {
                if (signature2Name && signature2Name.trim() !== '') {
                    return file ? file.filename : defaultName;
                }
                return '';
            }

            // Handle backgroundImage
            if (field === 'backgroundImage' && inputValue) {
                if (inputValue.includes('bg1')) {
                    return 'bg1.jpg';
                } else if (inputValue.includes('bg2')) {
                    return 'bg2.jpg';
                } else if (inputValue.includes('bg3')) {
                    return 'bg3.jpg';
                } else if (inputValue.includes('bg4')) {
                    return 'bg4.jpg';
                }
                return defaultName;
            }

            // Default for other file fields
            return file ? file.filename : defaultName;
        };

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
            signatureName,
            signatureContent,
            signatureName2: signature2Name,
            signatureContent2: signature2Content,
            signatureURL: signature1File,
            signatureURL2: signature2File,
            created_by: userId,
            company_id: userId
        });

        await certificate.save();

        return successResponse(res, "Certificate saved successfully");
    } catch (error) {
        next(error);
    }
};

exports.getEditCertificateAPI = async (req, res, next) => {
    try {
        const userId = req.userId;

        const id = req.params.id;

        const certificate = await Certificate.findOne({ created_by: userId, _id: id })

        if (!certificate) {
            return errorResponse(res, 'Certificate does not exist', {}, 404)
        }

        return successResponse(res, "Certificate edit data fetched", certificate)

    } catch (error) {
        next(error)
    }
}

exports.putUpdateCertificateAPI = async (req, res, next) => {
    try {

        const userId = req.userId;
        const id = req.params.id;

        const certificate = await Certificate.findOne({ created_by: userId, _id: id })

        const signatureImage = certificate.signatureURL;

        const signatureImage2 = certificate.signatureURL2;

        const {
            templateName,
            title,
            content,
            content2,
            signatureName,
            signatureContent,
            signature2Name,
            signature2Content
        } = req.body;

        if (!certificate) {
            return errorResponse(res, "Certificate not found", {}, 404)
        }

        // Helper to get the uploaded filename or fallback
        const getFilename = (field, defaultName) => {

            const file = req.files?.[field]?.[0];
            const inputValue = req.body[field];

            // Handle signature1URL
            if (field === 'signature1URL') {
                if (signatureName && signatureName.trim() !== '') {
                    return file ? file.filename : (signatureImage ? signatureImage : defaultName);
                }
                return '';
            }

            // Handle signature2URL
            if (field === 'signature2URL') {
                if (signature2Name && signature2Name.trim() !== '') {
                    return file ? file.filename : (signatureImage2 ? signatureImage2 : defaultName);
                }
                return '';
            }

            // Handle backgroundImage
            if (field === 'backgroundImage' && inputValue) {
                if (inputValue.includes('bg1')) {
                    return 'bg1.jpg';
                } else if (inputValue.includes('bg2')) {
                    return 'bg2.jpg';
                } else if (inputValue.includes('bg3')) {
                    return 'bg3.jpg';
                } else if (inputValue.includes('bg4')) {
                    return 'bg4.jpg';
                }
                return defaultName;
            }

            // Default for other file fields
            return file ? file.filename : defaultName;
        };

        // Default filenames if using system assets
        const logoFile = getFilename('logoURL', 'demo39.svg');
        const bgFile = getFilename('backgroundImage', 'bg1.jpg');

        const signature1File = getFilename('signature1URL', 'signature1.png');
        const signature2File = getFilename('signature2URL', 'signature1.png');

        await Certificate.findOneAndUpdate({ created_by: userId, _id: id }, {
            $set: {
                templateName,
                title,
                content,
                content2,
                logoURL: logoFile,
                backgroundImage: bgFile,
                signatureName,
                signatureContent,
                signatureName2: signature2Name,
                signatureContent2: signature2Content,
                signatureURL: signature1File,
                signatureURL2: signature2File,
                created_by: userId,
                company_id: userId
            }
        })

        return successResponse(res, "Certificate updated successfully")

    } catch (error) {
        next(error)
    }
}

exports.putChangeFrameAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const id = req.params.id;

        const certificate = await Certificate.findOne({ created_by: userId, _id: id });

        if (!certificate) {
            return errorResponse(res, 'Certificate does not exist', {}, 404);
        }

        const updatedCertificate = await Certificate.findByIdAndUpdate(
            id,
            {
                $set: {
                    backgroundImage: 'bg1.jpg'
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedCertificate) {
            return errorResponse(res, 'Certificate update failed', {}, 500);
        }

        return successResponse(res, 'Certificate updated successfully');

    } catch (error) {
        next(error);
    }
};
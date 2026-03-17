const Certificate = require("../../model/Certificate")

exports.downloadCertificate = async (req, res, next) => {
    try {

        const { certificateId } = req.params;

        const certificate = await Certificate.findById(certificateId);
        
        if (!certificate) {
            return res.status(404).json({ message: "Certificate not found" });
        }

        // generate PDF (example using pdfkit / puppeteer)
        const filePath = await generateCertificatePDF(certificate, req.user);

        res.download(filePath, "certificate.pdf");

    } catch (error) {
        next(error)
    }
};

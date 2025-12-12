const path = require("path");
const fs = require("fs");

exports.getScromContentAPI = async (req, res, next) => {
    try {
        const course = req.params.course;
        const filePath = req.params.path; // e.g., "story.html"

        if (!course || !filePath) {
            return res.status(400).json({ error: "Course or file path missing" });
        }

        // Construct absolute path to SCORM file
        const fullPath = path.join(__dirname, "../scorm", course, filePath);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: "File not found" });
        }

        // Optional: set Content-Type based on file extension
        const ext = path.extname(fullPath).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".html") contentType = "text/html";
        else if (ext === ".js") contentType = "application/javascript";
        else if (ext === ".css") contentType = "text/css";
        else if (ext === ".xml") contentType = "text/xml";

        res.setHeader("Content-Type", contentType);
        res.sendFile(fullPath);
    } catch (error) {
        next(error);
    }
};

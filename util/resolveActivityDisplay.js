// util/activityDisplay.js
const TYPE_FIELDS = [
    { key: "document_data", type: "document" },
    { key: "video_data", type: "video" },
    { key: "youtube_data", type: "youtube" },
    { key: "scorm_data", type: "scorm" },
    { key: "quiz_data", type: "quiz" },
];

exports.resolveActivityDisplay = (activity) => {
    for (const { key, type } of TYPE_FIELDS) {
        if (activity[key]?.title) {
            return { title: activity[key].title, type };
        }
    }
    return { title: activity.name || "Untitled", type: "unknown" };
};
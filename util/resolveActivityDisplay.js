// util/activityDisplay.js
const TYPE_FIELDS = [
    { key: "document_data", type: "Document" },
    { key: "video_data", type: "Video" },
    { key: "youtube_data", type: "Youtube" },
    { key: "scorm_data", type: "Scorm" },
    { key: "quiz_data", type: "Quiz" },
    { key: "questions", type: "Quiz" }
];

exports.resolveActivityDisplay = (activity) => {

    for (const { key, type } of TYPE_FIELDS) {

        if (activity[key]?.title) {
            return { title: activity[key].title ?? type, type };
        } else if (key === "questions" && activity[key].length > 0) {
            return { title: activity.name ?? type, type: type }
        }
    }
    return { title: activity.name || "Untitled", type: "unknown" };
};
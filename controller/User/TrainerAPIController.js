const mongoose = require("mongoose");
const Batch = require("../../model/Batch");
const BatchLearner = require("../../model/BatchLearner");
const BatchSession = require("../../model/BatchSession");
const BatchTrainer = require("../../model/BatchSessionTrainer");
const BatchAssignmentSubmission = require("../../model/BatchAssignment");
const User = require("../../model/User"); // adjust path to your users model
const { successResponse, errorResponse } = require("../../util/response");

exports.getTrainerOverview = async (req, res, next) => {
    try {
        const userId = (req.userId);

        const assignments = await BatchTrainer.find({ trainer_id: userId })
            .populate({
                path: "session_id",
                populate: { path: "batch_id" },
            })
            .lean();

        const sessionIds = assignments
            .map((a) => a.session_id?._id)
            .filter(Boolean);

        const batchIds = [
            ...new Set(
                assignments
                    .map((a) => a.session_id?.batch_id?._id?.toString())
                    .filter(Boolean)
            ),
        ];

        const totalLearnersEnrolled = await BatchLearner.countDocuments({
            batch_id: { $in: batchIds },
            status: { $in: ["confirmed", "nominated"] },
        });

        const pendingGrading = await BatchAssignmentSubmission.countDocuments({
            batch_id: { $in: batchIds },
            status: { $ne: "graded" },
        });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todaySessions = assignments
            .filter((a) => {
                const d = a.session_id?.session_date;
                return d && new Date(d) >= startOfDay && new Date(d) <= endOfDay;
            })
            .map((a) => ({
                id: a.session_id._id,
                batchId: a.session_id.batch_id?._id,
                batchName: a.session_id.batch_id?.name,
                sessionTitle: `Session ${a.session_id.session_number}`,
                time: `${a.session_id.start_time} - ${a.session_id.end_time}`,
                room: a.session_id.venue,
            }));

        const finalData = {
            stats: {
                activeBatches: batchIds.length,
                upcomingSessionsToday: todaySessions.length,
                totalLearnersEnrolled,
                pendingGrading,
            },
            todaySessions,
            sessionIds,
        };

        return successResponse(res, "Trainer overview fetched successfully", finalData);
    } catch (error) {
        next(error);
    }
};

exports.getTrainerProfile = async (req, res, next) => {
    try {
        const userId = req.userId;

        console.log(userId)

        const user = await User.findById(userId)
            .select("first_name last_name email phone title bio email_notifications sms_reminders")
            .lean();

        if (!user) {
            return errorResponse(res, "Trainer not found", {}, 404);
        }

        return successResponse(res, "Trainer profile fetched successfully", { profile: user });
    } catch (error) {
        next(error);
    }
};

exports.updateTrainerProfile = async (req, res, next) => {
    try {
        const userId = req?.userId;
        const { first_name, last_name, title, bio, email_notifications, sms_reminders } = req.body;

        const updated = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    ...(first_name !== undefined && { first_name }),
                    ...(last_name !== undefined && { last_name }),
                    ...(title !== undefined && { title }),
                    ...(bio !== undefined && { bio }),
                    ...(email_notifications !== undefined && { email_notifications }),
                    ...(sms_reminders !== undefined && { sms_reminders }),
                },
            },
            { new: true }
        ).select("first_name last_name email phone title bio email_notifications sms_reminders");

        if (!updated) {
            return errorResponse(res, "Trainer not found", {}, 404);
        }

        return successResponse(res, "Profile updated successfully", { profile: updated });
    } catch (error) {
        next(error);
    }
};
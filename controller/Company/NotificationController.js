const notification = require('../../model/Notifications')
const AppConfig = require('../../model/AppConfig')
const { errorResponse, successResponse } = require('../../util/response')
const { default: mongoose } = require('mongoose')

exports.getCreateNotificationAPI = async (req, res, next) => {
    try {

        const appConfig = await AppConfig.findOne({ type: "notification" })

        if (!appConfig) {
            return errorResponse(res, "Notification does not exist", {}, 404)
        }

        return successResponse(res, "Data fetched successfully", appConfig)

    } catch (error) {
        next(error)
    }
}

exports.getNotificationDataAPI = async (req, res, next) => {
    try {
        const userId = req.userId;

        const mongoose = require('mongoose');

        const Notifications = await notification.aggregate([
            {
                $match: {
                    created_by: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $lookup: {
                    from: 'app_config',
                    pipeline: [
                        { $unwind: '$notification_data' },
                        {
                            $project: {
                                notification_data: 1,
                                notification_type_id: '$notification_data._id',
                                category_list: '$notification_data.category'
                            }
                        }
                    ],
                    as: 'app_config_data'
                }
            },
            { $unwind: '$app_config_data' },
            {
                $match: {
                    $expr: {
                        $eq: ['$notification_type', '$app_config_data.notification_type_id']
                    }
                }
            },
            {
                $addFields: {
                    category_list: '$app_config_data.category_list'
                }
            },
            {
                $unwind: {
                    path: '$category_list',
                    preserveNullAndEmptyArrays: true // Keep documents even if no categories
                }
            },
            {
                $match: {
                    $expr: {
                        $or: [
                            { $eq: ['$category_type', null] }, // if category_type is null, allow
                            { $eq: ['$category_type', '$category_list._id'] } // or match normally
                        ]
                    }
                }
            },
            {
                $addFields: {
                    notification_type_name: '$app_config_data.notification_data.type',
                    category_name: {
                        $cond: [
                            { $eq: ['$category_type', null] },
                            '',
                            '$category_list.name'
                        ]
                    }
                }
            },
            {
                $project: {
                    template_name: 1,
                    subject: 1,
                    message: 1,
                    footer: 1,
                    created_by: 1,
                    created_at: 1,
                    updated_at: 1,
                    notification_type_name: 1,
                    category_name: 1
                }
            }
        ]);


        if (!Notifications) {
            return errorResponse(res, "No notifications found", {}, 404);
        }

        return successResponse(res, "Notification data fetched successfully", Notifications);

    } catch (err) {
        next(err)
    }
};

exports.postNotificationDataAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const {
            template_name,
            notification_type,
            category_type,
            subject,
            message,
            footer
        } = req.body

        const Notification = new notification({
            template_name,
            category_type,
            notification_type,
            subject,
            message,
            footer,
            created_by: userId
        })

        await Notification.save();

        return successResponse(res, "Notification saved successfully!")

    } catch (error) {
        next(error)
    }
}

exports.getEditNotificationAPI = async (req, res, next) => {

    try {

        const userId = req.userId;

        const id = req.params.id;

        const Notification = await notification.findOne({ created_by: userId, _id: id })

        if (!Notification) {
            return errorResponse(res, "Notification does not exist", {}, 404)
        }

        return successResponse(res, "Notification fetched successfully", Notification)

    } catch (error) {
        next(error)
    }
}

exports.putUpdateNotificationAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const id = req.params.id;

        const {
            template_name,
            notification_type,
            category_type,
            subject,
            message,
            footer
        } = req.body

        await notification.findOneAndUpdate({ created_by: userId, _id: id },
            {
                $set: {
                    template_name,
                    notification_type,
                    category_type,
                    subject,
                    message,
                    footer
                }
            }
        )

        return successResponse(res, "Notification updated successfully")

    } catch (error) {
        next(error)
    }
}
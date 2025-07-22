const notification = require('../../model/Notifications')
const AppConfig = require('../../model/AppConfig')
const { errorResponse, successResponse } = require('../../util/response')
const mongoose = require('mongoose');

exports.getCreateNotificationAPI = async (req, res, next) => {
    try {

        const appConfig = await AppConfig.findOne({ type: "notification" })

        const placeholder = await AppConfig.findOne({ type: "placeholder" })

        if (!appConfig || !placeholder) {
            return errorResponse(res, "Data does not exist", {}, 404)
        }

        const finalData = {
            notification: appConfig,
            placeholder
        }

        return successResponse(res, "Data fetched successfully", finalData)

    } catch (error) {
        next(error)
    }
}

exports.getNotificationDataAPI = async (req, res, next) => {
    try {
        const userId = req.userId;

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
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    $expr: {
                        $or: [
                            { $eq: ['$category_type', null] },
                            { $eq: ['$category_type', '$category_list._id'] }
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
                    default_select: true,
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
            footer,
            default_select
        } = req.body

        const Notification = new notification({
            template_name,
            category_type,
            notification_type,
            default_select,
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
            footer,
            default_select,
        } = req.body

        await notification.findOneAndUpdate({ created_by: userId, _id: id },
            {
                $set: {
                    template_name,
                    notification_type,
                    category_type,
                    subject,
                    message,
                    footer,
                    default_select
                }
            }
        )

        return successResponse(res, "Notification updated successfully")

    } catch (error) {
        next(error)
    }
}

exports.getFormNotificationAPI = async (req, res, next) => {
    try {

        const typeId = req.params.id;

        const userId = req.userId;

        const Notification = await notification.aggregate([
            {
                $match: {
                    notification_type: new mongoose.Types.ObjectId(typeId)
                }
            },
            {
                $addFields: {
                    matched_user_input: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: '$user_input',
                                    as: 'input',
                                    cond: {
                                        $eq: ['$$input.created_by', new mongoose.Types.ObjectId(userId)]
                                    }
                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'app_config',
                    let: { categoryType: '$category_type' },
                    pipeline: [
                        { $unwind: '$notification_data' },
                        { $unwind: '$notification_data.category' },
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$notification_data.category._id', '$$categoryType']
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                category: '$notification_data.category.name'
                            }
                        }
                    ],
                    as: 'matched_categories'
                }
            },
            {
                $unwind: {
                    path: '$matched_categories',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    category: '$matched_categories.category',
                    subject: {
                        $ifNull: ['$matched_user_input.subject', '$subject']
                    },
                    message: {
                        $ifNull: ['$matched_user_input.message', '$message']
                    },
                    footer: {
                        $ifNull: ['$matched_user_input.footer', '$footer']
                    },
                    default_select: {
                        $ifNull: ['$matched_user_input.default_select', '$default_select']
                    }
                }
            },
            {
                $project: {
                    user_input: 0,
                    matched_user_input: 0,
                    matched_categories: 0
                }
            }
        ]);

        if (!Notification) {
            return errorResponse(res, "Notification does not exist", {}, 404)
        }

        return successResponse(res, "Data fetched successfully", Notification);

    } catch (error) {
        next(error)
    }
}

exports.updateNotificationAPI = async (req, res, next) => {
    try {

        const id = req.params.id;
        const userId = req.userId;

        const { subject, footer, message, default_select } = req.body;

        const existNotification = await notification.findOne({
            _id: id,
            'user_input.created_by': userId
        })

        let Notification;

        if (existNotification) {

            Notification = await notification.updateOne({ _id: id, 'user_input.created_by': userId }, {
                $set: {
                    'user_input.$.subject': subject,
                    'user_input.$.message': message,
                    'user_input.$.footer': footer,
                    'user_input.$.default_select': default_select,
                }
            })

        } else {

            Notification = await notification.findByIdAndUpdate(id, {
                $push: {
                    user_input: {
                        subject,
                        message,
                        footer,
                        default_select,
                        created_by: userId
                    }
                }
            })

        }

        if (!Notification) {
            return errorResponse(res, "Notification not found", {}, 404)
        }

        return successResponse(res, "Notification updated successfully")

    } catch (error) {
        next(error)
    }
}
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
                    created_by: mongoose.Types.ObjectId.createFromHexString(userId)
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
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            default_select
        } = req.body

        let headerLogo = "";
        let footerLogo = "";

        // save file paths if uploaded
        if (req.files?.header_logo) {
            headerLogo = req.files.header_logo[0].path
        }

        if (req.files?.footer_logo) {
            footerLogo = req.files.footer_logo[0].path
        }

        const Notification = new notification({
            template_name,
            category_type,
            notification_type,
            default_select,
            subject,
            header_logo_align,
            footer_logo_align,
            show_footer_logo,
            header_logo: headerLogo,
            footer_logo: footerLogo,
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
        const userId = req.userId
        const id = req.params.id

        const {
            template_name,
            notification_type,
            category_type,
            subject,
            message,
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            footer,
            default_select
        } = req.body

        const updateData = {
            template_name,
            notification_type,
            category_type,
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            subject,
            message,
            footer,
            default_select
        }


        // save file paths if uploaded
        if (req.files?.header_logo) {
            updateData.header_logo =
                req.files.header_logo[0].path
        }

        if (req.files?.footer_logo) {
            updateData.footer_logo =
                req.files.footer_logo[0].path
        }

        await notification.findOneAndUpdate(
            { created_by: userId, _id: id },
            { $set: updateData },
            { new: true }
        )

        return successResponse(res, 'Notification updated successfully')
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
                    notification_type: mongoose.Types.ObjectId.createFromHexString(typeId)
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
                                        $eq: ['$$input.created_by', mongoose.Types.ObjectId.createFromHexString(userId)]
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
                    },
                    show_footer_logo: {
                        $ifNull: ['$matched_user_input.show_footer_logo', '$show_footer_logo']
                    },
                    header_logo: {
                        $ifNull: ['$matched_user_input.header_logo', '$header_logo']
                    },
                    footer_logo: {
                        $ifNull: ['$matched_user_input.footer_logo', '$footer_logo']
                    },
                    header_logo_align: {
                        $ifNull: ['$matched_user_input.header_logo_align', '$header_logo_align']
                    },
                    footer_logo_align: {
                        $ifNull: ['$matched_user_input.footer_logo_align', '$footer_logo_align']
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

        const {
            template_name,
            notification_type,
            category_type,
            subject,
            message,
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            footer,
            default_select
        } = req.body

        const updateData = {
            template_name,
            notification_type,
            category_type,
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            subject,
            message,
            footer,
            default_select,
            created_by: userId
        }

        const existNotification = await notification.findOne({
            _id: id,
            'user_input.created_by': userId
        })

        let Notification;

        if (req.files?.header_logo) {
            updateData.header_logo =
                req.files.header_logo[0].path
        } else if (existNotification && existNotification?.user_input?.[0]?.header_logo) {
            updateData.header_logo = existNotification?.user_input?.[0]?.header_logo;
        } else {
            updateData.header_logo = existNotification?.header_logo;
        }

        if (req.files?.footer_logo) {
            updateData.footer_logo =
                req.files.footer_logo[0].path
        } else if (existNotification && existNotification?.user_input?.[0]?.footer_logo) {
            updateData.footer_logo = existNotification?.user_input?.[0]?.footer_logo;
        } else {
            updateData.footer_logo = existNotification?.footer_logo;
        }

        if (existNotification) {

            Notification = await notification.updateOne({ _id: id, 'user_input.created_by': userId }, {
                $set: {
                    'user_input.$.subject': updateData.subject,
                    'user_input.$.message': updateData.message,
                    'user_input.$.footer': updateData.footer,
                    'user_input.$.default_select': updateData.default_select,
                    'user_input.$.header_logo_align': updateData.header_logo_align,
                    'user_input.$.show_footer_logo': updateData.show_footer_logo,
                    'user_input.$.header_logo': updateData.header_logo,
                    'user_input.$.footer_logo': updateData.footer_logo,
                    'user_input.$.footer_logo_align': updateData.footer_logo_align,
                    'user_input.$.created_by': userId
                }
            })

        } else {

            Notification = await notification.findByIdAndUpdate(id, {
                $push: {
                    user_input: updateData
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

exports.getCheckSelectNotificationAPI = async (req, res, next) => {
    try {
        const id = req.params.id;
        const userId = req.userId;

        const {
            template_name,
            notification_type,
            category_type,
            subject,
            message,
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            header_logo,
            footer_logo,
            footer,
            default_select
        } = req.body

        const updateData = {
            template_name,
            notification_type,
            category_type,
            show_footer_logo,
            header_logo_align,
            footer_logo_align,
            subject,
            message,
            footer,
            header_logo,
            footer_logo,
            default_select,
            created_by: userId
        }

        const existNotification = await notification.findOne({
            _id: id,
            'user_input.created_by': userId
        })

        if (existNotification) {

            await notification.updateOne({ _id: id, 'user_input.created_by': userId }, {
                $set: {
                    'user_input.$.subject': updateData.subject,
                    'user_input.$.message': updateData.message,
                    'user_input.$.footer': updateData.footer,
                    'user_input.$.default_select': updateData.default_select,
                    'user_input.$.header_logo_align': updateData.header_logo_align,
                    'user_input.$.show_footer_logo': updateData.show_footer_logo,
                    'user_input.$.header_logo': updateData.header_logo,
                    'user_input.$.footer_logo': updateData.footer_logo,
                    'user_input.$.footer_logo_align': updateData.footer_logo_align,
                    'user_input.$.created_by': userId
                }
            })

        }

        return successResponse(res, "Notification updated successfully")

    } catch (error) {

        next(error)
    }

}
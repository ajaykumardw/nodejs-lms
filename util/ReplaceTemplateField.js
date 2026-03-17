const mongoose = require("mongoose");
const Handlebars = require("handlebars");

const User = require("../model/User");
const AppConfig = require("../model/AppConfig");
const Notification = require("../model/Notifications");
const ScheduleNotification = require("../model/ScheduleNotification")

const sendMail = require("./sendMail");
const { decrypt } = require("./encryption");

const supportLink = process.env.SUPPORT_LINK || "";
const supportEmail = process.env.SUPPORT_EMAIL || "";
const appName = process.env.APP_NAME || "";

const sendMailFunction = async ({ scheduleNotification, userId, isCompany, to, subject, html }) => {

    const schedUserId = scheduleNotification?.schedule_user_id;

    const hasUser = schedUserId.includes(userId)

    const repeatType = scheduleNotification.repeat_type;

    if ((hasUser || isCompany) && repeatType === "1") {

        await sendMail({ to, subject, html });

    }
}

module.exports = async ({
    userId,
    notificationId,
    to,
    event,
    means,
    explanation,
    userPassword = "",
    moduleId = "",
    isCompany = true
}) => {
    try {

        const [notification, userData, appConfig] = await Promise.all([
            Notification.findById(notificationId).lean(),
            User.aggregate([
                { $match: { _id: mongoose.Types.ObjectId.createFromHexString(userId) } },
                {
                    $addFields: {
                        country_id_num: { $toInt: "$country_id" },
                        state_id_num: { $toInt: "$state_id" },
                        city_id_num: { $toInt: "$city_id" },
                    },
                },
                {
                    $addFields: {
                        latestCode: {
                            $arrayElemAt: [
                                { $sortArray: { input: "$codes", sortBy: { issued_on: -1 } } },
                                0,
                            ],
                        },
                    },
                },
                {
                    $lookup: {
                        from: "countries",
                        localField: "country_id_num",
                        foreignField: "country_id",
                        as: "country",
                    },
                },
                { $unwind: { path: "$country", preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        state: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: "$country.states",
                                        as: "state",
                                        cond: { $eq: ["$$state.state_id", "$state_id_num"] },
                                    },
                                },
                                0,
                            ],
                        },
                    },
                },
                {
                    $addFields: {
                        city: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: "$state.cities",
                                        as: "city",
                                        cond: { $eq: ["$$city.city_id", "$city_id_num"] },
                                    },
                                },
                                0,
                            ],
                        },
                    },
                },
                {
                    $project: {
                        first_name: 1,
                        last_name: 1,
                        email: 1,
                        phone: 1,
                        empCode: "$latestCode.code",
                        countryName: "$country.country_name",
                        stateName: "$state.state_name",
                        cityName: "$city.city_name",
                    },
                },
            ]),
            AppConfig.findOne({ default_email_layout: { $exists: true, $ne: null } }).lean(),
        ]);

        if (!notification || !userData?.length || !appConfig) {
            throw new Error("Required data not found");
        }

        const user = userData[0];

        const userSpecificInput = notification.user_input?.find(
            (item) => item?.created_by?.toString() === userId
        );

        const isSelected = userSpecificInput?.default_select ?? notification.default_select ?? false;

        const headerLogoUrl = `${supportLink}/${userSpecificInput?.header_logo ?? notification.header_logo ?? "company_logo/demo39.svg"}`;
        const footerLogoUrl = `${supportLink}/${userSpecificInput?.footer_logo ?? notification.footer_logo ?? "company_logo/demo39.svg"}`;

        const showFooterImage = userSpecificInput?.show_footer_logo ?? notification?.show_footer_logo ?? false;
        const headerAlign = userSpecificInput?.header_logo_align ?? notification?.header_logo_align ?? "center";
        const footerAlign = userSpecificInput?.footer_logo_align ?? notification?.footer_logo_align ?? "center";

        if (!isSelected) return;

        const replacements = {
            "user_first-name": user.first_name || "",
            "user_last-name": user.last_name || "",
            "user_phone": decrypt(user.phone || ""),
            'user_email': decrypt(user.email || ""),
            'user_country': user.countryName || "",
            'user_state': user.stateName || "",
            'user_city': user.cityName || "",
            "user_employee-id": user.empCode || "",
            "user_password": userPassword || "",
            'app_event': event || "",
            'app_means': means || "",
            'app_explanation': explanation || "",
            'app_supportemail': supportEmail,
            'app_supportlink': supportLink,
            'app_name': appName,
        };

        const compiledSubject = Handlebars.compile(userSpecificInput?.subject || notification.subject || "Notification");
        const compiledMessage = Handlebars.compile(userSpecificInput?.message || notification.message || "");
        const compiledFooter = Handlebars.compile(userSpecificInput?.footer || notification.footer || "");

        const subject = compiledSubject(replacements);
        const message = compiledMessage(replacements);
        const footer = compiledFooter(replacements);

        const bodyContent = `
          <div style="margin-bottom:16px;">${message}</div>
          <div style="margin-top:16px;">${footer}</div>
        `

        // Step 4: Compile email template
        const compiledTemplate = Handlebars.compile(appConfig.default_email_layout);

        const html = compiledTemplate({
            body: bodyContent,
            headerLogoUrl,
            headerAlign,
            showFooterImage,
            footerImageUrl: footerLogoUrl,
            footerAlign,
        });

        const scheduleNotification = await ScheduleNotification.findOne({
            template_id: notificationId,
            created_by: userId
        })


        if (notificationId === "6878cd0351dcbae6759e8912" && scheduleNotification) {

            console.log("Template", notificationId === "6878cd0351dcbae6759e8912");


            await sendMailFunction({ scheduleNotification, userId, isCompany, to, subject, html })


        } else if (scheduleNotification) [


            await sendMailFunction({ scheduleNotification, userId, isCompany, to, subject, html })


        ]


    } catch (err) {
        console.error("Notification Mail Error:", err);
        throw err;
    }
};

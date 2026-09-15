const mongoose = require("mongoose")

const Certificate = require('../../model/Certificate')
const department = require('../../model/Department')
const designation = require('../../model/Designation')
const group = require('../../model/Group')
const ModuleReminder = require("../../model/ModuleReminder")
const AppConfig = require("../../model/AppConfig")
const Activity = require('../../model/Activity')
const user = require('../../model/User')
const ContentFolder = require("../../model/ContentFolder")
const Zone = require('../../model/Zone')
const ModuleSetting = require('../../model/ModuleSetting')
const ModuleSurvey = require('../../model/ModuleSurvey');
const Module = require("../../model/Module")
const ProgramSchedule = require("../../model/ProgramSchedule")
const ScheduleUser = require("../../model/ScheduleUser")
const Batch = require("../../model/Batch");
const BatchLearner = require("../../model/BatchLearner");
const BatchSession = require("../../model/BatchSession");
const BatchSessionTrainer = require("../../model/BatchSessionTrainer");
const ScheduleType = require("../../model/ScheduleType")
const UserModuleEnroll = require("../../model/UserModuleEnroll")
const UserSelfEnroll = require("../../model/UserSelfEnroll")
const ReplaceTemplateField = require('../../util/ReplaceTemplateField')

const { decrypt } = require('../../util/encryption')
const { successResponse, errorResponse } = require('../../util/response');

exports.getILTAPIController = async (req, res, next) => {
    try {

        const { moduleId } = req.params;
        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId)

        const certificate = await Certificate.find({ created_by: userId })

        const moduleSurvey = await ModuleSurvey.find({
            moduleId,
            createdBy: userId
        });

        const moduleReminder = await ModuleReminder.findOne({
            module_id: moduleId,
            created_by: userId
        })

        const appConfig = await AppConfig.aggregate([
            {
                $match: { type: 'Activity_data' }
            },
            {
                $project: {
                    activity_data: {
                        $filter: {
                            input: '$activity_data',
                            as: 'item',
                            cond: { $eq: ['$$item.status', true] }
                        }
                    }
                }
            }
        ])

        const activity = await Activity.aggregate([
            {
                $match: {
                    created_by: (userId),
                    module_id: mongoose.Types.ObjectId.createFromHexString(moduleId)
                }
            },
            {
                $lookup: {
                    from: 'app_config',
                    let: { moduleTypeId: '$module_type_id' },
                    pipeline: [
                        { $unwind: '$activity_data' },
                        {
                            $match: {
                                $expr: { $eq: ['$activity_data._id', '$$moduleTypeId'] }
                            }
                        },
                        { $project: { _id: 0, activity_data: 1 } }
                    ],
                    as: 'activity_type'
                }
            },
            {
                $unwind: {
                    path: '$activity_type',
                    preserveNullAndEmptyArrays: true
                }
            },
            // Populate virtual 'questions'
            {
                $lookup: {
                    from: 'questions', // collection name
                    localField: '_id', // Activity _id
                    foreignField: 'activity_id', // questions.activity_id
                    as: 'questions' // result array
                }
            }
        ])

        const module = await Module.findById(moduleId)

        if (!module) {
            return errorResponse(res, 'Module not found', {}, 404)
        }

        const ContentFolderId = module?.content_folder_id

        let programSchedule = await ProgramSchedule
            .findOne({
                company_id: userId,
                module_id: moduleId,
                content_folder_id: ContentFolderId
            })
            .lean()

        if (!programSchedule) {
            programSchedule = {}
        }

        const scheduleTypes = await ScheduleType
            .find({
                schedule_id: programSchedule._id,
                company_id: userId
            })
            .lean()

        // Normalize into frontend format
        const grouped = {}

        scheduleTypes.forEach(su => {
            if (!grouped[su.type]) grouped[su.type] = []
            grouped[su.type].push(String(su.type_id))
        })

        const targetPairs = Object.entries(grouped).map(([target, options]) => ({
            target,
            options
        }))

        const moduleSetting = await ModuleSetting.findOne({
            moduleId,
            createdBy: userId
        })

        const finalSchedule = {
            ...programSchedule,
            moduleSetting,
            targetPairs
        }

        const finalData = {
            certificate,
            moduleSurvey,
            activity,
            moduleReminder,
            appConfig: appConfig?.[0],
        }

        const regions = await Zone.aggregate([
            {
                $match: { created_by: userId } // filter zones created by this user
            },
            {
                $unwind: '$region' // split region array into individual docs
            },
            {
                $replaceRoot: { newRoot: '$region' } // keep only region data
            }
        ])

        finalData['department'] = await department.find({
            created_by: userId,
            status: true
        })

        finalData['designation'] = await designation.find({
            company_id: userId,
            status: true
        })

        finalData['group'] = await group.find({ company_id: userId, status: true }).select("_id name description status")

        finalData['user'] = await user
            .find({ created_by: userId, status: true })
            .select("_id first_name last_name email phone email_hash phone_hash address dob pincode photo employee_type emp_id")
            .populate('company_id', '_id first_name last_name email phone email_hash phone_hash address dob pincode photo employee_type emp_id')

        finalData['region'] = regions

        const filter = {
            created_by: userId
        };

        const LEARNER_ROLE_ID = '683ecef236ffdce90d2e1270';
        const TRAINER_ROLE_ID = '682462e9d71f301af3fc4d57';

        const userSelect =
            '_id first_name last_name email phone address pincode codes company_name';

        const userPopulate = {
            path: 'roles',
            populate: {
                path: 'role_id',
                select: '_id name'
            }
        };

        const allUsers = await user.find(filter)
            .select(userSelect)
            .populate(userPopulate)
            .sort({
                first_name: 1,
                last_name: 1
            })
            .lean({
                virtuals: true
            });

        const learnerList = allUsers.filter((item) =>
            item.roles?.some(
                (role) =>
                    role.role_id?._id?.toString() === LEARNER_ROLE_ID
            )
        );

        const trainerList = allUsers.filter((item) =>
            item.roles?.some(
                (role) =>
                    role.role_id?._id?.toString() === TRAINER_ROLE_ID
            )
        );

        const finalLearnerList = learnerList.map(u => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null
        }))

        const finalTrainerList = trainerList.map(u => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null
        }))

        finalData.learner = finalLearnerList;

        finalData.trainer = finalTrainerList;

        finalData["batch"] = await Batch.find({
            module_id: moduleId,
            created_by: userId,
        })
            .populate({
                path: "sessions",
                populate: {
                    path: "trainers",
                    populate: {
                        path: "trainer_id",
                        model: "users",
                        select: "_id first_name last_name email codes emp_id",
                    },
                },
            })
            .populate({
                path: "learners",
                populate: {
                    path: "learner_id",
                    model: "users",
                    select: "_id first_name last_name email emp_id",
                },
            })
            .lean({
                virtuals: true,
            });

        finalData['finalSchedule'] = finalSchedule;

        return successResponse(res, "ILT fetched successfully", finalData)

    } catch (error) {
        next(error)
    }
}

exports.postILTReminderController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const { moduleId } = req?.params;

        const {
            body,
            ccBuddyTrainer,
            ccReportingManager,
            daysBefore,
            endsOnBatchStart,
            event,
            frequency,
            repeatDays,
            subject
        } = req?.body

        const module_reminder = await ModuleReminder.findOne({
            created_by: userId,
            module_id: moduleId
        })

        let reminder;

        if (!module_reminder) {
            reminder = await ModuleReminder.create({
                body,
                ccBuddyTrainer,
                ccReportingManager,
                daysBefore,
                endsOnBatchStart,
                event,
                frequency,
                repeatDays,
                subject,
                module_id: moduleId,
                created_by: userId
            });
        } else {
            reminder = await ModuleReminder.findOneAndUpdate(
                {
                    created_by: userId,
                    module_id: moduleId
                },
                {
                    body,
                    ccBuddyTrainer,
                    ccReportingManager,
                    daysBefore,
                    endsOnBatchStart,
                    event,
                    frequency,
                    repeatDays,
                    subject,
                    updated_by: userId
                },
                {
                    new: true // returns the updated document
                }
            );
        }

        return successResponse(
            res,
            "Module reminder saved successfully",
            reminder
        );

    } catch (error) {
        next(error)
    }
}

exports.postILTModuleSettingAPIController = async (req, res, next) => {
    try {

        const userId = req?.userId;
        const { moduleId } = req?.params;

        const {
            editPermission,
            certificate,
            feedbackSurvey,
            selfEnrollment,
            communication
        } = req?.body;

        const finalUserSet = new Set()

        const module = await Module.findById(moduleId)

        const users = await user.find({ created_by: userId }).select('_id')

        const userSelectId = users.map(u => u._id)

        if (!module) {
            return errorResponse(res, 'Module not found', {}, 404)
        }

        let moduleSetting = await ModuleSetting.findOne({
            moduleId,
            createdBy: userId
        })

        const contentFolderId = module.content_folder_id;

        const content_folder = await ContentFolder.findById(
            contentFolderId
        )

        if (!content_folder) {
            return errorResponse(res, 'Content folder not found', {}, 404)
        }

        const programId = content_folder.program_id

        let programs = await ProgramSchedule.findOne({
            module_id: moduleId,
            content_folder_id: contentFolderId,
            program_id: programId,
            company_id: userId
        })

        if (!moduleSetting) {

            moduleSetting = await ModuleSetting.create({
                moduleId,
                createdBy: userId,
                feedbackSurveyEnabled: feedbackSurvey?.enabled,
                certificateEnabled: certificate?.enabled,
                trainerAllowed: editPermission?.disallowOtherTrainers,
                selectedCertificateId: certificate?.certificate_id,
                reminderEnabled: communication?.emailReminder
            })
        } else {

            moduleSetting = await ModuleSetting.findOneAndUpdate({
                moduleId,
                createdBy: userId,
            }, {
                feedbackSurveyEnabled: feedbackSurvey?.enabled,
                certificateEnabled: certificate?.enabled,
                trainerAllowed: editPermission?.disallowOtherTrainers,
                selectedCertificateId: certificate?.certificate_id,
                reminderEnabled: communication?.emailReminder
            })

        }

        let program;

        if (!programs) {

            program = await ProgramSchedule.create({
                program_id: programId,
                module_id: moduleId,
                company_id: userId,
                content_folder_id: contentFolderId,
                published_date: Date.now(),
                selfEnrollmentSetting: selfEnrollment?.type,
                created_by: userId,
                created_at: new Date()
            })
        } else {

            program = await ProgramSchedule.findOneAndUpdate({
                program_id: programId,
                module_id: moduleId,
                company_id: userId,
                content_folder_id: contentFolderId,
                created_by: userId,
            }, {
                published_date: Date.now(),
                selfEnrollmentSetting: selfEnrollment?.type,
            })

        }

        await ScheduleType.deleteMany({
            schedule_id: program._id,
            company_id: userId
        })

        await ScheduleUser.deleteMany({
            schedule_id: program._id,
            company_id: userId
        })

        if (!Array.isArray(selfEnrollment?.targetAudience) || selfEnrollment?.targetAudience?.length === 0) {
            return successResponse(res, 'Settings saved successfully')
        }

        const scheduleTypes = []

        for (const pair of selfEnrollment?.targetAudience) {
            if (!pair.target || !Array.isArray(pair.options)) continue

            for (const optionId of pair.options) {
                scheduleTypes.push({
                    company_id: userId,
                    schedule_id: program._id,
                    module_id: moduleId,
                    type: Number(pair.target),
                    type_id: mongoose.Types.ObjectId.isValid(optionId)
                        ? mongoose.Types.ObjectId.createFromHexString(optionId)
                        : loptionId
                })
            }
        }

        if (scheduleTypes.length === 0) {
            return successResponse(res, 'Settings saved successfully')
        }

        await ScheduleType.insertMany(scheduleTypes)

        const bulkUsers = []

        for (const item of scheduleTypes) {

            const { type, type_id } = item

            let targetUsers = []

            switch (type) {
                case 1:
                    targetUsers = await user
                        .find({ designation_id: type_id })
                        .select('_id')
                    break
                case 2:
                    targetUsers = await user
                        .find({ department_id: type_id })
                        .select('_id')
                    break
                case 3:
                    targetUsers = await user.find({ group_id: type_id }).select('_id')
                    break
                case 4:
                    targetUsers = await user.find({ region_id: type_id }).select('_id')
                    break
                case 5:
                    finalUserSet.add(type_id.toString())
                    continue
            }

            for (const u of targetUsers) {
                finalUserSet.add(u._id.toString())
                bulkUsers.push({
                    schedule_id: program._id,
                    module_id: moduleId,
                    company_id: userId,
                    type,
                    type_id,
                    user_id: u._id
                })
            }
        }

        if (bulkUsers.length) {
            await ScheduleUser.insertMany(bulkUsers)
        }

        const finalUsers = [...finalUserSet].map(id => ({
            user_id: mongoose.Types.ObjectId.createFromHexString(id),
            schedule_id: program._id,
            module_id: moduleId,
            created_by: userId,
            created_at: new Date()
        }))

        const finalSelectUsers = [...userSelectId].map(id => ({
            user_id: (id),
            schedule_id: program._id,
            module_id: moduleId,
            created_by: userId,
            created_at: new Date()
        }))

        await UserModuleEnroll.deleteMany({
            module_id: moduleId,
            schedule_id: program._id
        })

        await UserSelfEnroll.deleteMany({
            module_id: moduleId,
            schedule_id: program._id
        })

        if (selfEnrollment?.type === '3' && finalUsers.length) {
            await UserSelfEnroll.insertMany(finalUsers)
        } else if (selfEnrollment?.type === '2' && finalSelectUsers.length) {
            await UserSelfEnroll.insertMany(finalSelectUsers)
        }

        for (const id of finalUserSet) {
            const userDoc = await user.findById(id).lean()

            if (!userDoc) continue

            const email = userDoc.email

            await ReplaceTemplateField({
                userId: id.toString(),
                notificationId: '699415f604d510db61a1c128',
                to: decrypt(email),
                event: 'Training Schedule Update',
                means: 'Training Schedule Update',
                explanation: 'Training schedule updated successfully',
                userPassword: ''
            })
        }

        return successResponse(res, "Module setting saved successfully")

    } catch (error) {
        next(error)
    }
}

exports.postILTBatchAPIController = async (req, res, next) => {
    const mongoSession = await mongoose.startSession();

    try {

        const userId = req?.userId;

        const {
            moduleId
        } = req?.params;

        const {
            type,
            name,
            capacity = null,
            startDate = null,
            endDate = null,
            venue,
            cost,
        } = req.body;

        if (!type) {

            return errorResponse(res, "Batch type is required.", {}, 400);
        }

        if (!["nominated", "defined"].includes(type)) {

            return errorResponse(res, "Batch type must be either nominated or defined.", {}, 400);
        }

        if (!name?.trim()) {

            return errorResponse(res, "Batch name is required.", {}, 400);
        }

        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);

        let costPerLearner = 0;

        if (cost !== undefined && cost !== null && cost !== "") {
            costPerLearner = Number(cost);

            if (
                Number.isNaN(costPerLearner) ||
                costPerLearner < 0
            ) {
                return errorResponse(
                    res,
                    "cost must be a valid number greater than or equal to 0.", {},
                    400
                );
            }
        }

        let learners = [];

        try {
            if (req.body.learners) {
                learners =
                    typeof req.body.learners === "string" ?
                        JSON.parse(req.body.learners) :
                        req.body.learners;
            }
        } catch (error) {
            return errorResponse(
                res,
                "Invalid learners JSON.", {},
                400
            );
        }

        let sessions = [];

        try {
            if (req.body.sessions) {
                sessions =
                    typeof req.body.sessions === "string" ?
                        JSON.parse(req.body.sessions) :
                        req.body.sessions;
            }
        } catch (error) {
            return errorResponse(
                res,
                "Invalid sessions JSON.", {},
                400
            );
        }

        if (!Array.isArray(learners)) {
            return errorResponse(
                res,
                "learners must be an array.", {},
                400
            );
        }

        if (!Array.isArray(sessions)) {
            return errorResponse(
                res,
                "sessions must be an array.", {},
                400
            );
        }

        for (
            let index = 0; index < learners.length; index++
        ) {
            const learner = learners[index];

            if (!learner?.learner_id) {
                return errorResponse(
                    res,
                    `Learner ${index + 1}: learner_id is required.`, {},
                    400
                );
            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    learner.learner_id
                )
            ) {
                return errorResponse(
                    res,
                    `Learner ${index + 1}: invalid learner_id.`, {},
                    400
                );
            }

            if (
                learner.status &&
                ![
                    "nominated",
                    "not_responded",
                    "confirmed",
                    "declined",
                ].includes(learner.status)
            ) {
                return errorResponse(
                    res,
                    `Learner ${index + 1}: invalid status.`, {},
                    400
                );
            }
        }

        const learnerIds = learners.map(
            (learner) => learner.learner_id.toString()
        );

        const uniqueLearnerIds = new Set(learnerIds);

        if (uniqueLearnerIds.size !== learnerIds.length) {
            return errorResponse(
                res,
                "Duplicate learners are not allowed in the batch.", {},
                400
            );
        }

        for (
            let index = 0; index < sessions.length; index++
        ) {
            const sessionData = sessions[index];

            if (!sessionData?.date) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: session_date is required.`, {},
                    400
                );
            }

            const sessionDate = new Date(
                sessionData.date
            );

            if (Number.isNaN(sessionDate.getTime())) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: invalid session_date.`, {},
                    400
                );
            }

            if (
                sessionDate < parsedStartDate ||
                sessionDate > parsedEndDate
            ) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: session_date must be between startDate and endDate.`, {},
                    400
                );
            }

            if (!sessionData?.startTime) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: start_time is required.`, {},
                    400
                );
            }

            if (!sessionData?.endTime) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: end_time is required.`, {},
                    400
                );
            }

            const timeRegex =
                /^([01]\d|2[0-3]):([0-5]\d)$/;

            if (!timeRegex.test(sessionData.startTime)) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: invalid start_time.`, {},
                    400
                );
            }

            if (!timeRegex.test(sessionData.endTime)) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: invalid end_time.`, {},
                    400
                );
            }

            if (
                sessionData.startTime >=
                sessionData.endTime
            ) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: end_time must be after start_time.`, {},
                    400
                );
            }

            if (!Array.isArray(sessionData.trainers)) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: trainers must be an array.`, {},
                    400
                );
            }

            if (sessionData.trainers.length === 0) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: at least one trainer is required.`, {},
                    400
                );
            }

            for (
                let trainerIndex = 0; trainerIndex < sessionData.trainers.length; trainerIndex++
            ) {
                const trainerId = sessionData.trainers[trainerIndex];

                if (!mongoose.Types.ObjectId.isValid(trainerId)) {
                    return errorResponse(res, `Session ${index + 1}: invalid trainer ID at position ${trainerIndex + 1}.`, {}, 400);
                }
            }

            const trainerIds =
                sessionData.trainers.map((id) =>
                    id.toString()
                );

            const uniqueTrainerIds =
                new Set(trainerIds);

            if (
                uniqueTrainerIds.size !==
                trainerIds.length
            ) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: duplicate trainers are not allowed.`, {},
                    400
                );
            }
        }

        let attachment = {
            file_name: "",
            file_url: "",
            file_type: "",
        };

        if (req.file) {
            attachment = {
                file_name: req.file.originalname ||
                    req.file.filename ||
                    "",

                file_url: req.file.path ||
                    req.file.location ||
                    req.file.url ||
                    "",

                file_type: req.file.mimetype ||
                    "",
            };
        }

        mongoSession.startTransaction();

        const batchResult = await Batch.create(
            [{
                module_id: moduleId,
                company_id: userId,
                name: name.trim(),
                type,
                capacity,
                status: "draft",
                start_date: parsedStartDate,
                end_date: parsedEndDate,
                venue: venue?.trim() || "",
                cost_per_learner: costPerLearner,
                attachment,
                created_by: userId,
                updated_by: userId,
            },], {
            session: mongoSession,
        }
        );

        const batch = batchResult[0];

        if (learners.length > 0) {
            const learnerDocuments =
                learners.map((learner) => ({
                    batch_id: batch._id,

                    learner_id: learner.learner_id,

                    status: learner.status ||
                        "nominated",

                    nominated_at: new Date(),

                    responded_at: null,

                    confirmed_at: null,

                    declined_at: null,

                    status_changed_by: null,
                }));

            await BatchLearner.insertMany(
                learnerDocuments, {
                session: mongoSession,
            }
            );
        }

        for (
            let index = 0; index < sessions.length; index++
        ) {
            const sessionData = sessions[index];

            const sessionResult = await BatchSession.create(
                [{
                    batch_id: batch._id,
                    session_date: new Date(sessionData.date),
                    start_time: sessionData.startTime,
                    end_time: sessionData.endTime,
                    venue: sessionData.venue?.trim() ||
                        venue?.trim() ||
                        "",
                    session_number: index + 1,
                    status: "scheduled",
                },], {
                session: mongoSession,
            }
            );

            const createdSession = sessionResult[0];

            const trainerDocuments =
                sessionData.trainers.map(
                    (trainerId) => ({
                        session_id: createdSession._id,
                        trainer_id: trainerId,
                        assigned_by: userId,
                    })
                );

            await BatchSessionTrainer.insertMany(
                trainerDocuments, {
                session: mongoSession,
            }
            );
        }

        await mongoSession.commitTransaction();

        return successResponse(
            res,
            "ILT batch created successfully.", {
            batch_id: batch._id,
            module_id: batch.module_id,
            company_id: batch.company_id,
            type: batch.type,
            name: batch.name,
            start_date: batch.start_date,
            end_date: batch.end_date,
            venue: batch.venue,
            cost_per_learner: batch.cost_per_learner,
            attachment: batch.attachment,
            learners_count: learners.length,
            sessions_count: sessions.length,
        },
            201
        );

    } catch (error) {

        if (mongoSession.inTransaction()) {
            await mongoSession.abortTransaction();
        }

        next(error);

    } finally {

        await mongoSession.endSession();
    }
};

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};


const parseJSONField = (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        throw new Error(`${fieldName} must be valid JSON.`);
    }
};


const normalizeTime = (time) => {
    if (!time) return "";

    return String(time).trim();
};


const timeToMinutes = (time) => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return null;
    }

    const [hours, minutes] = time.split(":").map(Number);

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    return hours * 60 + minutes;
};


const normalizeDate = (date) => {
    if (!date) return null;

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

exports.putILTBatchAPIController = async (req, res, next) => {

    const session = await mongoose.startSession();

    try {

        const userId = req?.userId;

        if (!userId) {
            return errorResponse(
                res,
                "Unauthorized.", {},
                401
            );
        }

        const {
            batchId
        } = req?.params;


        if (!batchId) {
            return errorResponse(
                res,
                "Batch ID is required.", {},
                400
            );
        }


        if (!isValidObjectId(batchId)) {
            return errorResponse(
                res,
                "Invalid batch ID.", {},
                400
            );
        }

        const {
            type,
            name,
            startDate = null,
            endDate = null,
            venue,
            cost,
            capacity = null,
            closeBy,
            sessions: sessionsRaw,
            learners: learnersRaw,
        } = req?.body || {};

        let sessions = [];
        let learners = [];

        try {

            sessions = parseJSONField(
                sessionsRaw,
                "sessions"
            );

            learners = parseJSONField(
                learnersRaw,
                "learners"
            );

        } catch (error) {

            return errorResponse(
                res,
                error.message, {},
                400
            );
        }

        if (
            type !== undefined &&
            !["defined", "nominated"].includes(type)
        ) {
            return errorResponse(
                res,
                "Invalid batch type.", {},
                400
            );
        }

        if (!name || !String(name).trim()) {
            return errorResponse(
                res,
                "Batch name is required.", {},
                400
            );
        }


        if (String(name).trim().length < 3) {
            return errorResponse(
                res,
                "Batch name must be at least 3 characters.", {},
                400
            );
        }

        const parsedStartDate = normalizeDate(startDate);
        const parsedEndDate = normalizeDate(endDate);

        const parsedCost =
            cost === undefined ||
                cost === null ||
                cost === "" ?
                0 :
                Number(cost);


        if (
            Number.isNaN(parsedCost) ||
            parsedCost < 0
        ) {
            return errorResponse(
                res,
                "Cost must be a valid number greater than or equal to 0.", {},
                400
            );
        }

        let parsedCapacity = null;

        if (
            capacity !== undefined &&
            capacity !== null &&
            capacity !== ""
        ) {

            parsedCapacity = Number(capacity);

            if (
                Number.isNaN(parsedCapacity) ||
                parsedCapacity < 1
            ) {
                return errorResponse(
                    res,
                    "Capacity must be at least 1.", {},
                    400
                );
            }
        }

        let parsedCloseBy = null;

        if (closeBy) {

            parsedCloseBy = normalizeDate(closeBy);

            if (!parsedCloseBy) {
                return errorResponse(
                    res,
                    "Invalid close by date.", {},
                    400
                );
            }
        }

        if (!Array.isArray(learners)) {
            return errorResponse(
                res,
                "Learners must be an array.", {},
                400
            );
        }

        if (!Array.isArray(sessions)) {
            return errorResponse(
                res,
                "Sessions must be an array.", {},
                400
            );
        }

        const learnerIds = [];

        for (let index = 0; index < learners.length; index++) {

            const learner = learners[index];

            const learnerId =
                learner?.learner_id ||
                learner?.id;


            if (!learnerId) {
                return errorResponse(
                    res,
                    `Learner ${index + 1}: learner_id is required.`, {},
                    400
                );
            }


            if (!isValidObjectId(learnerId)) {
                return errorResponse(
                    res,
                    `Learner ${index + 1}: invalid learner_id.`, {},
                    400
                );
            }


            if (learnerIds.includes(String(learnerId))) {
                return errorResponse(
                    res,
                    `Learner ${index + 1}: duplicate learner selected.`, {},
                    400
                );
            }


            learnerIds.push(String(learnerId));
        }

        for (let index = 0; index < sessions.length; index++) {

            const currentSession = sessions[index];

            const sessionDate =
                currentSession?.session_date ||
                currentSession?.date;

            const startTime =
                currentSession?.start_time ||
                currentSession?.startTime;

            const endTime =
                currentSession?.end_time ||
                currentSession?.endTime;

            if (!sessionDate) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: session_date is required.`, {},
                    400
                );
            }


            const parsedSessionDate =
                normalizeDate(sessionDate);


            if (!parsedSessionDate) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: invalid session_date.`, {},
                    400
                );
            }

            if (!startTime) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: start_time is required.`, {},
                    400
                );
            }

            if (!endTime) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: end_time is required.`, {},
                    400
                );
            }


            const startMinutes =
                timeToMinutes(
                    normalizeTime(startTime)
                );

            const endMinutes =
                timeToMinutes(
                    normalizeTime(endTime)
                );


            if (startMinutes === null) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: invalid start_time.`, {},
                    400
                );
            }


            if (endMinutes === null) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: invalid end_time.`, {},
                    400
                );
            }


            if (endMinutes <= startMinutes) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: end_time must be after start_time.`, {},
                    400
                );
            }

            const trainers =
                currentSession?.trainers || [];


            if (!Array.isArray(trainers)) {
                return errorResponse(
                    res,
                    `Session ${index + 1}: trainers must be an array.`, {},
                    400
                );
            }


            const uniqueTrainers = [...new Set(
                trainers.map(String)
            )];


            for (
                let trainerIndex = 0; trainerIndex < uniqueTrainers.length; trainerIndex++
            ) {

                if (
                    !isValidObjectId(
                        uniqueTrainers[trainerIndex]
                    )
                ) {
                    return errorResponse(
                        res,
                        `Session ${index + 1}: invalid trainer ID.`, {},
                        400
                    );
                }
            }
        }

        session.startTransaction();

        const batch = await Batch.findOne({
            _id: batchId,
            created_by: userId,
        }).session(session);


        if (!batch) {

            await session.abortTransaction();

            return errorResponse(
                res,
                "Batch not found.", {},
                404
            );
        }

        batch.name = String(name).trim();

        if (type !== undefined) {
            batch.type = type;
        }

        batch.start_date = parsedStartDate;
        batch.end_date = parsedEndDate;

        batch.venue =
            venue !== undefined ?
                String(venue).trim() :
                batch.venue;

        batch.cost_per_learner =
            parsedCost;

        batch.capacity =
            parsedCapacity;

        batch.close_by =
            parsedCloseBy;

        batch.updated_by = userId;

        if (req?.file) {

            batch.attachment = {
                file_name: req.file.originalname || "",

                file_url: req.file.path ||
                    req.file.location ||
                    "",

                file_type: req.file.mimetype || "",
            };
        }

        await batch.save({
            session,
        });

        const existingSessions =
            await BatchSession.find({
                batch_id: batch._id,
            }).session(session);


        const existingSessionMap =
            new Map(
                existingSessions.map(
                    (item) => [
                        String(item._id),
                        item,
                    ]
                )
            );

        const incomingSessionIds = new Set();

        for (
            let index = 0; index < sessions.length; index++
        ) {

            const currentSession =
                sessions[index];


            const frontendSessionId =
                currentSession?._id &&
                    isValidObjectId(
                        currentSession._id
                    ) ?
                    String(currentSession._id) :
                    null;

            const sessionDate =
                currentSession?.session_date ||
                currentSession?.date;

            const startTime =
                currentSession?.start_time ||
                currentSession?.startTime;

            const endTime =
                currentSession?.end_time ||
                currentSession?.endTime;

            const sessionVenue =
                currentSession?.venue || "";

            let batchSession = null;

            if (
                frontendSessionId &&
                existingSessionMap.has(
                    frontendSessionId
                )
            ) {

                batchSession =
                    existingSessionMap.get(
                        frontendSessionId
                    );

                incomingSessionIds.add(
                    frontendSessionId
                );

            }

            if (!batchSession) {

                batchSession =
                    new BatchSession({
                        batch_id: batch._id,
                    });
            }

            batchSession.batch_id =
                batch._id;

            batchSession.session_date =
                normalizeDate(sessionDate);

            batchSession.start_time =
                normalizeTime(startTime);

            batchSession.end_time =
                normalizeTime(endTime);

            batchSession.venue =
                String(sessionVenue).trim();

            batchSession.session_number =
                index + 1;

            if (!batchSession.status) {
                batchSession.status =
                    "scheduled";
            }

            await batchSession.save({
                session,
            });

            const trainers =
                Array.isArray(
                    currentSession?.trainers
                ) ?
                    [
                        ...new Set(
                            currentSession.trainers
                                .map(String)
                        ),
                    ] :
                    [];

            await BatchSessionTrainer.deleteMany({
                session_id: batchSession._id,
            }).session(session);

            if (trainers.length > 0) {

                const trainerDocuments =
                    trainers.map(
                        (trainerId) => ({
                            session_id: batchSession._id,

                            trainer_id: trainerId,

                            assigned_by: userId,
                        })
                    );


                await BatchSessionTrainer.insertMany(
                    trainerDocuments, {
                    session,
                    ordered: true,
                }
                );
            }
        }

        for (
            const existingSession of existingSessions
        ) {

            const existingId =
                String(existingSession._id);


            if (
                incomingSessionIds.has(
                    existingId
                )
            ) {
                continue;
            }


            if (batch.status === "draft") {

                await BatchSessionTrainer.deleteMany({
                    session_id: existingSession._id,
                }).session(session);


                await BatchSession.deleteOne({
                    _id: existingSession._id,
                }).session(session);

            } else {

                existingSession.status =
                    "cancelled";

                await existingSession.save({
                    session,
                });


                await BatchSessionTrainer.deleteMany({
                    session_id: existingSession._id,
                }).session(session);
            }
        }

        const existingLearners =
            await BatchLearner.find({
                batch_id: batch._id,
            }).session(session);


        const existingLearnerMap =
            new Map(
                existingLearners.map(
                    (item) => [
                        String(item.learner_id),
                        item,
                    ]
                )
            );

        for (
            const learner of learners
        ) {

            const learnerId =
                String(
                    learner?.learner_id ||
                    learner?.id
                );


            let batchLearner =
                existingLearnerMap.get(
                    learnerId
                );

            if (!batchLearner) {

                batchLearner =
                    new BatchLearner({
                        batch_id: batch._id,

                        learner_id: learnerId,

                        status: learner?.status ||
                            "nominated",
                    });


                await batchLearner.save({
                    session,
                });

                continue;
            }

            const incomingStatus =
                learner?.status;


            if (
                incomingStatus && [
                    "nominated",
                    "not_responded",
                    "confirmed",
                    "declined",
                ].includes(
                    incomingStatus
                )
            ) {

                if (
                    batchLearner.status !==
                    incomingStatus
                ) {

                    batchLearner.status =
                        incomingStatus;

                    batchLearner.status_changed_by =
                        userId;


                    if (
                        incomingStatus ===
                        "confirmed"
                    ) {

                        batchLearner.confirmed_at =
                            new Date();

                        batchLearner.responded_at =
                            new Date();

                    } else if (
                        incomingStatus ===
                        "declined"
                    ) {

                        batchLearner.declined_at =
                            new Date();

                        batchLearner.responded_at =
                            new Date();

                    } else {

                        batchLearner.responded_at =
                            null;

                        batchLearner.confirmed_at =
                            null;

                        batchLearner.declined_at =
                            null;
                    }
                }
            }


            await batchLearner.save({
                session,
            });
        }

        const incomingLearnerIds =
            new Set(learnerIds);


        for (
            const existingLearner of existingLearners
        ) {

            const existingLearnerId =
                String(
                    existingLearner.learner_id
                );


            if (
                incomingLearnerIds.has(
                    existingLearnerId
                )
            ) {
                continue;
            }


            if (
                existingLearner.status ===
                "nominated"
            ) {

                await BatchLearner.deleteOne({
                    _id: existingLearner._id,
                }).session(session);
            }
        }

        await session.commitTransaction();

        const updatedBatch =
            await Batch.findOne({
                _id: batch._id,
                created_by: userId,
            })
                .populate({
                    path: "sessions",
                    populate: {
                        path: "trainers",
                        populate: {
                            path: "trainer_id",
                            model: user.modelName,
                            select: "_id first_name last_name email emp_id",
                        },
                    },
                })
                .populate({
                    path: "learners",
                    populate: {
                        path: "learner_id",
                        model: user.modelName,
                        select: "_id first_name last_name email emp_id",
                    },
                })
                .lean({
                    virtuals: true,
                });

        return successResponse(
            res,
            "Batch updated successfully",
            updatedBatch
        );

    } catch (error) {

        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        next(error);

    } finally {

        await session.endSession();
    }
};

exports.postILTBatchUploadAPIController = async (req, res, next) => {
    try {
        const userId = req?.userId;
        const { moduleId } = req?.params;

        const filter = { created_by: userId };

        const LEARNER_ROLE_ID = '683ecef236ffdce90d2e1270';
        const TRAINER_ROLE_ID = '682462e9d71f301af3fc4d57';

        const userSelect = '_id first_name last_name email phone address pincode codes company_name';
        const userPopulate = {
            path: 'roles',
            populate: { path: 'role_id', select: '_id name' }
        };

        const allUsers = await user.find(filter)
            .select(userSelect)
            .populate(userPopulate)
            .sort({ first_name: 1, last_name: 1 })
            .lean({ virtuals: true });

        const learnerUsers = allUsers.filter((item) =>
            item.roles?.some((role) => role.role_id?._id?.toString() === LEARNER_ROLE_ID)
        );

        const trainerUsers = allUsers.filter((item) =>
            item.roles?.some((role) => role.role_id?._id?.toString() === TRAINER_ROLE_ID)
        );

        const finalLearnerList = learnerUsers.map(u => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null
        }))

        const finalTrainerList = trainerUsers.map(u => ({
            ...u,
            email: u.email ? decrypt(u.email) : null,
            phone: u.phone ? decrypt(u.phone) : null
        }))

        // email -> user maps (case-insensitive)
        const learnerEmailMap = new Map(
            finalLearnerList.map((u) => [u.email?.toLowerCase(), u])
        );
        const trainerEmailMap = new Map(
            finalTrainerList.map((u) => [u.email?.toLowerCase(), u])
        );

        const mongoSession = await mongoose.startSession();

        try {
            const {
                type,
                name,
                capacity = null,
                startDate = null,
                endDate = null,
                venue,
                cost,
            } = req.body;

            if (!type) {
                return errorResponse(res, "Batch type is required.", {}, 400);
            }

            if (!["nominated", "defined"].includes(type)) {
                return errorResponse(res, "Batch type must be either nominated or defined.", {}, 400);
            }

            if (!name?.trim()) {
                return errorResponse(res, "Batch name is required.", {}, 400);
            }

            const parsedStartDate = new Date(startDate);
            const parsedEndDate = new Date(endDate);

            let costPerLearner = 0;
            if (cost !== undefined && cost !== null && cost !== "") {
                costPerLearner = Number(cost);
                if (Number.isNaN(costPerLearner) || costPerLearner < 0) {
                    return errorResponse(res, "cost must be a valid number greater than or equal to 0.", {}, 400);
                }
            }

            // ---- learnerEmails / trainerEmails come from the Excel import ----
            let learnerEmails = [];
            let trainerEmails = [];

            try {
                if (req.body.learnerEmails) {
                    learnerEmails =
                        typeof req.body.learnerEmails === "string"
                            ? JSON.parse(req.body.learnerEmails)
                            : req.body.learnerEmails;
                }
            } catch (error) {
                return errorResponse(res, "Invalid learnerEmails JSON.", {}, 400);
            }

            try {
                if (req.body.trainerEmails) {
                    trainerEmails =
                        typeof req.body.trainerEmails === "string"
                            ? JSON.parse(req.body.trainerEmails)
                            : req.body.trainerEmails;
                }
            } catch (error) {
                return errorResponse(res, "Invalid trainerEmails JSON.", {}, 400);
            }

            if (!Array.isArray(learnerEmails)) {
                return errorResponse(res, "learnerEmails must be an array.", {}, 400);
            }
            if (!Array.isArray(trainerEmails)) {
                return errorResponse(res, "trainerEmails must be an array.", {}, 400);
            }

            // ---- validate every learner email exists in the learners list ----
            const unknownLearnerEmails = [];
            const resolvedLearners = [];

            for (const rawEmail of learnerEmails) {
                const email = String(rawEmail || "").trim().toLowerCase();
                const matchedUser = learnerEmailMap.get(email);

                if (!matchedUser) {
                    unknownLearnerEmails.push(rawEmail);
                } else {
                    resolvedLearners.push(matchedUser);
                }
            }

            if (unknownLearnerEmails.length > 0) {
                return errorResponse(
                    res,
                    `The following learner email(s) do not exist: ${unknownLearnerEmails.join(", ")}`,
                    {},
                    400
                );
            }

            // ---- validate every trainer email exists in the trainers list ----
            const unknownTrainerEmails = [];
            const resolvedTrainers = [];

            for (const rawEmail of trainerEmails) {
                const email = String(rawEmail || "").trim().toLowerCase();
                const matchedUser = trainerEmailMap.get(email);

                if (!matchedUser) {
                    unknownTrainerEmails.push(rawEmail);
                } else {
                    resolvedTrainers.push(matchedUser);
                }
            }

            if (unknownTrainerEmails.length > 0) {
                return errorResponse(
                    res,
                    `The following trainer email(s) do not exist: ${unknownTrainerEmails.join(", ")}`,
                    {},
                    400
                );
            }

            // build learners array with resolved ids (dedupe)
            const learnerIdSet = new Set(resolvedLearners.map((u) => u._id.toString()));
            const learners = Array.from(learnerIdSet).map((id) => ({
                learner_id: id,
                status: "nominated",
            }));

            // ---- sessions ----
            let sessions = [];
            try {
                if (req.body.sessions) {
                    sessions =
                        typeof req.body.sessions === "string"
                            ? JSON.parse(req.body.sessions)
                            : req.body.sessions;
                }
            } catch (error) {
                return errorResponse(res, "Invalid sessions JSON.", {}, 400);
            }

            if (!Array.isArray(sessions)) {
                return errorResponse(res, "sessions must be an array.", {}, 400);
            }

            const trainerEmailToId = new Map(
                resolvedTrainers.map((u) => [u.email.toLowerCase(), u._id.toString()])
            );

            for (let index = 0; index < sessions.length; index++) {
                const sessionData = sessions[index];

                if (!sessionData?.date) {
                    return errorResponse(res, `Session ${index + 1}: session_date is required.`, {}, 400);
                }

                const sessionDate = new Date(sessionData.date);
                if (Number.isNaN(sessionDate.getTime())) {
                    return errorResponse(res, `Session ${index + 1}: invalid session_date.`, {}, 400);
                }

                if (sessionDate < parsedStartDate || sessionDate > parsedEndDate) {
                    return errorResponse(
                        res,
                        `Session ${index + 1}: session_date must be between startDate and endDate.`,
                        {},
                        400
                    );
                }

                if (!sessionData?.startTime) {
                    return errorResponse(res, `Session ${index + 1}: start_time is required.`, {}, 400);
                }
                if (!sessionData?.endTime) {
                    return errorResponse(res, `Session ${index + 1}: end_time is required.`, {}, 400);
                }

                const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

                if (!timeRegex.test(sessionData.startTime)) {
                    return errorResponse(res, `Session ${index + 1}: invalid start_time.`, {}, 400);
                }
                if (!timeRegex.test(sessionData.endTime)) {
                    return errorResponse(res, `Session ${index + 1}: invalid end_time.`, {}, 400);
                }
                if (sessionData.startTime >= sessionData.endTime) {
                    return errorResponse(res, `Session ${index + 1}: end_time must be after start_time.`, {}, 400);
                }

                // sessionData.trainers is expected to be an array of emails here
                if (!Array.isArray(sessionData.trainers)) {
                    return errorResponse(res, `Session ${index + 1}: trainers must be an array.`, {}, 400);
                }
                if (sessionData.trainers.length === 0) {
                    return errorResponse(res, `Session ${index + 1}: at least one trainer is required.`, {}, 400);
                }

                const sessionTrainerIds = [];
                const sessionUnknownTrainers = [];

                for (const trainerEmail of sessionData.trainers) {
                    const key = String(trainerEmail || "").trim().toLowerCase();
                    const resolvedId = trainerEmailToId.get(key);

                    if (!resolvedId) {
                        sessionUnknownTrainers.push(trainerEmail);
                    } else {
                        sessionTrainerIds.push(resolvedId);
                    }
                }

                if (sessionUnknownTrainers.length > 0) {

                    return errorResponse(res, `Session ${index + 1}: unknown trainer email(s): ${sessionUnknownTrainers.join(", ")}`, {}, 400);
                }

                const uniqueTrainerIds = new Set(sessionTrainerIds);
                if (uniqueTrainerIds.size !== sessionTrainerIds.length) {
                    return errorResponse(res, `Session ${index + 1}: duplicate trainers are not allowed.`, {}, 400);
                }

                sessionData.trainers = sessionTrainerIds; // overwrite with resolved ids
            }

            let attachment = { file_name: "", file_url: "", file_type: "" };
            if (req.file) {
                attachment = {
                    file_name: req.file.originalname || req.file.filename || "",
                    file_url: req.file.path || req.file.location || req.file.url || "",
                    file_type: req.file.mimetype || "",
                };
            }

            mongoSession.startTransaction();

            const batchResult = await Batch.create(
                [{
                    module_id: moduleId,
                    company_id: userId,
                    name: name.trim(),
                    type,
                    capacity,
                    status: "draft",
                    start_date: parsedStartDate,
                    end_date: parsedEndDate,
                    venue: venue?.trim() || "",
                    cost_per_learner: costPerLearner,
                    attachment,
                    created_by: userId,
                    updated_by: userId,
                }],
                { session: mongoSession }
            );

            const batch = batchResult[0];

            if (learners.length > 0) {
                const learnerDocuments = learners.map((learner) => ({
                    batch_id: batch._id,
                    learner_id: learner.learner_id,
                    status: learner.status || "nominated",
                    nominated_at: new Date(),
                    responded_at: null,
                    confirmed_at: null,
                    declined_at: null,
                    status_changed_by: null,
                }));

                await BatchLearner.insertMany(learnerDocuments, { session: mongoSession });
            }

            for (let index = 0; index < sessions.length; index++) {
                const sessionData = sessions[index];

                const sessionResult = await BatchSession.create(
                    [{
                        batch_id: batch._id,
                        session_date: new Date(sessionData.date),
                        start_time: sessionData.startTime,
                        end_time: sessionData.endTime,
                        venue: sessionData.venue?.trim() || venue?.trim() || "",
                        session_number: index + 1,
                        status: "scheduled",
                    }],
                    { session: mongoSession }
                );

                const createdSession = sessionResult[0];

                const trainerDocuments = sessionData.trainers.map((trainerId) => ({
                    session_id: createdSession._id,
                    trainer_id: trainerId,
                    assigned_by: userId,
                }));

                await BatchSessionTrainer.insertMany(trainerDocuments, { session: mongoSession });
            }

            await mongoSession.commitTransaction();

            return successResponse(
                res,
                "ILT batch created successfully.",
                {
                    batch_id: batch._id,
                    module_id: batch.module_id,
                    company_id: batch.company_id,
                    type: batch.type,
                    name: batch.name,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    venue: batch.venue,
                    cost_per_learner: batch.cost_per_learner,
                    attachment: batch.attachment,
                    learners_count: learners.length,
                    sessions_count: sessions.length,
                },
                201
            );
        } catch (error) {
            if (mongoSession.inTransaction()) {
                await mongoSession.abortTransaction();
            }
            next(error);
        } finally {
            await mongoSession.endSession();
        }
    } catch (error) {
        next(error);
    }
};
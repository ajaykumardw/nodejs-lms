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
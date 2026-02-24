const mongoose = require('mongoose')

const programSchedule = require('../../model/ProgramSchedule')
const department = require('../../model/Department')
const designation = require('../../model/Designation')
const group = require('../../model/Group')
const user = require('../../model/User')
const activity = require('../../model/Activity')
const contentFolder = require('../../model/ContentFolder')
const modules = require('../../model/Module')
const UserModuleEnroll = require("../../model/UserModuleEnroll")
const UserSelfEnroll = require("../../model/UserSelfEnroll")
const Zone = require('../../model/Zone')
const ReplaceTemplateField = require("../../util/ReplaceTemplateField")
const scheduleType = require('../../model/ScheduleType')
const scheduleUser = require('../../model/ScheduleUser')

const {
    successResponse,
    errorResponse
} = require('../../util/response')

const { decrypt } = require('../../util/encryption')

exports.getProgramScheduleAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { moduleId } = req.params;

        const Module = await modules.findById(moduleId);

        if (!Module) {
            return errorResponse(res, "Module not found", {}, 404);
        }

        const ContentFolderId = Module.content_folder_id;

        let ProgramSchedule = await programSchedule.findOne({
            company_id: userId,
            module_id: moduleId,
            content_folder_id: ContentFolderId
        }).lean();

        if (!ProgramSchedule) {
            ProgramSchedule = {};
        }

        const scheduleTypes = await scheduleType.find({
            schedule_id: ProgramSchedule._id,
            company_id: userId
        }).lean();

        // Normalize into frontend format
        const grouped = {};

        scheduleTypes.forEach(su => {
            if (!grouped[su.type]) grouped[su.type] = [];
            grouped[su.type].push(String(su.type_id));
        });

        const targetPairs = Object.entries(grouped).map(([target, options]) => ({
            target,
            options
        }));

        const finalSchedule = {
            ...ProgramSchedule,
            targetPairs
        };

        return successResponse(res, "Setting fetched successfully", finalSchedule);
    } catch (error) {
        next(error);
    }
};

exports.getCreateDataAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const finalData = {};

        const objectId = mongoose.Types.ObjectId.createFromHexString(userId);

        const regions = await Zone.aggregate([
            {
                $match: { created_by: objectId } // filter zones created by this user
            },
            {
                $unwind: "$region" // split region array into individual docs
            },
            {
                $replaceRoot: { newRoot: "$region" } // keep only region data
            }
        ]);

        finalData['department'] = await department.find({ created_by: userId, status: true })
        finalData['designation'] = await designation.find({ company_id: userId, status: true })
        finalData['group'] = await group.find({ company_id: userId, status: true })
        finalData['user'] = await user.find({ created_by: userId, status: true }).populate('company_id')
        finalData['region'] = regions

        return successResponse(res, "Create data fetched successfully", finalData)

    } catch (error) {
        next(error)
    }
}

exports.postProgramScheduleAPI = async (req, res, next) => {
    try {

        const {
            dueDate,
            dueDays,
            lockModule,
            pushEnrollmentSetting,
            start_date,
            end_date,
            selfEnrollmentSetting,
            targetPairs,
            dueType
        } = req.body;

        const { moduleId } = req.params;
        const userId = req.userId;

        const finalUserSet = new Set();

        const Module = await modules.findById(moduleId);

        const users = await user.find({ created_by: userId }).select("_id");

        if (!Module) {

            return errorResponse(res, "Module not found", {}, 404);
        }

        const content_folder = await contentFolder.findById(Module.content_folder_id);

        if (!content_folder) {

            return errorResponse(res, "Content folder not found", {}, 404);
        }

        const moduleTypeId = Module.module_type_id;
        const programId = content_folder.program_id;

        const activities = await activity
            .find({ module_id: moduleId })
            .select("_id")
            .lean();

        const activityIds = activities.map(a => a._id);

        let program = await programSchedule.findOne({
            module_id: moduleId,
            content_folder_id: Module.content_folder_id,
            program_id: programId,
            company_id: userId
        });

        const schedulePayload = {
            lockModule,
            dueType,
            dueDate: dueType === "fixed"
                ? {
                    start_date: new Date(start_date),
                    end_date: new Date(end_date)
                }
                : {
                    start_date: null,
                    end_date: null
                },
            dueDays: dueType === "relative" ? dueDays : null,
            pushEnrollmentSetting,
            published_date: Date.now(),
            selfEnrollmentSetting,
            module_id: moduleId,
            content_folder_id: Module.content_folder_id,
            program_id: programId,
            activity_id: activityIds,
            company_id: userId,
            updated_at: new Date()
        };

        if (!program) {
            program = new programSchedule({
                ...schedulePayload,
                created_by: userId,
                created_at: new Date()
            });
        } else {
            Object.assign(program, schedulePayload);
        }

        await program.save();

        await scheduleType.deleteMany({
            schedule_id: program._id,
            company_id: userId
        });

        await scheduleUser.deleteMany({
            schedule_id: program._id,
            company_id: userId
        });

        if (!Array.isArray(targetPairs) || targetPairs.length === 0) {
            return successResponse(res, "Settings saved successfully");
        }

        const scheduleTypes = [];

        for (const pair of targetPairs) {
            if (!pair.target || !Array.isArray(pair.options)) continue;

            for (const optionId of pair.options) {
                scheduleTypes.push({
                    company_id: userId,
                    schedule_id: program._id,
                    module_id: moduleId,
                    type: Number(pair.target),
                    type_id: mongoose.Types.ObjectId.isValid(optionId)
                        ? mongoose.Types.ObjectId.createFromHexString(optionId)
                        : optionId
                });
            }
        }

        if (scheduleTypes.length === 0) {

            return successResponse(res, "Settings saved successfully");
        }

        await scheduleType.insertMany(scheduleTypes);

        const bulkUsers = [];

        for (const item of scheduleTypes) {

            const { type, type_id } = item;
            let targetUsers = [];

            switch (type) {
                case 1:
                    targetUsers = await user.find({ designation_id: type_id }).select("_id");
                    break;
                case 2:
                    targetUsers = await user.find({ department_id: type_id }).select("_id");
                    break;
                case 3:
                    targetUsers = await user.find({ group_id: type_id }).select("_id");
                    break;
                case 4:
                    targetUsers = await user.find({ region_id: type_id }).select("_id");
                    break;
                case 5:
                    finalUserSet.add(type_id.toString());
                    continue;
            }

            for (const u of targetUsers) {
                finalUserSet.add(u._id.toString());
                bulkUsers.push({
                    schedule_id: program._id,
                    module_id: moduleId,
                    company_id: userId,
                    type,
                    type_id,
                    user_id: u._id
                });
            }
        }

        if (bulkUsers.length) {
            await scheduleUser.insertMany(bulkUsers);
        }

        const finalUsers = [...finalUserSet].map(id => ({
            user_id: mongoose.Types.ObjectId.createFromHexString(id),
            schedule_id: program._id,
            module_id: moduleId,
            created_by: userId,
            created_at: new Date()
        }));

        await UserModuleEnroll.deleteMany({
            module_id: moduleId,
            schedule_id: program._id
        });

        await UserSelfEnroll.deleteMany({
            module_id: moduleId,
            schedule_id: program._id
        });

        if (
            (pushEnrollmentSetting === "2" ||
                moduleTypeId == "688219557b6953e899cb57d3") &&
            finalUsers.length
        ) {
            await UserModuleEnroll.insertMany(finalUsers);
        }

        else if (pushEnrollmentSetting === "1") {
            const uniqueUserIds = [
                ...new Set(users.map(u => u._id.toString()))
            ];

            const allUsersEnroll = uniqueUserIds.map(id => ({
                user_id: mongoose.Types.ObjectId.createFromHexString(id),
                schedule_id: program._id,
                module_id: moduleId,
                created_by: userId,
                created_at: new Date()
            }));

            if (allUsersEnroll.length) {
                await UserModuleEnroll.insertMany(allUsersEnroll);
            }
        }

        if (selfEnrollmentSetting === "3" && finalUsers.length) {
            await UserSelfEnroll.insertMany(finalUsers);
        }

        for (const id of finalUserSet) {

            const userDoc = await user.findById(id).lean();

            if (!userDoc) continue;

            const email = userDoc.email;

            await ReplaceTemplateField({
                userId: id.toString(),
                notificationId: "699415f604d510db61a1c128",
                to: decrypt(email),
                event: "Training Schedule Update",
                means: "Training Schedule Update",
                explanation: "Training schedule updated successfully",
                userPassword: ""
            });
        }

        return successResponse(res, "Settings data saved successfully");

    } catch (error) {
        console.error("Error in postProgramScheduleAPI:", error);
        next(error);
    }
};
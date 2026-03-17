const mongoose = require("mongoose")

const Module = require("../../model/Module");
const SelfEnroll = require("../../model/UserSelfEnroll")
const ModuleEnroll = require("../../model/UserModuleEnroll")
const ProgramSchedule = require("../../model/ProgramSchedule");

const { successResponse } = require("../../util/response");

exports.getSelfEnrollData = async (req, res, next) => {
    try {
        const userId = mongoose.Types.ObjectId.createFromHexString(req.userId)

        const page = parseInt(req.query.page, 10) || 1
        const limit = parseInt(req.query.limit, 10) || 8
        const skip = (page - 1) * limit

        //  Get enrolled module IDs
        const userSelfEnroll = await SelfEnroll.find({
            user_id: userId,
        }).select("module_id")

        const moduleIds = userSelfEnroll.map(item => item.module_id)

        //  Total count (for pagination)
        const totalItems = await Module.countDocuments({
            _id: { $in: moduleIds },
        })

        //  Paginated modules
        const modules = await Module.find({
            _id: { $in: moduleIds },
        })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }) // optional but recommended

        return successResponse(res, "Self enroll data fetched successfully", {
            data: modules,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
            },
        })
    } catch (error) {
        next(error)
    }
}

exports.getInsertSelfEnrollData = async (req, res, next) => {
    try {

        const userId = mongoose.Types.ObjectId.createFromHexString(req?.userId);

        const { moduleId } = req?.params;

        const programSchedule = await ProgramSchedule.findOne({ module_id: moduleId })

        await ModuleEnroll.deleteMany({
            module_id: mongoose.Types.ObjectId.createFromHexString(moduleId),
            schedule_id: programSchedule._id,
            user_id: userId
        })

        const module_enroll = new ModuleEnroll({
            module_id: mongoose.Types.ObjectId.createFromHexString(moduleId),
            schedule_id: programSchedule._id,
            user_id: userId,
            created_by: userId,
            created_at: Date.now()
        })

        await module_enroll.save();

        await SelfEnroll.deleteMany({
            module_id: mongoose.Types.ObjectId.createFromHexString(moduleId),
            user_id: userId
        })

        return successResponse(res, "Self enroll data saved successfully")

    } catch (error) {
        next(error)
    }
}
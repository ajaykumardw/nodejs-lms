const mongoose = require('mongoose')
const ProgramSchedule = require('../../model/ProgramSchedule')
const ScheduleType = require('../../model/ScheduleType')
const ScheduleUser = require('../../model/ScheduleUser')
const Program = require('../../model/Program')

const { successResponse } = require('../../util/response')

exports.getCourseAPIController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        // Find schedules linked by type_id and user_id
        const scheduleType = await ScheduleType.find({ type_id: userId });
        const scheduleUser = await ScheduleUser.find({ user_id: userId });

        const typeScheduleIds = scheduleType.map(item => item.schedule_id.toString());
        const userScheduleIds = scheduleUser.map(item => item.schedule_id.toString());

        // Merge & remove duplicates
        const mergedScheduleIds = [...new Set([...typeScheduleIds, ...userScheduleIds])];

        // Find program schedules
        const programSchedule = await ProgramSchedule.find({
            _id: { $in: mergedScheduleIds.map(id => new mongoose.Types.ObjectId(id)) }
        });

        const typeProgramIds = programSchedule.map(item => item.program_id.toString());

        // Fetch program with related content_folders
        const programs = await Program.find({
            _id: { $in: typeProgramIds.map(id => new mongoose.Types.ObjectId(id)) }
        })
            .populate('content_folders');

        return successResponse(res, "Program fetched successfully", programs);

    } catch (error) {
        next(error);
    }
}

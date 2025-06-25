const mongoose = require('mongoose');
const Department = require('../../model/Department');
const { successResponse, errorResponse } = require('../../util/response')

exports.getDepartmentAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const department = await Department.find({ created_by: (userId) });

        if (!department) {
            return errorResponse(res, "Department does not exist", {}, 404)
        }

        return successResponse(res, "Department fetched successfully", department)

    } catch (error) {
        next(error)
    }
}

exports.postDepartmentAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { name, status } = req.body;

        const department = await Department.create({
            name,
            status,
            created_by: userId,
            company_id: userId
        })

        await department.save();

        return successResponse(res, "Department saved successfully");

    } catch (error) {
        next(error);
    }
}



exports.putDepartmentAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const departmentId = req.params.departmentId || req.body.departmentId;

        // Optional: Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(departmentId)) {
            return res.status(400).json({ message: "Invalid department ID" });
        }

        const { name, status } = req.body;

        const updatedDepartment = await Department.findOneAndUpdate(
            { _id: departmentId, created_by: userId },
            { name, status },
            { new: true, runValidators: true }
        );

        if (!updatedDepartment) {
            return res.status(404).json({ message: "Department not found or access denied" });
        }

        return successResponse(res, "Department updated successfully", updatedDepartment);

    } catch (error) {
        next(error);
    }
};

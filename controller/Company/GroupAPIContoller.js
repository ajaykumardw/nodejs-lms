const Group = require('../../model/Group')
const user = require('../../model/User');
const { errorResponse, successResponse } = require('../../util/response');

exports.getGroupAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const group = await Group.find({ created_by: userId });

        if (!group) {
            return errorResponse(res, "Group does not exist", {}, 404)
        }

        return successResponse(res, "Group data fetched successfully", group)

    } catch (error) {
        next(error);
    }
}

exports.postGroupAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const { name, autoAssign, description, status, users } = req.body;

        const group = new Group({
            name,
            autoAssign,
            status,
            description,
            userId: users,
            created_by: userId,
            company_id: userId
        })

        await group.save();

        return successResponse(res, "Group saved successfully")

    } catch (error) {
        next(error)
    }
}

exports.getCheckEmpId = async (req, res, next) => {
    try {
        const userId = req.userId;

        const data = JSON.parse(req.params.uploadData); // Array of { SRNO, EmpID }

        const users = await user.find({ created_by: userId });

        const activeCodesMap = new Map(); // Map of code => userId (_id)

        // Step 1: Build map of active codes to user._id
        users.forEach(userItem => {
            (userItem.codes || []).forEach(code => {
                if (code.type === 'active') {
                    activeCodesMap.set(code.code.toString(), userItem._id.toString());
                }
            });
        });

        const unmatchedSRNO = [];
        const matchedUserIds = [];

        // Step 2: Iterate data to check for matches
        data.forEach(item => {
            const empId = item.EmpID.toString();

            if (activeCodesMap.has(empId)) {
                matchedUserIds.push(activeCodesMap.get(empId)); // get corresponding userId
            } else {
                unmatchedSRNO.push(empId); // no match
            }
        });

        const finalResult = {
            unmatch: unmatchedSRNO,
            matchUser: Array.from(matchedUserIds), // list of _id
        };

        return successResponse(res, "Employee Id checked successfully", finalResult);
    } catch (error) {
        next(error);
    }
};

exports.putGroupAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const groupId = req.params.groupId;
        const { name, autoAssign, description, status, users } = req.body;

        // Check if the group exists and belongs to the user
        const group = await Group.findOne({ _id: groupId, created_by: userId });
        if (!group) {
            return errorResponse(res, "Group does not exist", {}, 404);
        }

        // Clear userId array and update other fields
        await Group.findByIdAndUpdate(groupId, {
            $set: {
                name,
                autoAssign,
                description,
                status,
                userId: [],
            }
        });

        // Push new users to userId array
        if (Array.isArray(users) && users.length > 0) {
            await Group.findByIdAndUpdate(groupId, {
                $addToSet: { userId: { $each: users } } // Step 2: insert new users
            });
        }

        return res.status(200).json({ message: "Group updated successfully" });

    } catch (error) {
        next(error);
    }
};

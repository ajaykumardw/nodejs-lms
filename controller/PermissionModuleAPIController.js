const User = require('../model/User');
const validation = require('../util/validation')
const PermissionModule = require('../model/PermissionModule');

exports.getPermissionModuleAPI = (req, res, next) => {

    const userId = req.userId;

    User.findById(userId).then(user => {
        if (!user) {
            const error = new Error("User does not exist");
            error.statusCode = 404;
            throw error;
        }

        return PermissionModule.find({ created_by: user._id })
    }).then(data => {
        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Data fetched successfully",
            data: data,
        });
    }).catch(err => {
        next(err);
    })

}

exports.postPermissionModuleAPI = (req, res, next) => {

    if (!validation(req, res)) return;

    const { name, status } = req.body;

    const userId = req.userId;

    User.findById(userId).then(user => {
        if (!user) {
            const error = new Error("User does not exist");
            error.statusCode = 404;
            throw error;
        }
        const permissionModule = new PermissionModule({
            name: name,
            status: status,
            created_by: userId,
            company_id: userId
        })

        return permissionModule.save();
    }).then(() => {
        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Data saved successfull"
        });
    }).catch(err => {
        next(err);
    })

}

exports.putPermissionModuleAPI = async (req, res, next) => {
    if (!validation(req, res)) return;

    const { name, status } = req.body;

    const permissionId = req.params.permissionId;

    const permissionModule = await PermissionModule.findOne({ created_by: req.userId, _id: permissionId });

    if (!permissionModule) {
        const error = new Error("Permission module does not exist");
        error.statusCode = 404;
        throw error;
    }

    permissionModule.name = name;
    permissionModule.status = status;

    await permissionModule.save();

    res.status(200).json({
        status: "Success",
        statusCode: 200,
        message: "Data updated successfully!",
    });

}
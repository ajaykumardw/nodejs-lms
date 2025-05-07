const PermissionModule = require('../model/PermissionModule');
const validation = require('../util/validation')

exports.getPermission = async (req, res, next) => {

    const userId = req.userId;

    const permissionModule = await PermissionModule.find({ created_by: userId }, { permission: 1 });

    if (!permissionModule) {
        const error = new Error("Permission module does not exist!");
        error.statusCode = 404;
        throw error;
    }

    let allPermission = [];

    permissionModule.forEach((permModulDoc) => {

        const perModulId = permModulDoc._id;

        if ((permModulDoc.permission) && permModulDoc.permission.length > 0) {
            permModulDoc.permission.forEach((item, index) => {
                allPermission.push({
                    ...item.toObject(),
                    permission_module_id: perModulId,
                    index: index
                })
            })
        }
    })

    res.status(200).json({
        status: "Success",
        statusCode: 200,
        message: "Data fetched successfully",
        data: allPermission,
    })

}

exports.createPermission = async (req, res, next) => {
    const userId = req.userId;

    const formData = await PermissionModule.find({ created_by: userId });

    if (!formData) {
        const error = new Error("Permission module data does not exist")
        error.statusCode = 404;
        throw error;
    }

    res.status(200).json({
        status: "Success",
        statusCode: 200,
        message: "Data fetched successfully!",
        data: formData
    });



};

const slugify = (text) =>
    text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 -]/g, '') // Remove invalid chars
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/-+/g, '-');        // Collapse multiple -


exports.postPermission = async (req, res, next) => {
    // Assuming validation is synchronous
    if (!validation(req, res)) return;

    const { name, status, permissionmodule } = req.body;
    const userId = req.userId;

    try {
        const data = await PermissionModule.findOne({
            _id: permissionmodule,
            created_by: userId
        });

        if (!data) {
            const error = new Error("Permission module does not exist");
            error.statusCode = 404;
            throw error;
        }

        const newPermissionItem = {
            name,
            status,
            slug: slugify(name),
            created_by: userId,
            permission_module_id: permissionmodule,
        };

        await data.addPermission(newPermissionItem);

        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Permission added successfully",
            data
        });
    } catch (error) {
        next(error);
    }
};

exports.putPermission = async (req, res, next) => {
    const userId = req.userId;
    const permissionModuleId = req.params.permissionModuleId;
    const permissionId = req.params.permissionId;
    const { name, status, permissionmodule } = req.body;

    const newItem = {
        name,
        status,
        slug: slugify(name),
        permission_module_id: permissionmodule,
        created_by: userId
    }

    const newPermissionModule = await PermissionModule.findOne({ created_by: userId, _id: permissionmodule });

    const oldPermissionModule = await PermissionModule.findOne({ created_by: userId, _id: permissionModuleId });

    if (permissionModuleId.toString() != permissionmodule.toString()) {


        if (!oldPermissionModule || !newPermissionModule) {
            const error = new Error("Permission module does not exist");
            error.statusCode = 404;
            throw error;
        }

        await oldPermissionModule.removePermission(permissionId);

        await newPermissionModule.addPermission(newItem);

        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Data updated successfully"
        });

    }

    if (!newPermissionModule) {
        const error = new Error("Permission module does not exist");
        error.statusCode = 404;
        throw error;
    }

    await oldPermissionModule.updatePermission([permissionId, newItem]);

    res.status(200).json({
        status: "Success",
        statusCode: 200,
        message: "Data updated successfully",
        diffrent: 'Diffrent'
    })

}
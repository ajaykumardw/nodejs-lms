const mongoose = require('mongoose');
const validation = require('../../util/validation')
const PermissionModule = require('../../model/PermissionModule');

exports.getPermission = async (req, res, next) => {
    const userId = req.userId?.toString();

    try {
        // Get all permission modules including permission and name
        const allPermissionModules = await PermissionModule.find(
            {
                $or: [
                    { created_by: userId },
                    { 'permission.0': { $exists: true } }
                ]
            },
            { permission: 1, name: 1, created_by: 1 }
        ).lean();

        if (!allPermissionModules || allPermissionModules.length === 0) {
            const error = new Error("Permission modules do not exist!");
            error.statusCode = 404;
            throw error;
        }

        const permissionMap = new Map();

        allPermissionModules.forEach((module) => {
            const moduleId = module._id.toString();
            const moduleName = module.name || '';
            const createdBy = module.created_by?.toString();

            module.permission?.forEach((perm, index) => {
                const permId = perm._id.toString();

                if (!permissionMap.has(permId)) {
                    permissionMap.set(permId, {
                        ...perm,
                        index,
                        permission_module_ids: [moduleId],
                        permission_module_names: [moduleName],
                        created_by_list: [createdBy],
                    });
                } else {
                    const existing = permissionMap.get(permId);
                    existing.permission_module_ids.push(moduleId);
                    existing.permission_module_names.push(moduleName);
                    existing.created_by_list.push(createdBy);
                }
            });
        });

        const allPermission = [];
        const totalPermission = [];

        for (const [_, value] of permissionMap.entries()) {
            const finalPerm = {
                ...value,
                permission_module_names: value.permission_module_names.join(', '),
            };

            // If any of the modules for this permission were created by the current user
            const isUserCreated = value.created_by_list.some(creatorId => creatorId === userId);

            if (isUserCreated) {
                allPermission.push(finalPerm);
            }

            totalPermission.push(finalPerm);
        }

        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Data fetched successfully",
            data: {
                allPermission,
                totalPermission,
            },
        });

    } catch (error) {
        next(error);
    }
};

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

exports.editPermission = async (req, res, next) => {
    const permissionId = req.params.permissionId;

    try {
        // Find all permission modules where the permission exists
        const matchedModules = await PermissionModule.find({
            'permission._id': permissionId
        });

        if (!matchedModules.length) {
            const error = new Error("Permission not found in any module.");
            error.statusCode = 404;
            throw error;
        }

        // Get the matching permission from the first module
        const firstPermission = matchedModules[0].permission.find(
            (perm) => perm._id.toString() === permissionId
        );

        if (!firstPermission) {
            const error = new Error("Permission data inconsistent.");
            error.statusCode = 500;
            throw error;
        }

        // Collect all module IDs that have this permission
        const permissionModuleIds = matchedModules.map(mod => mod._id.toString());

        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Permission data fetched successfully",
            data: {
                ...firstPermission.toObject(),
                permission_module_id: permissionModuleIds
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.postPermission = async (req, res, next) => {
    if (!validation(req, res)) return;

    const { name, status, permissionmodule } = req.body;
    const userId = req.userId;

    try {
        if (!Array.isArray(permissionmodule) || permissionmodule.length === 0) {
            const error = new Error("At least one permission module is required.");
            error.statusCode = 400;
            throw error;
        }

        const slug = slugify(name);
        const sharedPermissionId = new mongoose.Types.ObjectId();

        for (const moduleId of permissionmodule) {
            const moduleDoc = await PermissionModule.findOne({
                _id: moduleId,
                created_by: userId
            });

            if (!moduleDoc) {
                const error = new Error(`Permission module with ID ${moduleId} does not exist.`);
                error.statusCode = 404;
                throw error;
            }

            // Skip if permission with same _id already exists
            const alreadyExists = moduleDoc.permission.some(
                (perm) => perm._id.equals(sharedPermissionId)
            );

            if (alreadyExists) continue;

            const newPermissionItem = {
                _id: sharedPermissionId,
                name,
                status,
                slug,
                created_by: userId,
            };

            await moduleDoc.addPermission(newPermissionItem);
        }

        return res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Permissions added successfully",
        });

    } catch (error) {
        next(error);
    }
};

exports.putPermission = async (req, res, next) => {
    const userId = req.userId;
    const permissionId = req.params.permissionId;
    const { name, status, permissionmodule } = req.body;

    try {
        // Step 1: Remove the permission from all permission modules
        await PermissionModule.updateMany(
            {},
            { $pull: { permission: { _id: permissionId } } }
        );

        // Step 2: Prepare the permission object to insert
        const newPermission = {
            _id: permissionId, // re-using the same _id
            name,
            slug: slugify(name),
            status,
            created_by: userId
        };

        // Step 3: Add it to the selected permission modules
        const updateOps = permissionmodule.map(moduleId => (
            PermissionModule.updateOne(
                { _id: moduleId },
                { $push: { permission: newPermission } }
            )
        ));

        await Promise.all(updateOps);

        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Permission updated across selected modules",
        });

    } catch (error) {
        next(error);
    }
};
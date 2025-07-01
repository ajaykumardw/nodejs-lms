const User = require('../../model/User');
const PackageType = require('../../model/PackageType')
const { errorResponse, successResponse } = require('../../util/response');
const validate = require('../../util/validation');
const Role = require('../../model/Role')
const mongoose = require('mongoose')
const PermissionModule = require('../../model/PermissionModule')

exports.getRoleAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const role = await Role.find({
            created_by: { $in: [userId, "6811ae35704460d978b84eaa"] }
        })
            .select('type name description status permissions created_by')
            .populate('company_id', 'first_name last_name email');

        if (!role) {
            return errorResponse(res, "Role does not exist")
        }

        return successResponse(res, "Role fetched successfully", role)

    } catch (error) {
        next(error)
    }
}

exports.createRoleAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const user = await User.findById(userId)

        if (!user) {
            return errorResponse(res, "User fetched successfully")
        }

        const packageId = user.package_id;

        const packageType = await PackageType.findOne({
            'package.items._id': packageId
        });

        if (!packageType) {
            return errorResponse(res, "Package type does not exist", {}, 404)
        }

        const package = packageType.package?.items;

        if (!package) {
            return errorResponse(res, "Package does not exist", {}, 404)
        }

        const findPackage = package.find(item =>
            item._id.toString().trim() === packageId.toString().trim()
        );

        const rawPermissions = findPackage?.permissions;

        // Convert to plain object (avoid Mongoose internals)
        const permission = JSON.parse(JSON.stringify(rawPermissions))

        // Filter valid ObjectId keys
        const moduleIds = Object.keys(permission).filter(mongoose.Types.ObjectId.isValid);

        const modules = await PermissionModule.find({
            _id: { $in: moduleIds }
        }).lean();

        const filteredModules = modules.map(module => {
            const allowedPermissionIds = (permission[module._id.toString()] || []).filter(mongoose.Types.ObjectId.isValid);

            return {
                ...module,
                permission: (module.permission || []).filter(p =>
                    allowedPermissionIds.includes(p._id.toString())
                )
            };
        });

        return successResponse(res, "Permission data fetched successfully", filteredModules)

    } catch (error) {
        next(error);
    }
}

exports.postRoleAPI = async (req, res, next) => {
    try {
        if (!validate(req, res)) return;

        const userId = req.userId;

        const { name, description, status, permissions } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return errorResponse(res, "User does not exist", {}, 404)
        }

        const companyId = user.created_by;

        const role = new Role({
            company_id: companyId,
            name: name,
            status: status,
            description: description,
            type: true,
            permissions,
            created_by: userId
        });

        await role.save();

        return successResponse(res, "Role created successfully")

    } catch (error) {
        next(error)
    }
}

exports.putRoleAPI = async (req, res, next) => {
    try {
        const roleId = req.params.roleId;
        const { name, description, status, permissions } = req.body;
        const userId = req.userId;

        const role = await Role.findOne({ created_by: userId, _id: roleId });

        if (!role) {
            const error = new Error("Role does not exist!");
            error.statusCode = 404;
            throw error;
        }

        role.permissions = {};

        // Update basic fields
        role.name = name;
        role.description = description;
        role.status = status;

        // Clear and set new permissions map
        role.permissions = permissions

        await role.save();

        return successResponse(res, "Role updated successfully")

    } catch (error) {
        next(error)
    }
}
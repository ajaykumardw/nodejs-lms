require('dotenv').config();
const Role = require('../model/Role');
const User = require('../model/User');
const RoleUser = require('../model/RoleUser');
const { validationResult } = require('express-validator');
const validate = require('../util/validation')

exports.getRoleAPI = (req, res, next) => {
    return res.json({ user: req.userId })
}

exports.postRoleAPI = (req, res, next) => {
    if (!validate(req, res)) return;

    const { name, description, type } = req.body;

    User.findById(req.userId).then(user => {
        if (!user) {
            const error = new Error("User does not authenticated!");
            error.statusCode = 500;
            throw error;
        }
        const role = new Role({
            company_id: user._id,
            name: name,
            description: description,
            type: type,
            created_by: user._id
        });
        return role.save();
    }).then(() => {
        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Role created successfully!"
        });
    }).catch(err => {
        next(err);
    })
}

exports.postRoleUserAPI = (req, res, next) => {

    if (!validate(req, res)) return;

    const { roleId, userId } = req.body;
    User.findById(req.userId).then(user => {
        const roleUser = new RoleUser({
            role_id: roleId,
            user_id: userId,
            created_by: user._id
        });
        return roleUser.save();
    }).then(() => {
        res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "Role user created successfully"
        });
    }).catch(err => {
        next(err);
    })
}
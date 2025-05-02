require('dotenv').config();
const Role = require('../model/Role');
const User = require('../model/User');
const RoleUser = require('../model/RoleUser');
const validate = require('../util/validation')

exports.getRoleAPI = (req, res, next) => {
    Role.find({ created_by: req.userId })
        .select('type name description status') // select specific fields from Role
        .populate('created_by', 'first_name last_name email')   // populate only name and email from User
        .populate('company_id', 'first_name last_name email')
        .then(data => {
            res.status(200).json({
                status: "Success",
                statusCode: 200,
                message: "Role fetched successfully!",
                data: data
            });
        })
        .catch(err => {
            next(err);
        });
};

exports.postRoleAPI = (req, res, next) => {
    if (!validate(req, res)) return;

    const { name, description, type, status } = req.body;

    User.findById(req.userId).then(user => {
        if (!user) {
            const error = new Error("User does not authenticated!");
            error.statusCode = 500;
            throw error;
        }
        const role = new Role({
            company_id: user._id,
            name: name,
            status: status,
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
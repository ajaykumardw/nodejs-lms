require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/User');
const { validationResult } = require('express-validator')
const jwtSecretKey = process.env.JWT_SECRET;
const expireTime = process.env.token_expire_time;

exports.postAPILogIn = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: 'Failure',
            statusCode: 422,
            message: "Validation failed",
            errors: errors.array() // fixed typo: `erros` → `errors`
        });
    }

    const { email, password } = req.body;
    let loadedUser;

    User.findOne({ email: email })
        .then(user => {
            if (!user) {
                const error = new Error("A user with this email cannot be found!");
                error.statusCode = 401;
                throw error;
            }
            loadedUser = user;
            return bcrypt.compare(password, user.password);
        })
        .then(isEqual => {
            if (!isEqual) {
                const error = new Error("Wrong password");
                error.statusCode = 401;
                throw error;
            }

            const token = jwt.sign(
                { email: loadedUser.email, userId: loadedUser._id.toString() },
                jwtSecretKey,
                { expiresIn: `${expireTime}h` }
            );

            res.status(200).json({
                status: "Success",
                statusCode: 200,
                message: "User logged in successfully!",
                token: token,
                userId: loadedUser._id.toString()
            });
        })
        .catch(err => {
            next(err); // ✅ This ensures your error middleware gets it
        });
};

require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../model/User');
const validate = require('../../util/validation');
const LogSession = require("../../model/LoginSession");
const BlacklistedToken = require('../../model/BlacklistedToken');
const { hash, normalizeEmail, decrypt } = require('../../util/encryption');
const { errorResponse, successResponse } = require('../../util/response');

const jwtSecretKey = process.env.JWT_SECRET;
const expireTime = Number(process.env.token_expire_time);

exports.postAPILogIn = async (req, res, next) => {
    try {

        if (!validate(req, res)) return;

        const companyId = "68538f50752fe999fdf22797";
        const notificationId = "6878cd0351dcbae6759e8912";

        const { email, password, } = req.body;

        const normalizedEmail = email;

        const user = await User.findOne({ email_hash: hash(normalizeEmail(normalizedEmail)) });

        if (!user) {

            return errorResponse(res, "A user with this email cannot be found!", {}, 401)
        }

        if (!user.status) {

            return errorResponse(res, "Your account is deactivated!", {}, 400)
        }

        const isEqual = await bcrypt.compare(password, user.password);

        if (!isEqual) {

            return errorResponse(res, "Wrong password!", {}, 401)
        }

        const expiresInSeconds = expireTime * 60 * 60;
        const expirationTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;

        const token = jwt.sign(
            {
                email: user.email,
                userId: user._id.toString(),
            },
            jwtSecretKey,
            { expiresIn: `${expireTime}h` }
        );

        const logSession = new LogSession({
            user_id: user._id,
            session_type: "1",
            ip_address: req.ip || "",
            activity_time: Date.now()
        });

        await logSession.save();

        return res.status(200).json({
            status: "Success",
            statusCode: 200,
            message: "User logged in successfully!",
            token,
            expiresAt: expirationTimestamp,
            userId: user._id.toString(),
            email,
            name: `${user.first_name} ${user.last_name}`
        });

    } catch (err) {

        return errorResponse(res, "An internal server error occurred.", err.message, 500)
    }
};

exports.postLogOutController = async (req, res, next) => {
    try {

        const userId = req?.userId;

        const authHeader = req.get('Authorization');

        if (!authHeader) {
            return errorResponse(res, "Not authenticated: Missing Authorization header", {}, 404)
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return errorResponse(res, "Not authenticated: Token missing", {}, 404)
        }

        const decoded = jwt.verify(token, jwtSecretKey);

        const expiresAt = new Date(decoded.exp * 1000);

        await BlacklistedToken.create({
            token,
            expiresAt
        });

        const logSession = new LogSession({
            user_id: userId,
            session_type: "2",
            ip_address: req.ip || "",
            activity_time: Date.now()
        });

        await logSession.save();

        return successResponse(res, "User logged out successfully")

    } catch (error) {
        next(error)
    }
}

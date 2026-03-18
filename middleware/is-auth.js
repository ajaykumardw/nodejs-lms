const jwt = require('jsonwebtoken');
const jwtSecretKey = process.env.JWT_SECRET;
const BlacklistedToken = require('../model/BlacklistedToken');
const { errorResponse } = require('../util/response');


module.exports = async (req, res, next) => {
    try {
        const authHeader = req.get('Authorization');
        if (!authHeader) {

            return errorResponse(res, "Not authenticated: Missing Authorization header", {}, 401)
        }

        const token = authHeader.split(' ')[1];
        if (!token) {

            return errorResponse(res, "Not authenticated: Token missing", {}, 401)
        }

        //  Check if token is blacklisted
        const isBlacklisted = await BlacklistedToken.findOne({
            token
        });

        if (isBlacklisted) {

            return errorResponse(res, "Token has been logged out. Please log in again.", {}, 401)
        }

        // Verify token
        const decodedToken = jwt.verify(token, jwtSecretKey);

        if (!decodedToken) {

            return errorResponse(res, "Not authenticated: Invalid token", {}, 401)
        }

        req.userId = decodedToken.userId;
        req.user = decodedToken;

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {

            return errorResponse(res, "Token expired. Please log in again.", {}, 401)
        }

        return errorResponse(res, "Server authentication error", {}, 500)
    }
};

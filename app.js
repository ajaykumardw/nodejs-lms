require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const authRoute = require('./route/auth');
const adminRoute = require('./route/admin');

const app = express();

// ✅ Environment variables
const MongoURL = process.env.MONGODB_URL;       // 🔄 Use consistent casing
const port = process.env.PORT || 4000;          // ✅ Fallback to 3000 if undefined

// ✅ Middleware
app.use(flash());
app.use(bodyParser.json()); // or: app.use(express.json());

// ✅ CORS Middleware
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PATCH, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );
    next();
});

// ✅ API Routes
app.use('/api/auth', authRoute);
app.use('/api/admin', adminRoute);

// ✅ Error Handling Middleware (last!)
app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: 'Failure',
        statusCode: error.statusCode || 500,
        message: error.message || 'Internal Server Error'
    });
});

mongoose.connect(MongoURL)
    .then(() => {
        app.listen(port, () => {
            console.log(`Server started on ${port} !`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });

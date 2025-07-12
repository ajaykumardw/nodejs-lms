// ... all the other imports
const multer = require('multer');
const express = require('express');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const authRoute = require('./route/auth');
const adminRoute = require('./route/admin');
const companyRouter = require('./route/company')
const appConfig = require('./model/AppConfig')
const path = require('path')
const fs = require('fs')

const app = express();

// Load env vars
require('dotenv').config();
const MongoURL = process.env.MONGODB_URL;
const port = process.env.PORT || 4000;

const imageDir = path.join(__dirname, "/public/frames");

if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir);
}

// Serve static files from "public" folder
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public/uploads")));
app.use(express.static(path.join(__dirname, "public/frames")));

// Body parsing middleware
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1000mb' }));
app.use(flash());

// CORS middleware
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

// Routes
app.use('/api/auth', authRoute);
app.use('/api/admin', adminRoute);
app.use('/api/company', companyRouter);

// Error handler (last)
app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: 'Failure',
        statusCode: error.statusCode || 500,
        message: error.message || 'Internal Server Error'
    });
});

// DB connection
mongoose.connect(MongoURL)
    .then(() => {
        app.listen(port, () => {
            console.log(`Server started on ${port}!`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });

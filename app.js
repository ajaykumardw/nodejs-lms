// All imports
const cron = require('node-cron')
const express = require('express');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const authRoute = require('./route/auth');
const adminRoute = require('./route/admin');
const AppConfig = require("./model/AppConfig")
const companyRouter = require('./route/company');
const userRouter = require('./route/user');
const scheduleNotificationCommand = require("./command/ScheduleNotification")

require('./worker/reportWorker')

const path = require('path');
const fs = require('fs');
const cors = require('cors');

require('dotenv').config();

const app = express();

const MongoURL = process.env.MONGODB_URL;
const port = process.env.PORT || 4000;

// Define public directory
const publicDir = path.join(__dirname, 'public');
const imageDir = path.join(publicDir, 'company_logo');

// Ensure /public/company_logo folder exists
if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, {
        recursive: true
    });
}

app.use(cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json({
    limit: "1000mb"
}));
app.use(express.urlencoded({
    extended: true,
    limit: "1000mb"
}));

app.use(flash());

app.use('/public', express.static(publicDir));

// Routes
app.use('/api/auth', authRoute);
app.use('/api/admin', adminRoute);
app.use('/api/company', companyRouter);
app.use('/api/user', userRouter);

// Test route
app.get('/ping', (req, res) => {
    res.send("pong");
});

// Error handler
app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: 'Failure',
        statusCode: error.statusCode || 500,
        message: error.message || 'Internal Server Error'
    });
});

// Start server
mongoose.connect(MongoURL)
    .then(() => {
        const server = app.listen(port, () => console.log(`Server started on ${port}`));

        server.setTimeout(1000 * 60 * 20); // 20 minutes
        server.keepAliveTimeout = 1000 * 60 * 20;
        server.headersTimeout = 1000 * 60 * 20;

    })
    .catch(err => {
        console.error("MongoDB connection error:", err);
    });

cron.schedule('* * * * *', async () => {

    try {

        console.log("Running of schedule command");

        await scheduleNotificationCommand();
    } catch (err) {
        console.error('Cron error:', err);
    }
}, {
    timezone: 'Asia/Kolkata'
});
const cron = require("node-cron");
const express = require("express");
const mongoose = require("mongoose");
const flash = require("connect-flash");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Routes
const authRoute = require("./route/auth");
const adminRoute = require("./route/admin");
const companyRouter = require("./route/company");
const userRouter = require("./route/user");

// Commands
const scheduleNotificationCommand = require("./command/ScheduleNotification");

// Workers
require("./worker/reportWorker");

const app = express();

const PORT = process.env.PORT || 4000;
const MongoURL = process.env.MONGODB_URL;

// ---------------------------------------------------
// TRUST PROXY (important behind nginx)
// ---------------------------------------------------

app.set("trust proxy", 1);

// ---------------------------------------------------
// PUBLIC DIRECTORY
// ---------------------------------------------------

const publicDir = path.join(__dirname, "public");
const imageDir = path.join(publicDir, "company_logo");

if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

// ---------------------------------------------------
// CORS
// ---------------------------------------------------

app.use(
    cors({
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
        ],
    })
);

// ---------------------------------------------------
// BODY PARSER
// ---------------------------------------------------

// IMPORTANT:
// Keep lower unless absolutely needed.
// Huge JSON bodies can crash Node memory.

app.use(
    express.json({
        limit: "5gb",
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "5gb",
        parameterLimit: 500000,
    })
);

// ---------------------------------------------------
// FLASH
// ---------------------------------------------------

app.use(flash());

// ---------------------------------------------------
// STATIC FILES
// ---------------------------------------------------

app.use("/public", express.static(publicDir));

// ---------------------------------------------------
// ROUTES
// ---------------------------------------------------

app.use("/api/auth", authRoute);
app.use("/api/admin", adminRoute);
app.use("/api/company", companyRouter);
app.use("/api/user", userRouter);

// ---------------------------------------------------
// HEALTH CHECK
// ---------------------------------------------------

app.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

// ---------------------------------------------------
// ERROR HANDLER
// ---------------------------------------------------

app.use((error, req, res, next) => {
    console.error("API ERROR:", error);

    res.status(error.statusCode || 500).json({
        status: "Failure",
        statusCode: error.statusCode || 500,
        message: error.message || "Internal Server Error",
    });
});

// ---------------------------------------------------
// DATABASE CONNECTION
// ---------------------------------------------------

mongoose
    .connect(MongoURL, {
        maxPoolSize: 20,
    })
    .then(() => {
        console.log("MongoDB Connected");

        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // ---------------------------------------------------
        // SERVER TIMEOUTS
        // ---------------------------------------------------

        // 20 minutes

        server.timeout = 1000 * 60 * 20;

        server.keepAliveTimeout = 1000 * 60 * 20;

        server.headersTimeout = 1000 * 60 * 21;

        console.log("Server timeout configured");

    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    });

// ---------------------------------------------------
// CRON JOB
// ---------------------------------------------------

cron.schedule(
    "0 11,17 * * *",
    async () => {
        try {
            console.log("Running scheduled notification command");

            await scheduleNotificationCommand();

            console.log("Schedule command completed");

        } catch (err) {
            console.error("Cron error:", err);
        }
    },
    {
        timezone: "Asia/Kolkata",
    }
);

// ---------------------------------------------------
// GLOBAL ERROR HANDLERS
// ---------------------------------------------------

process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION:", err);
});

// ---------------------------------------------------
// MEMORY LOGGING (optional)
// ---------------------------------------------------

setInterval(() => {
    const used = process.memoryUsage();

    console.log({
        rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    });
}, 300000);
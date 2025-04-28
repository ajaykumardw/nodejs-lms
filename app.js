require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const MongoURL = process.env.Mongodb_url;

const app = express();

mongoose.connect(MongoURL)
    .then(() => {
        app.listen(3000, () => {
            console.log("Server started on 3000!");
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });

const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectDBD = async () => {
    try {
        
        const databaseUri = process.env.DATABASE_URI;
        if (!databaseUri) {
            throw new Error('DATABASE_URI environment variable is required');
        }
        const conn = await mongoose.connect(databaseUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

// Connect to MongoDB
connectDBD();

const resetStars = asyncHandler(async () => {
    try {
        const result = await User.updateMany(
            {},
            { $set: { "stars": 10 } }
        );

        console.log(`${result.modifiedCount} users' stars have been reset to 10.`);
    } catch (error) {
        console.error(`Error resetting stars: ${error.message}`);
    } finally {
        mongoose.disconnect();
    }
});

resetStars();

//run by typing node resetStars.js in the terminal
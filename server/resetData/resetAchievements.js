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

const resetAchievements = asyncHandler(async () => {
    try {
        const result = await User.updateMany(
            {},
            { $set: { "achievements.$[].progress": 0 } }
        );

        console.log(`${result.modifiedCount} users' achievements have been reset.`);
    } catch (error) {
        console.error(`Error resetting achievements: ${error.message}`);
    } finally {
        mongoose.disconnect();
    }
});

resetAchievements();

//run by typing node resetAchievements.js in the terminal
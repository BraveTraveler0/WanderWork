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

const resetXP = asyncHandler(async () => {
    try {
        const result = await User.updateMany(
            {},
            { $set: { "xp": 0 } }
        );

        console.log(`${result.modifiedCount} users' xp have been reset to 0.`);
    } catch (error) {
        console.error(`Error resetting xp: ${error.message}`);
    } finally {
        mongoose.disconnect();
    }
});

resetXP();

//run by typing node resetXP.js in the terminal
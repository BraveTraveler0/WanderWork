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

const deleteUsersWithLastLoginIn2023 = asyncHandler(async () => {
  try {
    // Find all users whose lastLogin is in 2023
    const users = await User.find({
      lastLogin: {
        $gte: new Date('2023-01-01'),
        $lt: new Date('2024-01-01'),
      },
    });

    if (!users || users.length === 0) {
      console.log('No users found with last login in 2023');
      return;
    }

    // Delete all matching users
    const deletedUsers = await User.deleteMany({
      lastLogin: {
        $gte: new Date('2023-01-01'),
        $lt: new Date('2024-01-01'),
      },
    });

    if (!deletedUsers) {
      console.error('Error deleting users');
      return;
    }

    console.log(`${deletedUsers.deletedCount} users with last login in 2023 have been deleted`);
  } catch (error) {
    console.error('Error deleting users:', error);
  } finally {
    mongoose.disconnect();
  }
});

const deleteUsers = async () => {
  try {
    await deleteUsersWithLastLoginIn2023();
    console.log('Users with last login in 2023 have been deleted.');
  } catch (error) {
    console.error('Error deleting users:', error);
  } finally {
    mongoose.disconnect();
  }
};

deleteUsers();
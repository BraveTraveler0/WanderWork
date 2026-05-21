const asyncHandler = require('express-async-handler');
const Comment = require('../models/comments');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connectDB = async () => {
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
  connectDB();
  
  const deleteCommentsBeforeJan2024 = asyncHandler(async () => {
    try {
      // Find all posts created before January 1, 2024
      const posts = await Comment.find({
        createdAt: {
          $lt: new Date('2024-01-01'),
        },
      });
  
      if (!posts || posts.length === 0) {
        console.log('No comments found before January 1, 2024');
        return;
      }
  
      // Delete all matching posts
      const deletedComments = await Comment.deleteMany({
        createdAt: {
          $lt: new Date('2024-01-01'),
        },
      });
  
      if (!deletedComments) {
        console.error('Error deleting comments');
        return;
      }
  
      console.log(`${deletedComments.deletedCount} comments created before January 1, 2024 have been deleted`);
    } catch (error) {
      console.error('Error deleting comments:', error);
    } finally {
      mongoose.disconnect();
    }
  });
  
  const deleteComments = async () => {
    try {
      await deleteCommentsBeforeJan2024();
      console.log('Comments created before January 1, 2024 have been deleted.');
    } catch (error) {
      console.error('Error deleting comments:', error);
    } finally {
      mongoose.disconnect();
    }
  };
  
  deleteComments();
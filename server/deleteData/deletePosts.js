const asyncHandler = require('express-async-handler');
const Post = require('../models/posts');
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
  
  const deletePostsBeforeJan2024 = asyncHandler(async () => {
    try {
      // Find all posts created before January 1, 2024
      const posts = await Post.find({
        createdAt: {
          $lt: new Date('2024-01-01'),
        },
      });
  
      if (!posts || posts.length === 0) {
        console.log('No posts found before January 1, 2024');
        return;
      }
  
      // Delete all matching posts
      const deletedPosts = await Post.deleteMany({
        createdAt: {
          $lt: new Date('2024-01-01'),
        },
      });
  
      if (!deletedPosts) {
        console.error('Error deleting posts');
        return;
      }
  
      console.log(`${deletedPosts.deletedCount} posts created before January 1, 2024 have been deleted`);
    } catch (error) {
      console.error('Error deleting posts:', error);
    } finally {
      mongoose.disconnect();
    }
  });
  
  const deletePosts = async () => {
    try {
      await deletePostsBeforeJan2024();
      console.log('Posts created before January 1, 2024 have been deleted.');
    } catch (error) {
      console.error('Error deleting posts:', error);
    } finally {
      mongoose.disconnect();
    }
  };
  
  deletePosts();
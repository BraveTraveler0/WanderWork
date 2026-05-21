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

const countAndDeletePostsMissingImage = asyncHandler(async () => {
  try {
    // Count and find examples for posts where postimage doesn't exist
    const postsWithoutImageField = await Post.find({ postimage: { $exists: false } }).limit(1);
    const countWithoutImageField = await Post.countDocuments({ postimage: { $exists: false } });
    
    // Count and find examples for posts where postimage is null
    const postsWithNullImage = await Post.find({ postimage: null }).limit(1);
    const countWithNullImage = await Post.countDocuments({ postimage: null });
    
    // Count and find examples for posts where postimage is empty string
    const postsWithEmptyImage = await Post.find({ postimage: "" }).limit(1);
    const countWithEmptyImage = await Post.countDocuments({ postimage: "" });
    
    // Total count
    const totalMissingImage = countWithoutImageField + countWithNullImage + countWithEmptyImage;
    
    console.log('===== POSTS MISSING POSTIMAGE SUMMARY =====');
    console.log(`Total posts missing postimage: ${totalMissingImage}`);
    console.log(`- Posts without postimage field: ${countWithoutImageField}`);
    console.log(`- Posts with null postimage: ${countWithNullImage}`);
    console.log(`- Posts with empty string postimage: ${countWithEmptyImage}`);
    
    // Log example posts
    console.log('\n===== EXAMPLE POSTS =====');
    
    if (postsWithoutImageField.length > 0) {
      console.log('\nExample post without postimage field:');
      console.log(JSON.stringify(postsWithoutImageField[0].toObject(), null, 2));
    } else {
      console.log('\nNo posts found without postimage field');
    }
    
    if (postsWithNullImage.length > 0) {
      console.log('\nExample post with null postimage:');
      console.log(JSON.stringify(postsWithNullImage[0].toObject(), null, 2));
    } else {
      console.log('\nNo posts found with null postimage');
    }
    
    if (postsWithEmptyImage.length > 0) {
      console.log('\nExample post with empty string postimage:');
      console.log(JSON.stringify(postsWithEmptyImage[0].toObject(), null, 2));
    } else {
      console.log('\nNo posts found with empty string postimage');
    }
    
    // Confirm before deleting
    if (totalMissingImage > 0) {
      console.log('\n===== DELETING POSTS =====');
      
      // Delete posts without postimage field
      if (countWithoutImageField > 0) {
        const deleteWithoutField = await Post.deleteMany({ postimage: { $exists: false } });
        console.log(`Deleted ${deleteWithoutField.deletedCount} posts without postimage field`);
      }
      
      // Delete posts with null postimage
      if (countWithNullImage > 0) {
        const deleteNullImage = await Post.deleteMany({ postimage: null });
        console.log(`Deleted ${deleteNullImage.deletedCount} posts with null postimage`);
      }
      
      // Delete posts with empty string postimage
      if (countWithEmptyImage > 0) {
        const deleteEmptyImage = await Post.deleteMany({ postimage: "" });
        console.log(`Deleted ${deleteEmptyImage.deletedCount} posts with empty string postimage`);
      }
      
      console.log(`\nTotal posts deleted: ${totalMissingImage}`);
    } else {
      console.log('\nNo posts to delete');
    }
    
  } catch (error) {
    console.error('Error processing posts:', error);
  } finally {
    mongoose.disconnect();
    console.log('\nDatabase connection closed');
  }
});

const runAnalysis = async () => {
  try {
    await countAndDeletePostsMissingImage();
    console.log('\nOperation complete.');
  } catch (error) {
    console.error('Error during operation:', error);
  } finally {
    mongoose.disconnect();
  }
};

runAnalysis();
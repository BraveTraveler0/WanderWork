const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Post = require('../models/posts'); // Assuming Post is the correct model for posts collection
const User = require('../models/User'); // Assuming User is the correct model for users collection

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

const deleteUnmatchedPosts = asyncHandler(async () => {
    try {
        // Find all documents in the posts collection
        const posts = await Post.find({});

        if (!posts || posts.length === 0) {
            console.log('No posts found');
            return;
        }

        // Iterate over each post document
        for (const post of posts) {
            // Check if the corresponding user exists in the users collection
            const userExists = await User.exists({ _id: post.slug });

            if (!userExists) {
                // If the user doesn't exist, delete the post document
                await Post.deleteOne({ _id: post._id });
                console.log(`Deleted post with _id: ${post._id} because the corresponding user does not exist.`);
            }
        }
    } catch (error) {
        console.error('Error deleting unmatched posts:', error);
    } finally {
        mongoose.disconnect();
    }
});

const deletePosts = async () => {
    try {
        await deleteUnmatchedPosts();
        console.log('Unmatched posts have been deleted.');
    } catch (error) {
        console.error('Error deleting unmatched posts:', error);
    } finally {
        mongoose.disconnect();
    }
};

deletePosts();
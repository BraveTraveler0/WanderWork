const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const PostRank = require('../models/postranks');  // Assuming PostRank is the correct model for postranks collection
const Post = require('../models/posts');  // Assuming Post is the correct model for posts collection

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

const deleteUnmatchedPostRanks = asyncHandler(async () => {
    try {
        // Find all documents in the postranks collection
        const postRanks = await PostRank.find({});

        if (!postRanks || postRanks.length === 0) {
            console.log('No postranks found');
            return;
        }

        // Iterate over each postrank document
        for (const postRank of postRanks) {
            // Check if the corresponding post exists in the posts collection
            const postExists = await Post.exists({ _id: postRank.post });

            if (!postExists) {
                // If the post doesn't exist, delete the postrank document
                await PostRank.deleteOne({ _id: postRank._id });
                console.log(`Deleted postrank with _id: ${postRank._id} because the corresponding post does not exist.`);
            }
        }
    } catch (error) {
        console.error('Error deleting unmatched postranks:', error);
    } finally {
        mongoose.disconnect();
    }
});

const deletePosts = async () => {
    try {
        await deleteUnmatchedPostRanks();
        console.log('Unmatched postranks have been deleted.');
    } catch (error) {
        console.error('Error deleting unmatched postranks:', error);
    } finally {
        mongoose.disconnect();
    }
};

deletePosts();
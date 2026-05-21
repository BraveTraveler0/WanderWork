const cron = require('node-cron');
require('dotenv').config({ path: '../.env' });
const { createNewPostAuto } = require('../controllers/postsController');

// Required packages
const AWS = require('aws-sdk');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Bot configuration
const BOT_USER = {
    user: "ZenV",
    slug: "6660be9f973e9a2cf9cfe598",
    profileImage: "/images/417c30ea9079ae93046610a6d437fda9",
};

const POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: false,
};

// AWS Configuration
const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

// Initialize AWS S3 SDK
const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
});

// Track posted images using a JSON file
const POSTED_IMAGES_FILE = path.join(__dirname, 'posted_images.json');

// Load posted images from file
async function loadPostedImages() {
    try {
        const data = await fs.readFile(POSTED_IMAGES_FILE, 'utf8');
        return new Set(JSON.parse(data));
    } catch (error) {
        return new Set();
    }
}

// Save posted images to file
async function savePostedImages(postedImages) {
    await fs.writeFile(
        POSTED_IMAGES_FILE,
        JSON.stringify([...postedImages]),
        'utf8'
    );
}

// Fetch images from S3
async function getImagesFromFolder() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'creativeMixer/',
        };

        const data = await s3.listObjectsV2(params).promise();

        if (!data.Contents || data.Contents.length === 0) {
            throw new Error('No objects found in the S3 bucket folder');
        }

        return data.Contents;
    } catch (error) {
        console.error('Error fetching images from S3:', error);
        return [];
    }
}

// Get unposted images
function getUnpostedImages(allImages, postedImages) {
    return allImages.filter(image => !postedImages.has(image.Key));
}

// Get S3 object data
async function getS3ObjectData(sourceKey) {
    try {
        const s3Object = await s3.getObject({
            Bucket: bucketName,
            Key: sourceKey
        }).promise();

        return {
            buffer: s3Object.Body,
            contentType: s3Object.ContentType,
            filename: path.basename(sourceKey)
        };
    } catch (error) {
        console.error('Error getting S3 object data:', error);
        return null;
    }
}

// Create image
async function createImage(s3ObjectData) {
    try {
        const form = new FormData();
        form.append('image', s3ObjectData.buffer, {
            filename: s3ObjectData.filename,
            contentType: s3ObjectData.contentType
        });

        const response = await axios.post(
            "https://application-server-cwqu.onrender.com/api/images",
            form,
            { 
                headers: { 
                    ...form.getHeaders()
                } 
            }
        );

        return response.data.imagePath;
    } catch (error) {
        console.error('Error creating image:', error);
        throw new Error('Image creation failed');
    }
}

// Generate post content
async function generatePostContent() {
    try {
        const postedImages = await loadPostedImages();
        const allImages = await getImagesFromFolder();
        const unpostedImages = getUnpostedImages(allImages, postedImages);

        if (unpostedImages.length === 0) {
            console.log('All images have been posted. Resetting tracking...');
            postedImages.clear();
            await savePostedImages(postedImages);
            // Get fresh list of images after reset
            return generatePostContent();
        }

        const randomIndex = Math.floor(Math.random() * unpostedImages.length);
        const selectedImage = unpostedImages[randomIndex];

        const s3ObjectData = await getS3ObjectData(selectedImage.Key);
        if (!s3ObjectData) {
            throw new Error('Failed to get S3 object data');
        }

        const imagePath = await createImage(s3ObjectData);

        // Mark image as posted
        postedImages.add(selectedImage.Key);
        await savePostedImages(postedImages);

        return {
            postimage: imagePath,
            visibility: 'all',
            category: 'aoncon2024'
        };
    } catch (error) {
        console.error('Error generating post content:', error);
        throw error;
    }
}

function initializeCreativeMixerScheduler() {
    console.log('Initializing post scheduler...');

    const cronExpression = '*/10 * * * *';

    //const cronExpression = '0 */2 * * *';

    cron.schedule(cronExpression, async () => {
        try {
            console.log(`Scheduled post initiated at ${new Date().toLocaleString()}`);

            const postContent = await generatePostContent();

            console.log("postimage route", postContent.postimage);
            
            const postData = {
                ...BOT_USER,
                ...postContent,
                ...POST_SETTINGS,
            };

            console.log(postData);

            const newPost = await createNewPostAuto(postData);
            console.log(`Automated post created successfully. Post ID: ${newPost._id}`);
        } catch (error) {
            console.error('Error creating automated post:', error);
        }
    }, {
        scheduled: true,
        timezone: "America/New_York"
    });

    console.log('Post scheduler initialized successfully.');
}

module.exports = { initializeCreativeMixerScheduler };
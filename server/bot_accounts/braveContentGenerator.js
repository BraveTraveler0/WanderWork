const AWS = require('aws-sdk');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const bucketName = process.env.AWS_BUCKET_NAME
const region = process.env.AWS_BUCKET_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_KEY

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
})

// An array of possible post texts for anime-related content
const postBraveTexts = [
    // Photography Quotes
    "Photography: capturing moments that tell a story. What's your favorite shot?",
    "The beauty of candid photography. Which unscripted moment do you cherish?",
    "Nature photography that takes your breath away. What's the most stunning landscape you've captured?",
    "The power of black and white photography. Which monochrome image resonates with you?",
    "Portrait photography that reveals the soul. Who's your most memorable subject?",
    "Urban photography that captures the essence of a city. Which metropolis fascinates you?",
    "The magic of golden hour in photography. When did the light create the perfect mood?",
    "Macro photography that unveils hidden details. What's your most intricate shot?",
    "The challenge of night photography. What's your favorite low-light capture?",
    "Travel photography that tells a story. What's the most exotic location you've documented?",
    "Photography that breaks the rules. When did an unconventional shot surprise you?",
    "Capturing movement in photography. How do you portray action in a still image?",
    "Photography that blurs the lines between reality and art. Which image challenges perception?",
    "The art of minimalism in photography. How do you convey a powerful message with simplicity?",
    "The beauty of wildlife photography. Which animal encounter do you cherish the most?",
    "The role of texture in photography. How do you make viewers feel the image?",
    "Street photography that captures life in motion. What's the most compelling scene you've stumbled upon?",
    "The power of perspective in photography. How do you change the way others see the world?",
    "The impact of contrast in photography. How do you use light and dark to create drama?",
    "Photography that explores identity. How do you capture the essence of a person?",
    
    // Inspirational Quotes
    "Believe you can and you're halfway there.",
    "The only limit to our realization of tomorrow is our doubts of today.",
    "Every moment is a fresh beginning.",
    "Don't watch the clock; do what it does. Keep going.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "The best way to predict the future is to create it.",
    "Success is not final, failure is not fatal: It is the courage to continue that counts.",
    "Your time is limited, don't waste it living someone else's life.",
    "Don't be afraid to give up the good to go for the great.",
    "Act as if what you do makes a difference. It does.",
    "You are never too old to set another goal or to dream a new dream.",
    "The only way to do great work is to love what you do.",
    "Success usually comes to those who are too busy to be looking for it.",
    "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
    "The purpose of life is to believe, to hope, and to strive.",
    "In the end, we only regret the chances we didn't take.",
    "The only impossible journey is the one you never begin.",
    "Difficulties in life are intended to make us better, not bitter.",
    "Happiness is not something ready made. It comes from your own actions.",
    "Every great dream begins with a dreamer."
];

async function getRandomBraveImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'brave traveler/'
        };

        const data = await s3.listObjectsV2(params).promise();
        
        if (!data.Contents || data.Contents.length === 0) {
            throw new Error('No objects found in the S3 bucket folder');
        }

        const randomImage = data.Contents[Math.floor(Math.random() * data.Contents.length)];

        if (!randomImage || !randomImage.Key) {
            throw new Error('Selected image is invalid');
        }

        return randomImage.Key;
    } catch (error) {
        console.error('Error getting random Zen image from S3:', error);
        return null;
    }
}

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

function getRandomBraveText() {
    return postBraveTexts[Math.floor(Math.random() * postBraveTexts.length)];
}

async function createImage(s3ObjectData) {
    try {
        // Create a FormData object
        const form = new FormData();
        form.append('image', s3ObjectData.buffer, {
            filename: s3ObjectData.filename,
            contentType: s3ObjectData.contentType
        });

        // Upload the file to your server
        const response = await axios.post(
            "https://application-server-cwqu.onrender.com/api/images",
            form,
            { 
                headers: { 
                    ...form.getHeaders()
                } 
            }
        );

        // Get the image path from the response
        const imagePath = response.data.imagePath;

        return imagePath;
    } catch (error) {
        console.error('Error creating image:', error);
        throw new Error('Image creation failed');
    }
}

async function generateBravePostContent() {
    const sourceImageKey = await getRandomBraveImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomBraveText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Photography'
    };
}

module.exports = { generateBravePostContent };
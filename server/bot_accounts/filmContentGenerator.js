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
const postFilmTexts = [
"Where Stories Come to Life",
"The Magic of Moving Pictures",
"Capturing Dreams, Frame by Frame",
"Beyond the Silver Screen",
"The Language of Light and Shadow",
"Where Reality Meets Imagination",
"A Journey Through Celluloid",
"Lights, Camera, Storytelling",
"Crafting Worlds, One Scene at a Time",
"The Art of Suspended Belief",
"Projecting Emotions Across Time",
"Reel Dreams and Cinematic Realities",
"The Alchemy of Sound and Vision",
"A Lens Into the Human Experience",
"Where Every Frame Tells a Story",
"The Rhythm of Light and Sound",
"Stories That Transcend Time",
"Where Visual Poetry Meets Narrative",
"Cinema: The Universal Language",
"Creating Magic, One Shot at a Time",
"Exploring Life Through the Lens",
"The Symphony of Film and Sound",
"Frames That Echo Across Generations",
"The Heartbeat of a Story in Motion",
"Where Fiction Becomes Immortal",
"A Canvas of Dreams and Memories",
"Films: The Time Machines of Imagination",
"Scenes That Shape Our World",
"The Craft of Turning Pages into Pictures",
"Storytelling in Motion",
"Where the Camera Becomes a Pen",
"Tales Woven Through Light and Sound",
"The Visionary World Behind the Lens",
"The Language of Cinematic Masterpieces",
"Moments Captured, Forever Remembered",
"Films: Windows to Other Worlds",
"Where Every Cut Holds a Secret",
"Creating Visual Symphonies",
"The Art of Framing Emotions",
"A Cinematic Journey Through Time and Space",
"Stories Written in Light",
"Films: The Nexus of Art and Technology",
"Where Dreams Find Their Stage",
"Behind Every Film, a Universe Unfolds",
"Frames that Whisper Untold Tales",
"Cinema: A Mirror of the Human Soul",
"Sculpting Time Through Editing",
"The Power of Cinematic Storytelling",
"Lights, Camera, Infinite Possibilities",
"The Essence of Life, Captured on Film"
];

async function getRandomFilmImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'film/'
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
        console.error('Error getting random Film image from S3:', error);
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

function getRandomFilmText() {
    return postFilmTexts[Math.floor(Math.random() * postFilmTexts.length)];
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

async function generateFilmPostContent() {
    const sourceImageKey = await getRandomFilmImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomFilmText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Film'
    };
}

module.exports = { generateFilmPostContent };
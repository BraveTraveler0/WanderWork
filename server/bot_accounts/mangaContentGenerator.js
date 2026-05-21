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
const postMangaTexts = [
"Where stories live in illustrations",
"A world that expands with every page turned",
"Where imagination and reality intersect",
"Art woven from words and pictures",
"Stories that last forever",
"Characters that touch the heart",
"Moments when emotions are etched into drawings",
"The magic of blending pictures and words",
"Adventures of boys, dreams of girls",
"Pages that bring tears and emotions",
"Moments of emotion that transcend dimensions",
"Heroes who walk alongside their readers",
"Between the dream and reality drawn",
"Truth hidden within the pages",
"A palette of vibrant emotions",
"A beautiful world of escapism",
"Souls drawn on paper",
"A story that keeps you craving the next twist",
"A journey of growth alongside characters",
"Emotion packed into every panel",
"A world of endless possibilities",
"Stories told in a unique style",
"A Japanese culture loved worldwide",
"Art created by hand-drawn lines",
"Emotions stirred by dialogue and panels",
"The coming-of-age stories of boys and girls",
"A book that can change a life",
"A story of friendship and courage",
"A world where characters come to life",
"Timeless masterpieces loved across generations",
"A doorway to the world of fantasy",
"Depictions of epic battle scenes",
"Moments where emotions leap off the page",
"The futuristic world of science fiction",
"Memorable scenes that stay in the heart",
"Where legendary stories are born",
"A masterpiece portraying human drama",
"A book filled with laughter and tears",
"A story where past and future intersect",
"Deep messages embedded in the drawings",
"The beginning of an epic tale",
"An infinite universe spreading within manga",
"Characters who create legends",
"Moments when emotions overflow from the drawings",
"Love and care poured into every detail",
"Characters who live within the story",
"A plot so exciting you can't wait for the next page",
"Everything drawn has a meaning",
"The power to create new worlds",
"Stories filled with messages that resonate with the heart"
];

async function getRandomMangaImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'manga/'
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
        console.error('Error getting random Manga image from S3:', error);
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

function getRandomMangaText() {
    return postMangaTexts[Math.floor(Math.random() * postMangaTexts.length)];
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

async function generateMangaPostContent() {
    const sourceImageKey = await getRandomMangaImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomMangaText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Manga'
    };
}

module.exports = { generateMangaPostContent };
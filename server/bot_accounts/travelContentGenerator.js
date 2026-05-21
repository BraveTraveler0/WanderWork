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
const postTravelTexts = [
"Wander where the WiFi is weak",
"Adventure awaits, go find it",
"Exploring the world, one step at a time",
"Collecting memories, not things",
"The world is a book, and I’m turning the pages",
"Chasing sunsets across continents",
"Travel far, travel wide",
"Discovering hidden gems around the globe",
"Leave only footprints, take only pictures",
"A passport full of dreams",
"Escape the ordinary, embrace the extraordinary",
"Journey beyond the horizon",
"Life’s an adventure, pack for it",
"Exploring the road less traveled",
"Let’s get lost in new places",
"Around the world in endless days",
"Embrace the unknown, discover the unforgettable",
"Follow your compass, not the crowd",
"Every destination tells a new story",
"Living for the moments that take your breath away",
"Wherever you go, go with all your heart",
"The journey is the destination",
"Travel light, live fully",
"Take memories, leave only footprints",
"Go where you feel most alive",
"Get lost in adventure",
"The world is too big to stay in one place",
"Catch flights, not feelings",
"Wander often, wonder always",
"Find beauty in the journey",
"Let the adventure begin",
"Exploring new places, creating new memories",
"Pack light, travel far",
"Travel is the only thing you buy that makes you richer",
"Adventures fill your soul",
"New destinations, endless adventures",
"Take the scenic route",
"Not all who wander are lost",
"Explore more, worry less",
"Find joy in the journey",
"Traveling leaves you speechless, then turns you into a storyteller",
"Go explore the unknown",
"Roam free and wild",
"Say yes to new adventures",
"Find your happy place around the world",
"Adventure is out there",
"Let your dreams be your guide",
"Collect moments, not places",
"See the world through new eyes",
"Travel far enough to meet yourself"
];

async function getRandomTravelImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'travel/'
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
        console.error('Error getting random Travel image from S3:', error);
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

function getRandomTravelText() {
    return postTravelTexts[Math.floor(Math.random() * postTravelTexts.length)];
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

async function generateTravelPostContent() {
    const sourceImageKey = await getRandomTravelImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomTravelText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Travel'
    };
}

module.exports = { generateTravelPostContent };
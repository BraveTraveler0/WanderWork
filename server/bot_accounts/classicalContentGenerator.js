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
const postClassicalTexts = [
"Timeless Elegance in Every Note",
"Where Harmony Meets History",
"The Symphony of Centuries",
"Echoes of Musical Genius",
"Classical Melodies, Modern Hearts",
"The Art of Orchestral Brilliance",
"Composing Emotions Through Time",
"Where Passion Meets Precision",
"The Eternal Language of Classical Music",
"From Baroque to Romantic: A Musical Journey",
"The Poetry of Piano and Strings",
"Classical Music: The Soundtrack of Sophistication",
"Maestros and Their Masterpieces",
"The Elegance of the Concert Hall",
"Timeless Compositions, Timeless Beauty",
"Where Notes Dance Across Centuries",
"The Symphony of Human Emotion",
"Classical Rhythms in a Modern World",
"The Art of Musical Storytelling",
"Echoes of Genius Through Time",
"Where Tradition Meets Innovation",
"The Graceful Power of the Orchestra",
"Composing Dreams into Reality",
"The Timeless Appeal of Classical Melodies",
"From Mozart to Modernism",
"The Elegance of Musical Expression",
"Classical Music: A Journey Through Time",
"The Harmony of Instruments and Souls",
"Where Every Note Tells a Story",
"The Artistry of the Conductor's Baton",
"Timeless Tunes for the Modern Ear",
"The Symphony of Cultural Heritage",
"Classical Composition: The Art of Emotion",
"Echoes of Greatness in Every Performance",
"Where Passion Meets Perfection",
"The Eternal Beauty of Classical Scores",
"From Concerto to Symphony: A Musical Odyssey",
"The Elegance of Musical Interpretation",
"Classical Rhythms: The Heartbeat of Art",
"The Timeless Charm of Chamber Music",
"Where Melody Meets Mastery",
"The Art of Musical Conversation",
"Composing Legacies, Note by Note",
"The Symphony of Human Experience",
"Classical Music: The Language of Emotions",
"Echoes of Brilliance Across Generations",
"Where Tradition Dances with Innovation",
"The Graceful Power of Musical Expression",
"Timeless Compositions for Modern Souls",
"The Art of Listening: A Classical Journey",
"From Overture to Finale: Musical Stories",
"The Elegance of Orchestral Harmony",
"Classical Genius: Inspiring Generations",
"Where Every Instrument Sings",
"The Symphony of Cultural Exchange",
"Composing Beauty, One Note at a Time",
"The Timeless Appeal of the Classics",
"Echoes of History in Every Measure",
"Where Passion Meets Precision in Music",
"The Art of Musical Interpretation",
"Classical Rhythms: The Pulse of Creativity",
"From Bach to Beethoven: A Musical Evolution",
"The Elegance of Musical Storytelling",
"Timeless Melodies for the Soul",
"Where Harmony Transcends Time",
"The Symphony of Human Creativity",
"Classical Music: A Universal Language",
"Echoes of Genius in Every Performance",
"Where Tradition Meets Contemporary Expression",
"The Graceful Power of Classical Composition",
"Composing Emotions Across Centuries",
"The Art of Musical Excellence",
"From Baroque Brilliance to Romantic Passion",
"The Elegance of Timeless Tunes",
"Classical Mastery: Inspiring the Future"
];

async function getRandomClassicalImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'classical/'
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
        console.error('Error getting random Classical image from S3:', error);
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

function getRandomClassicalText() {
    return postClassicalTexts[Math.floor(Math.random() * postClassicalTexts.length)];
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

async function generateClassicalPostContent() {
    const sourceImageKey = await getRandomClassicalImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomClassicalText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Classical'
    };
}

module.exports = { generateClassicalPostContent };
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
const postAiTexts = [
"Neural Elegance in Every Output",
"Where Algorithms Meet Big Data",
"The Neural Network of Centuries",
"Echoes of Artificial Genius",
"Machine Learning Models, Human Insights",
"The Art of Computational Brilliance",
"Processing Emotions Through Code",
"Where Precision Meets Petabytes",
"The Universal Language of AI",
"From Perceptrons to Deep Learning: An AI Journey",
"The Poetry of Pixels and Processors",
"Artificial Intelligence: The Operating System of Innovation",
"Data Scientists and Their Algorithms",
"The Elegance of the Server Farm",
"Timeless Algorithms, Endless Possibilities",
"Where Bits Dance Across Processors",
"The Neural Symphony of Human-AI Collaboration",
"AI Rhythms in a Digital World",
"The Art of Algorithmic Storytelling",
"Echoes of Silicon Genius Through Time",
"Where Tradition Meets Technological Innovation",
"The Graceful Power of Distributed Computing",
"Coding Dreams into Reality",
"The Timeless Appeal of AI Solutions",
"From Turing to Transformers",
"The Elegance of Computational Expression",
"Artificial Intelligence: A Journey Through Data",
"The Harmony of Inputs and Outputs",
"Where Every Datapoint Tells a Story",
"The Artistry of the Neural Architecture",
"Timeless Algorithms for the Modern Era",
"The Neural Network of Cultural Heritage",
"AI Composition: The Art of Pattern Recognition",
"Echoes of Innovation in Every Model",
"Where Gigaflops Meet Creativity",
"The Eternal Beauty of Efficient Algorithms",
"From Supervised to Unsupervised: An AI Odyssey",
"The Elegance of Model Interpretation",
"AI Rhythms: The Heartbeat of Technology",
"The Timeless Charm of Expert Systems",
"Where Data Meets Mastery",
"The Art of Machine-Human Conversation",
"Composing Legacies, Line by Line of Code",
"The Neural Network of Human Experience",
"Artificial Intelligence: The Language of Progress",
"Echoes of Brilliance Across Compute Clusters",
"Where Tradition Dances with AI Innovation",
"The Graceful Power of Computational Expression",
"Timeless Algorithms for Modern Problems",
"The Art of Learning: An AI Journey",
"From Input to Output: Computational Stories",
"The Elegance of Distributed Harmony",
"AI Genius: Inspiring Generations of Innovators",
"Where Every Neuron Computes",
"The Neural Network of Cultural Exchange",
"Composing Intelligence, One Parameter at a Time",
"The Timeless Appeal of the AI Classics",
"Echoes of Data in Every Prediction",
"Where Passion Meets Precision in Computation",
"The Art of Model Interpretation",
"AI Rhythms: The Pulse of Digital Creativity",
"From Boolean Logic to Neural Networks: An AI Evolution",
"The Elegance of Algorithmic Storytelling",
"Timeless Models for the Digital Age",
"Where Artificial Harmony Transcends Limits",
"The Neural Symphony of Human-AI Creativity",
"Artificial Intelligence: A Universal Computational Language",
"Echoes of Silicon Genius in Every Inference",
"Where Classical Computing Meets Quantum Expression",
"The Graceful Power of AI Composition",
"Computing Emotions Across Datasets",
"The Art of Algorithmic Excellence",
"From Rule-Based Systems to Deep Learning: AI's Passionate Journey",
"The Elegance of Timeless Algorithms",
"AI Mastery: Inspiring the Technological Future"
];

async function getRandomAiImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'ai_non_nsfw/'
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
        console.error('Error getting random Ai image from S3:', error);
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

function getRandomAiText() {
    return postAiTexts[Math.floor(Math.random() * postAiTexts.length)];
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

async function generateAiPostContent() {
    const sourceImageKey = await getRandomAiImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomAiText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Ai Art'
    };
}

module.exports = { generateAiPostContent };
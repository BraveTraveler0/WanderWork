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
const postScifiTexts = [
"The Last Guardian of the Galaxy",
"Neon Dreams on Alpha Centauri",
"Where Advanced Technology Meets Alien Magic",
"Shadows of a Fallen Space Empire",
"Origin Stories of the Cosmic Pioneers",
"Guardians of the Quantum Realm",
"Architects of Orbital Cities",
"Memories of First Contact",
"Adventures in the Subatomic Universe",
"The Forests of Xenoflora Prime",
"Whispers of the Celestial Beings",
"Remnants of Destroyed Star Systems",
"The Nexus of Interstellar Crossroads",
"Guardians of the Astral Dimension",
"Where Aliens and Humans Clash",
"The Labyrinth of Forgotten Space Stations",
"Rise of the Techno-Organic Lifeforms",
"The Last Stand Against Galactic Evil",
"Keepers of the Eternal Starfire",
"Sentinels of the Multiverse",
"Fragments of Alternate Timelines",
"The Explorer's Final Frontier",
"Tales from the Edge of the Known Universe",
"Where Light-Speed and Wormholes Meet",
"The Pulse of Living Planets",
"Whispers of the Cosmic Entities",
"Remnants of Ancient Alien Civilizations",
"The Nexus of All Parallel Universes",
"Guardians of the Galactic Archives",
"Where Stardust Flows Like Water",
"The Last Stand of the Space Pioneers",
"Echoes of a Thousand Alien Worlds",
"The Symphony of Starlight and Void",
"Sentinels at the Edge of the Galaxy",
"Fragments of the Cosmic Anomaly",
"The Architect of Dyson Spheres",
"Whispers from the Quantum Foam",
"Guardians of the Temporal Continuum",
"Where Biotechnology and Cybernetics Collide",
"The Pulse of the Digital Consciousness Era",
"Echoes of the First Interstellar Voyage",
"Remnants of Extinct Alien Species",
"The Nexus of Science and Spirituality",
"Guardians of the Cosmic Seas",
"Where Virtual and Physical Realities Merge",
"The Last Transmission of a Dying Planet",
"Whispers of the Galactic Elders",
"Keepers of the Eternal Stargates",
"The Heart of Cosmic Destiny",
"Sentinels of the Dream Dimensions",
"Fragments of the Shattered Space-Time Continuum",
"The Architect of Impossible Worlds",
"Echoes from the Intergalactic Council",
"Guardians at the Crossroads of Dimensions",
"Where Parallel Universes Converge",
"The Pulse of the Living Starship",
"Whispers of the Simulation Masters",
"Remnants of the Galactic Wars",
"The Nexus of Past and Future Technologies",
"Guardians of the Astral Highways"
];

async function getRandomScifiImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'sci_fi/'
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
        console.error('Error getting random Scifi image from S3:', error);
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

function getRandomScifiText() {
    return postScifiTexts[Math.floor(Math.random() * postScifiTexts.length)];
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

async function generateScifiPostContent() {
    const sourceImageKey = await getRandomScifiImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomScifiText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Sci-fi'
    };
}

module.exports = { generateScifiPostContent };
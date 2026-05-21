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
const postConceptArtTexts = [
"Echoes of a Forgotten World",
"Whispers in the Cosmic Void",
"The Last Guardian of Time",
"Neon Dreams in a Cyberpunk Haze",
"Where Magic and Technology Collide",
"Shadows of a Dying Star",
"The Clockwork Heart of Creation",
"Threads of Destiny Unraveled",
"Guardians at the Edge of Reality",
"The Architect of Impossible Cities",
"Crystalline Memories of a Lost Age",
"Echoes from the Quantum Realm",
"The Fractal Forests of Imagination",
"Whispers of the Celestial Seas",
"Remnants of a Shattered Moon",
"The Nexus of Infinite Possibilities",
"Guardians of the Astral Plane",
"Where Dreams and Nightmares Dance",
"The Labyrinth of Forgotten Gods",
"Echoes of a Techno-Organic Future",
"The Last Bastion of Hope",
"Whispers in the Void Between Worlds",
"Keepers of the Eternal Flame",
"The Clockwork Menagerie",
"Sentinels of the Quantum Gates",
"Fragments of a Broken Reality",
"The Architect's Final Blueprint",
"Echoes from the Edge of Time",
"Guardians of the Cosmic Web",
"Where Light and Shadow Converge",
"The Pulse of the Living Planet",
"Whispers of the Star Weavers",
"Remnants of a Forgotten Utopia",
"The Nexus of All Realities",
"Guardians of the Astral Archives",
"Where Magic Flows Like Water",
"The Last Stand of the Dreamers",
"Echoes of a Thousand Worlds",
"The Clockwork Symphony of Creation",
"Sentinels at the Edge of Infinity",
"Fragments of the Cosmic Egg",
"The Architect of Living Cities",
"Whispers from the Quantum Foam",
"Guardians of the Temporal Tides",
"Where Science and Sorcery Meet",
"The Pulse of the Digital Cosmos",
"Echoes of the First Spark",
"Remnants of the Star Forges",
"The Nexus of Mind and Machine",
"Guardians of the Astral Seas",
"Where Reality Bends and Breaks",
"The Last Echo of a Dying Universe",
"Whispers of the Void Dancers",
"Keepers of the Eternal Cycle",
"The Clockwork Heart of Destiny",
"Sentinels of the Dream Realms",
"Fragments of the Cosmic Mirror",
"The Architect of Impossible Dreams",
"Echoes from the Quantum Chorus",
"Guardians at the Crossroads of Fate",
"Where Time Folds Upon Itself",
"The Pulse of the Living Starship",
"Whispers of the Reality Weavers",
"Remnants of the Celestial Wars",
"The Nexus of Past and Future",
"Guardians of the Astral Flames",
"Where Dimensions Collide and Merge",
"The Last Beacon in the Cosmic Storm",
"The Clockwork Ballet of the Universes"
];

async function getRandomConceptArtImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'concept_art/'
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
        console.error('Error getting random Concept Art image from S3:', error);
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

function getRandomConceptArtText() {
    return postConceptArtTexts[Math.floor(Math.random() * postConceptArtTexts.length)];
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

async function generateConceptArtPostContent() {
    const sourceImageKey = await getRandomConceptArtImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomConceptArtText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Concept Art'
    };
}

module.exports = { generateConceptArtPostContent };
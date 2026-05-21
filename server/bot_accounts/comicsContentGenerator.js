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
const postComicsTexts = [
"Unveiling the Secret Identity",
"Whispers in the Gotham Night",
"The Last Guardian of the Multiverse",
"Neon Dreams in Metropolis",
"Where Super Science Meets Magic",
"Shadows of a Fallen Hero",
"The Heart of the Justice League",
"Origin Stories Unfold",
"Guardians of the Multiverse",
"Architects of Comic Book Cities",
"Memories of Crisis Events",
"Adventures in the Microverse",
"The Forests of Poison Ivy",
"Whispers of the Celestial Comics",
"Remnants of Destroyed Planets",
"The Nexus of Comic Crossovers",
"Guardians of the Astral Plane",
"Where Heroes and Villains Clash",
"The Labyrinth of Forgotten Characters",
"Rise of the Techno-Organic Heroes",
"The Last Stand Against Evil",
"Whispers in the Comic Shop",
"Keepers of the Eternal Flame",
"The Menagerie of Animal-Themed Heroes",
"Sentinels of the Multiverse",
"Fragments of Retconned Realities",
"The Artist's Final Splash Page",
"Tales from the Edge of the Panel",
"Guardians of the Comic Continuity",
"Where Light and Dark Heroes Meet",
"The Pulse of Living Planets",
"Whispers of the Celestial Comic Gods",
"Remnants of Forgotten Story Arcs",
"The Nexus of All Comic Universes",
"Guardians of the Comic Archives",
"Where Ink Flows Like Water",
"The Last Stand of the Golden Age",
"Echoes of a Thousand Comic Worlds",
"The Symphony of Pencil and Ink",
"Sentinels at the Edge of the Page",
"Fragments of the Cosmic Crossover",
"The Architect of Comic Book Cities",
"Whispers from the Artist's Pen",
"Guardians of the Time Stream",
"Where Science Heroes and Magic Collide",
"The Pulse of the Digital Comics Era",
"Echoes of the First Superhero",
"Remnants of Canceled Series",
"The Nexus of Canon and Fanon",
"Guardians of the Comic Seas",
"Where Reality and Fiction Merge",
"The Last Panel of a Dying Series",
"Whispers of the Comic Creators",
"Keepers of the Eternal Franchises",
"The Heart of Comic Book Destiny",
"Sentinels of the Dream Comics",
"Fragments of the Shattered Fourth Wall",
"The Architect of Impossible Storylines",
"Echoes from the Comic Conventions",
"Guardians at the Crossroads of Canons",
"Where Timelines Converge",
"The Pulse of the Living Narrative",
"Whispers of the Retcon Masters",
"Remnants of the Comic Book Wars",
"The Nexus of Past and Future Issues",
"Guardians of the Astral Inks",
"Where Dimensions of Comics Collide",
"The Last Beacon in the Comic Storm",
"Echoes of the Legendary Artists",
"The Ballet of Panels and Gutters"
];

async function getRandomComicsImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'comics/'
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

function getRandomComicsText() {
    return postComicsTexts[Math.floor(Math.random() * postComicsTexts.length)];
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

async function generateComicsPostContent() {
    const sourceImageKey = await getRandomComicsImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomComicsText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Comics'
    };
}

module.exports = { generateComicsPostContent };
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
const postAnimeTexts = [
    "Which anime character do you relate to the most?",
    "If you could live in any anime world, which one would it be?",
    "Anime: where reality meets imagination. What's your favorite blend?",
    "The art of anime: appreciating every frame. What's your favorite art style?",
    "Exploring themes in anime: from the profound to the whimsical.",
    "Anime music that touches your soul. What's on your playlist?",
    "The evolution of anime: from classic to modern. What era speaks to you?",
    "Anime friendships that stood the test of time. Who's your favorite duo?",
    "The power of anime to inspire and motivate. Has an anime changed your perspective?",
    "Anime villains we love to hate. Who's the most compelling antagonist you've seen?",
    "Slice of life or epic adventure? What's your go-to anime genre?",
    "Anime food that looks too good to be real. What dish do you wish you could try?",
    "The impact of anime on global pop culture. How has it influenced you?",
    "Underrated anime gems. What's a series you think deserves more recognition?",
    "Anime and emotions: scenes that made you laugh, cry, or cheer.",
    "If you could have any anime superpower, what would it be?",
    "Anime openings that you never skip. What's your all-time favorite?",
    "The art of anime storytelling. What narrative technique impresses you the most?",
    "Cosplay inspiration: which anime character would you love to embody?",
    "Anime and technology: futuristic concepts that fascinate you.",
    "The philosophy of anime: deep thoughts hidden in colorful animations.",
    "Anime crossovers you'd love to see. Which worlds would you blend?",
    "The role of nature and seasons in anime. How does it enhance the storytelling?",
    "Anime and cultural exchange: what have you learned about Japan through anime?",
    "If you could revive any finished anime for one more season, which would it be?",
    "Anime character development arcs that left a lasting impression.",
    "The magic of Studio Ghibli. What's your favorite film and why?",
    "Anime soundtracks that set the perfect mood. What's on your playlist?",
    "The evolution of anime art: from cel animation to digital. What's your preference?",
    "Anime life lessons that stuck with you. What's the most impactful one you've encountered?",
    "Which anime protagonist's journey resonates with you the most?",
    "Anime battles that left you on the edge of your seat. Which is your favorite?",
    "The beauty of anime landscapes: which setting would you love to visit?",
    "Anime mentor figures who shaped their students' destinies. Who's the best?",
    "Anime festivals you'd love to attend. Which one excites you the most?",
    "The art of transformation in anime. What's the most epic transformation scene?",
    "Anime endings that left a mark. Which conclusion was the most satisfying?",
    "The influence of Japanese mythology in anime. What's your favorite reference?",
    "Anime duels that define rivalries. Which showdown is the most iconic?",
    "The role of animals and creatures in anime. Which one stole your heart?",
    "Anime time travel: if you could change one event, what would it be?",
    "The significance of anime opening themes. Which one gives you chills?",
    "Anime characters who break the fourth wall. Who does it best?",
    "The balance of light and darkness in anime. Which story mastered it?",
    "The most heartwarming anime family moments. Which scene made you smile?",
    "Anime villains with a tragic backstory. Who do you sympathize with?",
    "The charm of retro anime. What's your favorite classic series?",
    "Anime that explores the concept of identity. Which one made you reflect?",
    "The world of mecha in anime. Which robot would you pilot?",
    "Anime rivalries that pushed characters to their limits. Which one stands out?",
    "The role of food in anime. Which feast would you want to join?",
    "The magic of anime music: which OST can you listen to on repeat?",
    "Anime series that challenge societal norms. Which one opened your eyes?",
    "The evolution of character design in anime. Which era do you prefer?",
    "Anime couples with undeniable chemistry. Who's your OTP?",
    "The role of magic and mysticism in anime. Which series captures it best?",
    "Anime that blurs the line between hero and villain. Who's the most complex character?",
    "The significance of color in anime. Which palette left a lasting impression?",
    "Anime series that explore the concept of time. Which narrative fascinated you?",
    "Anime sports teams you'd love to join. Which one would you be a part of?"
];

async function getRandomZenImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'AnimeBot/'
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

function getRandomZenText() {
    return postAnimeTexts[Math.floor(Math.random() * postAnimeTexts.length)];
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

async function generateZenPostContent() {
    const sourceImageKey = await getRandomZenImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomZenText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Anime'
    };
}

module.exports = { generateZenPostContent };
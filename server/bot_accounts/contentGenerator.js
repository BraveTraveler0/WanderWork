const AWS = require('aws-sdk');
const S3 = require('aws-sdk/clients/s3');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
});

// An array of possible post texts for NSFW content
const postNSFWTexts = [
    "Am I your type?",
    "If being a little naughty is wrong, I don't want to be right.",
    "This one is just for you.",
    "Want to see me try it on?",
    "Why be a damsel in distress when you can be the one doing the rescuing?",
    "Do I have your attention now?",
    "I'm just getting started.",
    "I'm alone right now. Are you thinking what I'm thinking?",
    "Playing dress-up has never been more fun!",
    "My cosplay may be innocent, but my thoughts are anything but.",
    "Cosplaying my favorite characters, with a little extra spice.",
    "Cosplay isn't the only thing I'm good at dressing up for",
    "Living out my wildest fantasies, one cosplay at a time",
    "Want to see me without the clothes on?",
    "Do you guys think my workout routine has paid off?",
    "My guilty pleasure. Anyone else have a secret obsession?",
    "Want the uncensored version?",
    "Ever wonder what else I can do?",
    "Let’s just say, I have a wild imagination.",
    "Who knew a little bit of fabric could be so fun?",
    "Think I look good in this? Wait until you see what's next.",
    "What’s your fantasy? Maybe I can bring it to life.",
    "This is only the beginning, the best is yet to come.",
    "Getting into character is just half the fun.",
    "Ready to take things to the next level?",
    "I'm not just playing dress-up, I'm playing with your mind.",
    "Do you like it when I tease, or should I go all in?",
    "There's more to me than meets the eye.",
    "Want to guess what's underneath?",
    "Let's just say, I have a talent for surprises.",
    "Careful, you might get hooked.",
    "Would you join me if I asked nicely?",
    "Ever wondered what mischief I could get into?",
    "Dressed to impress, undressed to thrill.",
    "What if I told you the best is yet to come?",
    "Just when you thought you’d seen it all.",
    "Let’s make this our little secret.",
    "Do you dare to see what's next?",
    "Playing the part is easy, it's the teasing that's fun.",
    "What’s your wildest dream? I’m ready to fulfill it.",
    "Would you like to see the real me?",
    "Tease or please? I’ll let you decide.",
    "Behind closed doors, the real fun begins.",
    "Temptation looks good on me, don’t you think?",
    "What if I told you I have a few more surprises?",
    "This is just the pre-show, the main event is coming.",
    "Should I keep going, or is this too much for you?",
    "Ready for a little more fun?",
    "Curiosity might get the better of you.",
    "Why stop when we’re just getting started?",
    "The night is young, and so am I.",
    "Let’s take this fantasy to the next level.",
    "Can you handle what’s coming next?",
    "I’ve got a few tricks up my sleeve, want to see?",
    "You won’t believe what happens when the lights go down.",
    "What if I told you I’ve been saving the best for last?",
    "Dare to join me in this adventure?",
    "Just wait until you see the after-hours version.",
    "I’ve got something special planned just for you.",
    "Every detail, just for your eyes.",
    "Ready to break a few rules?",
    "Who said fantasies have to stay in your head?",
    "This is just the start of something unforgettable."
];

// An array of possible post texts for non-NSFW content
const postNonNSFWTexts = [
    "Ready to see the latest trends on me?",
    "How do you like this look?",
    "Striking a pose, just for you.",
    "Which outfit suits me best?",
    "Fashion is an art, and I’m the canvas.",
    "Do you think this outfit is a hit or miss?",
    "Let’s see how this style fits the occasion.",
    "When fashion meets fun, magic happens.",
    "What’s your take on this new look?",
    "Dressing up has never felt this good.",
    "Trying out new looks, and loving every moment.",
    "Transforming everyday outfits into runway ready.",
    "How’s this for a fashion statement?",
    "Exploring different styles, one outfit at a time.",
    "Every outfit tells a story—what’s this one saying?",
    "Ready for a fashion-forward adventure?",
    "Curious about my latest wardrobe addition?",
    "Every look has its own unique flair.",
    "See how this new piece brings out my personality.",
    "Fashion is my passion, and I’m here to showcase it.",
    "Which outfit makes you say ‘Wow’?",
    "Strutting my stuff in the latest trends.",
    "From casual to chic, watch me transform.",
    "Let’s see how this style works for me.",
    "Fashion is about feeling great—how do I look?",
    "Every new outfit is a new opportunity.",
    "What’s your favorite look so far?",
    "Playing dress-up with a twist of style.",
    "Turning everyday moments into fashion moments.",
    "Ready to see the magic of styling?"
];

let isNSFW = false; // This will alternate between true and false

async function getRandomKatImage() {
    try {
        const prefix = isNSFW ? 'kat_nsfw_images/' : 'kat_images/';
        const params = {
            Bucket: bucketName,
            Prefix: prefix
        };

        const data = await s3.listObjectsV2(params).promise();
        
        if (!data.Contents || data.Contents.length === 0) {
            throw new Error(`No objects found in the S3 bucket folder: ${prefix}`);
        }

        const randomImage = data.Contents[Math.floor(Math.random() * data.Contents.length)];

        if (!randomImage || !randomImage.Key) {
            throw new Error('Selected image is invalid');
        }

        return randomImage.Key;
    } catch (error) {
        console.error('Error getting random Kat image from S3:', error);
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

function getRandomKatText() {
    return isNSFW 
        ? postNSFWTexts[Math.floor(Math.random() * postNSFWTexts.length)]
        : postNonNSFWTexts[Math.floor(Math.random() * postNonNSFWTexts.length)];
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

async function generatePostContent() {
    const sourceImageKey = await getRandomKatImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomKatText();

    console.log("imagePath", imagePath);
    
    const postContent = {
        text: text,
        postimage: imagePath,
        visibility: isNSFW ? 'Supporters' : 'all',
        category: isNSFW ? 'NSFW' : 'Fashion'
    };

    // Toggle isNSFW for the next call
    isNSFW = !isNSFW;

    return postContent;
}

module.exports = { generatePostContent };
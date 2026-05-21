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
const postFashionTexts = [
"Where Style Meets Art",
"Fashion: A Reflection of Identity",
"The Language of Fabrics and Patterns",
"Expressing Personality Through Wardrobe",
"Where Creativity Becomes Wearable",
"The Ever-Changing Tapestry of Trends",
"Reinventing the Classics",
"A Canvas of Color and Texture",
"Fashion: The Art of Self-Expression",
"From Runway to Reality",
"Timeless Elegance, Modern Flair",
"Fashion is the Armor to Face Life",
"Style: The Ultimate Form of Individualism",
"Dressing for the Moment, Living for the Future",
"The Power of a Well-Crafted Outfit",
"Where Fabric Tells a Story",
"Fashion: The Intersection of Culture and Art",
"Bold Choices, Bold Statements",
"The Rhythm of Fashion’s Evolution",
"From Haute Couture to Street Style",
"Elegance in Every Detail",
"Fashion: A Timeless Love Affair",
"The Power of Simplicity in Fashion",
"Reinventing Yourself, One Outfit at a Time",
"A New Look, A New Perspective",
"Chasing Trends, Defining Style",
"The Art of Dressing with Confidence",
"Where Fashion Meets Innovation",
"Dressing as a Form of Empowerment",
"Fashion: A Journey Through Time and Culture",
"From Vintage to Future Trends",
"Where Minimalism Meets Maximalism",
"The Story Behind Every Stitch",
"Fashion is the Art You Wear",
"Breaking the Rules, Defining the Trends",
"The Intersection of Comfort and Style",
"A Symphony of Patterns and Colors",
"Fashion: A Global Language",
"From Sketch to Wardrobe",
"Elevating Everyday Outfits",
"The Drama of Bold Fashion Statements",
"Embodying Confidence Through Style",
"The Craftsmanship Behind Iconic Looks",
"Where Heritage Meets Modern Fashion",
"Effortless Style, Endless Possibilities",
"Making Statements Without Words",
"The Power of Accessories in Fashion",
"Transforming Identity Through Fashion",
"Where Innovation Defines Couture",
"Fashion: The Constant Reinvention of Self"
];

async function getRandomFashionImage() {
    try {
        const params = {
            Bucket: bucketName,
            Prefix: 'fashion/'
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
        console.error('Error getting random Fashion image from S3:', error);
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

function getRandomFashionText() {
    return postFashionTexts[Math.floor(Math.random() * postFashionTexts.length)];
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

async function generateFashionPostContent() {
    const sourceImageKey = await getRandomFashionImage();
    if (!sourceImageKey) {
        throw new Error('Failed to get a random image');
    }

    const s3ObjectData = await getS3ObjectData(sourceImageKey);
    if (!s3ObjectData) {
        throw new Error('Failed to get S3 object data');
    }

    console.log("s3ObjectData", s3ObjectData);
    const imagePath = await createImage(s3ObjectData);
    const text = getRandomFashionText();

    console.log("imagePath", imagePath);
    
    return {
        text: text,
        postimage: imagePath,
        visibility: 'all',
        category: 'Fashion'
    };
}

module.exports = { generateFashionPostContent };
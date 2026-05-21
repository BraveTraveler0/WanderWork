
require('dotenv').config({ path: '../.env' });  // Load environment variables from the .env file
const S3 = require('aws-sdk/clients/s3');

// Retrieve AWS credentials from environment variables
const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey
});

// List all objects created today and move them to creativeMixer folder
async function listTodaysObjectsAndMove() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const params = {
        Bucket: bucketName,
    };

    try {
        const objects = [];
        let isTruncated = true;

        // Fetch all objects from S3 bucket
        while (isTruncated) {
            const response = await s3.listObjectsV2(params).promise();
            const todaysObjects = response.Contents.filter(obj => 
                obj.LastModified >= today
            );

            objects.push(...todaysObjects);

            isTruncated = response.IsTruncated;
            if (isTruncated) {
                params.ContinuationToken = response.NextContinuationToken;
            }
        }

        console.log(`Found ${objects.length} objects created today`);

        // Now move each object to the 'creativeMixer' folder
        for (const obj of objects) {
            await moveObjectToFolder(obj.Key);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Move object to creativeMixer folder
async function moveObjectToFolder(objectKey) {
    try {
        // Create new key with creativeMixer/ prefix
        const newKey = `creativeMixer/${objectKey}`;
        
        // Copy the object to the new location (creativeMixer/)
        await s3.copyObject({
            Bucket: bucketName,
            CopySource: `${bucketName}/${objectKey}`,
            Key: newKey
        }).promise();

        // Delete the original object
        await s3.deleteObject({
            Bucket: bucketName,
            Key: objectKey
        }).promise();

        console.log(`Moved ${objectKey} to ${newKey}`);
    } catch (error) {
        console.error(`Error moving ${objectKey}:`, error);
    }
}

// Start the process
listTodaysObjectsAndMove().catch(console.error);
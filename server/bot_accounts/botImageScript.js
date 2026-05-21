const fs = require('fs').promises;
const path = require('path');
const util = require("util");
const axios = require('axios');
const FormData = require('form-data');


const creativeMixer = path.join(__dirname, 'CreativeMixer');

async function createImage(filePath) {
    try {
        // Read the file
        const fileContent = await fs.readFile(filePath);
        
        // Create a FormData object
        const form = new FormData();
        form.append('image', fileContent, {
            filename: path.basename(filePath),
            contentType: getMimeType(filePath)
        });

        // Upload the file to your server
        const response = await axios.post(
            "http://localhost:8000/api/images",
            form,
            { 
                headers: { 
                    ...form.getHeaders()
                } 
            }
        );

        // Get the image path from the response
        const imagePath = response.data.imagePath;

        // Remove the local file after upload
        await fs.unlink(filePath);

        console.log(`File ${path.basename(filePath)} processed and available at: ${imagePath}`);

        return imagePath;
    } catch (error) {
        console.error('Error creating image:', error);
        throw new Error(`Image creation failed for ${path.basename(filePath)}`);
    }
}

async function processAndUploadImages() {
    try {
        const files = await fs.readdir(creativeMixer);

        for (const filename of files) {
            try {
                const filePath = path.join(creativeMixer, filename);

                console.log(`Processing file: ${filename}`);

                const imagePath = await createImage(filePath);

                console.log(`Successfully processed and uploaded ${filename}`);
            } catch (fileErr) {
                console.error(`Error processing file ${filename}:`, fileErr);
                // Continue with the next file
            }
        }
    } catch (err) {
        console.error('Error reading zen_anime folder:', err);
    }
}

// Utility function to get MIME type from file extension
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.mp4') return 'video/mp4';
    return 'application/octet-stream'; // Default fallback
}

// Run the script
processAndUploadImages().catch(console.error);

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Groups = require('./models/groups.js');

/**
 * Process multiple images from a folder and create posts for each one
 * @param {string} folderPath - Path to the folder containing images
 * @param {string} userId - User ID (ObjectId as string)
 * @param {Object} postDetails - Additional details for the post
 * @returns {Promise<Array>} - Array of created posts
 */
const processFolderAndCreatePosts = async (folderPath, userId, postDetails = {}) => {

  try {
    // Read all files from the folder
    const files = fs.readdirSync(folderPath);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    if (imageFiles.length === 0) {
      console.log("No image files found in the specified folder.");
      return [];
    }

    const createdPosts = [];

    // Process each image
    for (const imageFile of imageFiles) {
      const imagePath = path.join(folderPath, imageFile);
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Create form data with the image
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.append('image', blob, imageFile);

      // Process the image and get the URL
      const imageUrl = await createPostProcess(formData);
      
      if (imageUrl) {
          // Send request to create post
          const post = await axios.post(
            "https://application-server-cwqu.onrender.com/posts", {
                user: "Beltline Cosplay",
                text: "",
                slug: "67df1cd0018acd163338179b",
                postimage: imageUrl,
                category: "beltlinecosplay",
                nsfw: false,
                remix: false,
                repost: true,
                profileImage: "/images/612e0b761c07b6bdc71ebaf71167752b",
                share: false,
                visibility: "all",
                boost: false,
                postTut: false,
                originalPost: true
              }
            );
        if (post) {
          createdPosts.push(post);
          console.log(`Post created for image: ${imageFile}`);
        }
      }
    }

    return createdPosts;
  } catch (error) {
    console.error("Error creating post:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return null;
  }
};

/**
 * Process a single image and upload it to the server
 * @param {FormData} imageData - Form data containing the image
 * @returns {Promise<string|null>} - URL of the uploaded image or null if upload failed
 */
const createPostProcess = async (imageData) => {
  try {
    const response = await axios.post(
      "https://application-server-cwqu.onrender.com/api/images",
      imageData,
      {
        headers: {
          "content-Type": "multipart/form-image"
        }
      }
    );
    
    const mediaPaths = response.data.imagePaths;
    console.log(mediaPaths, 'mediaPath');
    
    // Return the first image path as the post image
    return mediaPaths[0] || null;
  } catch (error) {
    console.error("Error uploading media:", error);
    return null;
  }
};

module.exports = {
    processFolderAndCreatePosts,
    createPostProcess
  };
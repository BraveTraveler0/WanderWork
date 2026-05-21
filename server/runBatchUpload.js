const { processFolderAndCreatePosts } = require('./groupImageProcessing.js');

// Replace these values with your actual folder path
const folderPath = './beltlinecosplay/Beltline Vday';
const userId = '67df1cd0018acd163338179b';

// Optional custom details
const postDetails = { 
  category: "beltlinecosplay",
  nsfw: false,
  remix: false,
  repost: false,
  profileImage: "/images/612e0b761c07b6bdc71ebaf71167752b",
  share: false,
  visibility: "all",
  groupName: "Beltline Cosplay"
};

// Run the batch processing
processFolderAndCreatePosts(folderPath, userId, postDetails)
  .then(posts => {
    console.log(`Successfully created ${posts} posts`);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in batch process:', error);
    process.exit(1);
  });
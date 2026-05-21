const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateConceptArtPostContent } = require('./conceptartContentGenerator');
const { ConceptArt_BOT_USER, ConceptArt_POST_SETTINGS } = require('./conceptartBotConfig');

function initializeConceptArtPostScheduler() {
  console.log('Initializing Concept Art post scheduler...');

  const cronExpression = '0 12,17 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Concept Art scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateConceptArtPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...ConceptArt_BOT_USER,
        ...postContent,
        ...ConceptArt_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Concept Art automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Concept Art automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Concept Art post scheduler initialized successfully.');
}

module.exports = { initializeConceptArtPostScheduler };
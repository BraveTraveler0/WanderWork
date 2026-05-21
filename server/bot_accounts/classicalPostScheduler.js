const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateClassicalPostContent } = require('./classicalContentGenerator');
const { Classical_BOT_USER, Classical_POST_SETTINGS } = require('./classicalBotConfig');

function initializeClassicalPostScheduler() {
  console.log('Initializing Classical post scheduler...');

  const cronExpression = '0 8,17 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Concept Art scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateClassicalPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Classical_BOT_USER,
        ...postContent,
        ...Classical_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Classical automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Classical automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Classical post scheduler initialized successfully.');
}

module.exports = { initializeClassicalPostScheduler };
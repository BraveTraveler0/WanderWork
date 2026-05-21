const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateTravelPostContent } = require('./travelContentGenerator');
const { Travel_BOT_USER, Travel_POST_SETTINGS } = require('./travelBotConfig');

function initializeTravelPostScheduler() {
  console.log('Initializing Travel post scheduler...');

  const cronExpression = '0 5,22 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Travel scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateTravelPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Travel_BOT_USER,
        ...postContent,
        ...Travel_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Travel automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Travel automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Travel post scheduler initialized successfully.');
}

module.exports = { initializeTravelPostScheduler };
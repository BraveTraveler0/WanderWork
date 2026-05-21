const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateBravePostContent } = require('./braveContentGenerator');
const { Brave_BOT_USER, Brave_POST_SETTINGS } = require('./braveBotConfig');

function initializeBravePostScheduler() {
  console.log('Initializing Brave post scheduler...');

  const cronExpression = '0 14,19 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Brave scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateBravePostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Brave_BOT_USER,
        ...postContent,
        ...Brave_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Brave automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Brave automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Brave post scheduler initialized successfully.');
}

module.exports = { initializeBravePostScheduler };
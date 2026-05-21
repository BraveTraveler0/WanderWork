const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateZenPostContent } = require('./zenContentGenerator');
const { Zen_BOT_USER, Zen_POST_SETTINGS } = require('./zenBotConfig');

function initializeZenPostScheduler() {
  console.log('Initializing Zen post scheduler...');

  const cronExpression = '0 13,18 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Zen scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateZenPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Zen_BOT_USER,
        ...postContent,
        ...Zen_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Zen automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Zen automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Zen post scheduler initialized successfully.');
}

module.exports = { initializeZenPostScheduler };
const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateFashionPostContent } = require('./fashionContentGenerator');
const { Fashion_BOT_USER, Fashion_POST_SETTINGS } = require('./fashionBotConfig');

function initializeFashionPostScheduler() {
  console.log('Initializing Fashion post scheduler...');

  const cronExpression = '0 8,12 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Fashion scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateFashionPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Fashion_BOT_USER,
        ...postContent,
        ...Fashion_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Fashion automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Fashion automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Fashion post scheduler initialized successfully.');
}

module.exports = { initializeFashionPostScheduler };
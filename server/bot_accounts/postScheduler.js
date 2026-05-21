const cron = require('node-cron');
const { createNewPostAuto } = require('./../controllers/postsController');
const { generatePostContent } = require('./contentGenerator');
const { BOT_USER, POST_SETTINGS } = require('./botConfig');

function initializePostScheduler() {
  console.log('Initializing post scheduler...');

  const cronExpression = '0 15,20 * * *';

  //const cronExpression = '*/5 * * * *';

  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generatePostContent();
      console.log("postContent", postContent);
      const postData = {
        ...BOT_USER,
        ...postContent,
        ...POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York" // Replace with your desired timezone
  });

  console.log('Post scheduler initialized successfully.');
}

module.exports = { initializePostScheduler };
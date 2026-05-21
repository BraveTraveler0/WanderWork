const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateAiPostContent } = require('./aiContentGenerator');
const { Ai_BOT_USER, Ai_POST_SETTINGS } = require('./aiBotConfig');

function initializeAiPostScheduler() {
  console.log('Initializing Ai post scheduler...');

  const cronExpression = '0 11,21 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Concept Art scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateAiPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Ai_BOT_USER,
        ...postContent,
        ...Ai_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Ai automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Ai automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Ai post scheduler initialized successfully.');
}

module.exports = { initializeAiPostScheduler };
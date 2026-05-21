const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateScifiPostContent } = require('./scifiContentGenerator');
const { Scifi_BOT_USER, Scifi_POST_SETTINGS } = require('./scifiBotConfig');

function initializeScifiPostScheduler() {
  console.log('Initializing Scifi post scheduler...');

  const cronExpression = '0 10,14 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Scifi scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateScifiPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Scifi_BOT_USER,
        ...postContent,
        ...Scifi_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Scifi automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Scifi automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Scifi post scheduler initialized successfully.');
}

module.exports = { initializeScifiPostScheduler };
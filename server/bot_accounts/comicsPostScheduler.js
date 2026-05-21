const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateComicsPostContent } = require('./comicsContentGenerator');
const { Comics_BOT_USER, Comics_POST_SETTINGS } = require('./comicsBotConfig');

function initializeComicsPostScheduler() {
  console.log('Initializing Comics post scheduler...');

  const cronExpression = '0 11 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Comics scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateComicsPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Comics_BOT_USER,
        ...postContent,
        ...Comics_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Comics automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Comics automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Comics post scheduler initialized successfully.');
}

module.exports = { initializeComicsPostScheduler };
const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateFilmPostContent } = require('./filmContentGenerator');
const { Film_BOT_USER, Film_POST_SETTINGS } = require('./filmBotConfig');

function initializeFilmPostScheduler() {
  console.log('Initializing Film post scheduler...');

  const cronExpression = '0 9,13 * * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Film scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateFilmPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Film_BOT_USER,
        ...postContent,
        ...Film_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Film automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Film automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Film post scheduler initialized successfully.');
}

module.exports = { initializeFilmPostScheduler };
const cron = require('node-cron');
const { createNewPostAuto } = require('../controllers/postsController');
const { generateMangaPostContent } = require('./mangaContentGenerator');
const { Manga_BOT_USER, Manga_POST_SETTINGS } = require('./mangaBotConfig');

function initializeMangaPostScheduler() {
  console.log('Initializing Manga post scheduler...');

  const cronExpression = '0 16 */2 * *';

  //const cronExpression = '*/5 * * * *';


  cron.schedule(cronExpression, async () => {
    try {
      console.log(`Manga scheduled post initiated at ${new Date().toLocaleString()}`);

      const postContent = await generateMangaPostContent();

      console.log("postimage route", postContent.postimage)
      const postData = {
        ...Manga_BOT_USER,
        ...postContent,
        ...Manga_POST_SETTINGS,
      };

      console.log(postData);

      const newPost = await createNewPostAuto(postData);
      console.log(`Manga automated post created successfully. Post ID: ${newPost._id}`);
    } catch (error) {
      console.error('Error creating Manga automated post:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });

  console.log('Manga post scheduler initialized successfully.');
}

module.exports = { initializeMangaPostScheduler };
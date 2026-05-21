// botConfig.js

const BOT_USER = {
    user: "KaterinaWaifu",  // The username of your bot
    slug: "66be10c019651be97404e724", // Replace with the actual ID of your bot account
    profileImage: "/images/fdc1811e2fbe2321ddf5732204b14d31", // If your bot has a profile image
  };
  
  const BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["NSFW"], // Categories your bot might post about
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
  };
  
  const POST_SETTINGS = {
    nsfw: true,
    remix: false,
    repost: false,
    share: false,
  };
  
  module.exports = {
    BOT_USER,
    BOT_SETTINGS,
    POST_SETTINGS,
  };
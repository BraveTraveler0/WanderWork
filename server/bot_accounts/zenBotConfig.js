const Zen_BOT_USER = {
    user: "Zen",  // The username of your Zen bot
    slug: "66c0ebce73dcd5674ae5d1d8", // Replace with the actual ID of your Zen bot account
    profileImage: "/images/96c9c312028ff715c49a97943328eb3b", // If Zen has a profile image
};

const Zen_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Anime"], // Categories Zen might post about
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Zen_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Zen_BOT_USER,
    Zen_BOT_SETTINGS,
    Zen_POST_SETTINGS,
};
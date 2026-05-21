const Brave_BOT_USER = {
    user: "Brave Traveler",  // The username of your Brave Traveler bot
    slug: "66d23311549fe21d3ae7d17b", // Replace with the actual ID of your Brave Traveler bot account
    profileImage: "/images/ce15accd45e285e4637d35f4e22d87b2", // If Brave Traveler has a profile image
};

const Brave_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Photography"], // Categories Zen might post about
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Brave_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Brave_BOT_USER,
    Brave_BOT_SETTINGS,
    Brave_POST_SETTINGS,
};
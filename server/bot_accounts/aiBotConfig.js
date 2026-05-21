const Ai_BOT_USER = {
    user: "Genesis",
    slug: "66e722f554d3f2a8aed2d461",
    profileImage: "/images/bfae2455ca5f6397a59f58582b5ac6c2",
};

const Ai_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Ai Art"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Ai_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Ai_BOT_USER,
    Ai_BOT_SETTINGS,
    Ai_POST_SETTINGS,
};
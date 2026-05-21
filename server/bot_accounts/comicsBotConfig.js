const Comics_BOT_USER = {
    user: "Zarx",
    slug: "66ddd3de5d675672be0285fc",
    profileImage: "/images/5369e127dec39880fc6df28c5e34eb82",
};

const Comics_BOT_SETTINGS = {
    postsPerDay: 1,
    categories: ["Comics"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Comics_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Comics_BOT_USER,
    Comics_BOT_SETTINGS,
    Comics_POST_SETTINGS,
};
const Classical_BOT_USER = {
    user: "Faust",
    slug: "66e71b4854d3f2a8aed2ac44",
    profileImage: "/images/3d73c86e9d0caf648e1daf18e3add43d",
};

const Classical_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Classical"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Classical_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Classical_BOT_USER,
    Classical_BOT_SETTINGS,
    Classical_POST_SETTINGS,
};
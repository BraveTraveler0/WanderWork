const Film_BOT_USER = {
    user: "Maxim",
    slug: "66e1d6013fc3e7ca8e12f79c",
    profileImage: "/images/3b2f48959b5d06138a71f2a293a8d9a5",
};

const Film_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Film"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Film_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Film_BOT_USER,
    Film_BOT_SETTINGS,
    Film_POST_SETTINGS,
};
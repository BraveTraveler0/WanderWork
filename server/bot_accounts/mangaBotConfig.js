const Manga_BOT_USER = {
    user: "Oni",
    slug: "66e1e7c93fc3e7ca8e12fa53",
    profileImage: "/images/9b0d859f6057906926c9a808c78bf53d",
};

const Manga_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Manga"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Manga_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Manga_BOT_USER,
    Manga_BOT_SETTINGS,
    Manga_POST_SETTINGS,
};
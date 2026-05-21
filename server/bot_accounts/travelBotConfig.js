const Travel_BOT_USER = {
    user: "Marcao",
    slug: "66e1ebfb3fc3e7ca8e12fcd8",
    profileImage: "/images/e89de4d97e856ad791365aab6b740b4d",
};

const Travel_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Travel"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Travel_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Travel_BOT_USER,
    Travel_BOT_SETTINGS,
    Travel_POST_SETTINGS,
};
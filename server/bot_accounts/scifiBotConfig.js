const Scifi_BOT_USER = {
    user: "Izzy",
    slug: "66ddd3de5d675672be0285fc",
    profileImage: "/images/5369e127dec39880fc6df28c5e34eb82",
};

const Scifi_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Sci-fi"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Scifi_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Scifi_BOT_USER,
    Scifi_BOT_SETTINGS,
    Scifi_POST_SETTINGS,
};
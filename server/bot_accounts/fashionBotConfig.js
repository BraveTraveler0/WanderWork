const Fashion_BOT_USER = {
    user: "Meena",
    slug: "66e1daad3fc3e7ca8e12f96a",
    profileImage: "/images/d1def8d7ef4d8145f81d77f2b35680d1",
};

const Fashion_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Fashion"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const Fashion_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    Fashion_BOT_USER,
    Fashion_BOT_SETTINGS,
    Fashion_POST_SETTINGS,
};
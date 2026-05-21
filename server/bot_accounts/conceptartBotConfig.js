const ConceptArt_BOT_USER = {
    user: "Vera",
    slug: "66ddcc665d675672be02826b",
    profileImage: "/images/06fdbbca02b33250cb768343ce24fe5e",
};

const ConceptArt_BOT_SETTINGS = {
    postsPerDay: 2,
    categories: ["Concept Art"],
    defaultVisibility: "all",
    allowedImageTypes: [".jpg", ".png", ".gif"],
    maxImageSize: 5 * 1024 * 1024, // 5MB in bytes
};

const ConceptArt_POST_SETTINGS = {
    nsfw: false,
    remix: false,
    repost: false,
    share: true,
};

module.exports = {
    ConceptArt_BOT_USER,
    ConceptArt_BOT_SETTINGS,
    ConceptArt_POST_SETTINGS,
};
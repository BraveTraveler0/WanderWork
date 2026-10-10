// Images that ship with the frontend under /blog-images. A post's `image` field is
// either one of these keys or a full https URL.
const BLOG_IMAGES = {
  'beach-creator':    { file: 'beach-creator.jpg', width: 1000, height: 667 },
  'mountain-creator': { file: 'mountain-creator.jpg', width: 900, height: 556 },
  'beach-laptop':     { file: 'beach-laptop.jpg', width: 1024, height: 662 },
  'frustrated':       { file: 'frustrated.jpg', width: 612, height: 408 },
  'paper-chaos':      { file: 'paper-chaos.png', width: 320, height: 480 },
}

const HERO_IMAGE = { file: 'hero.jpg', width: 1600, height: 1000 }

// Resolves a post's image field to an absolute URL plus dimensions when known.
function resolveBlogImage(image, appUrl) {
  const builtIn = BLOG_IMAGES[image]
  if (builtIn) return { url: `${appUrl}/blog-images/${builtIn.file}`, width: builtIn.width, height: builtIn.height }
  if (/^https:\/\/\S+$/i.test(String(image || ''))) return { url: image }
  return { url: `${appUrl}/blog-images/${HERO_IMAGE.file}`, width: HERO_IMAGE.width, height: HERO_IMAGE.height }
}

module.exports = { BLOG_IMAGES, HERO_IMAGE, resolveBlogImage }

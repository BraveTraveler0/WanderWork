const jwt = require('jsonwebtoken');

// Secret key for signing and verifying JWTs
const secretKey = 'Tempy_Aon_Alex'; // Replace with a strong, randomly generated key

// Function to generate a JWT
function generateToken(user, expiresIn = '30d', emailOnly = false) {
    const payload = emailOnly ? {
        id: user._id,
        email: user.email,
    } : {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        displayTut: user.displayTut,
        title: user.title,
        slug: user.slug,
        postTut: user.postTut,
        bio: user.bio,
        qrcode: user.qrcode,
        profImageTut: user.profImageTut,
        backImageTut: user.backImageTut,
        tutcomplete: user.tutcomplete,
        tutview: user.tutview,
        stars: user.stars,
        achievements: user.achievements,
        displayCase: user.displayCase,
        following: user.following,
        followers: user.followers,
        profimage: user.profimage,
        backimage: user.backimage,
        supporters: user.supporters,
        consecutivelogins: user.consecutivelogins,
        active: user.active,
        NSFW: user.NSFW,
        tagFollowing: user.tagFollowing,
        lastlogin: user.lastlogin,
        __v: user.__v// Include user ID or any other user information
        // Add more user data as needed
    };

    // Sign the token with the secret key and set an expiration (e.g., 1 hour)
    const token = jwt.sign(payload, secretKey, { expiresIn: expiresIn });
    return token;
}

// Function to verify a JWT
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, secretKey);
        return decoded;
    } catch (error) {
        return null; // Token is invalid or expired
    }
}

module.exports = { generateToken, verifyToken };
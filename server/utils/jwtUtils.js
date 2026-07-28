const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Secret key for signing and verifying JWTs
const fallbackSecret = crypto.randomBytes(64).toString('hex');
const secretKey = process.env.JWT_SECRET || process.env.AUTH_SECRET || fallbackSecret;
const jwtIssuer = process.env.JWT_ISSUER || 'wanderwork-api';
const jwtAudience = process.env.JWT_AUDIENCE || 'wanderwork-app';

if (!process.env.JWT_SECRET && !process.env.AUTH_SECRET) {
    console.warn('[Security] JWT_SECRET is not configured. Tokens will be invalid after every server restart.');
}

// Function to generate a JWT
function generateToken(user, expiresIn = '30d', emailOnly = false, extraClaims = {}) {
    const payload = emailOnly ? {
        id: user._id,
        email: user.email,
        ...extraClaims,
    } : {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        profimage: user.profimage,
        backimage: user.backimage,
        consecutivelogins: user.consecutivelogins,
        active: user.active,
        lastlogin: user.lastlogin,
        __v: user.__v
    };

    // Sign the token with the secret key and set an expiration (e.g., 1 hour)
    const token = jwt.sign(payload, secretKey, { expiresIn, issuer: jwtIssuer, audience: jwtAudience });
    return token;
}

// Function to verify a JWT
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, secretKey, { issuer: jwtIssuer, audience: jwtAudience });
        return decoded;
    } catch (error) {
        return null; // Token is invalid or expired
    }
}

module.exports = { generateToken, verifyToken };

const { verifyToken } = require('../utils/jwtUtils')
const User = require('../models/User')

async function findTokenUser(decoded) {
  const id = decoded?._id || decoded?.id
  const email = decoded?.email ? String(decoded.email).trim().toLowerCase() : ''

  if (id) {
    const user = await User.findById(id).lean().exec()
    if (user) return user
  }

  if (email) {
    return User.findOne({ email }).lean().exec()
  }

  return null
}

// Attaches req.user if a valid Bearer token is present. Does NOT reject anonymous requests.
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  try {
    if (header?.startsWith('Bearer ')) {
      const decoded = verifyToken(header.slice(7))
      if (decoded) {
        const user = await findTokenUser(decoded)
        if (user) req.user = { ...decoded, _id: user._id, email: user.email, displayName: user.displayName, isAdmin: !!user.isAdmin, isMod: !!user.isMod }
        else req.authError = 'user_not_found'
      } else {
        req.authError = 'invalid_token'
      }
    }
    next()
  } catch (error) {
    next(error)
  }
}

// Rejects the request with 401 if no valid Bearer token is present.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  try {
    const decoded = verifyToken(header.slice(7))
    if (!decoded) return res.status(401).json({ message: 'Invalid or expired token' })

    const user = await findTokenUser(decoded)
    if (!user) return res.status(401).json({ message: 'User no longer exists' })

    req.user = { ...decoded, _id: user._id, email: user.email, displayName: user.displayName, isAdmin: !!user.isAdmin, isMod: !!user.isMod }
    next()
  } catch (error) {
    next(error)
  }
}

module.exports = { optionalAuth, requireAuth }

const { verifyToken } = require('../utils/jwtUtils')

// Attaches req.user if a valid Bearer token is present. Does NOT reject anonymous requests.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    const decoded = verifyToken(header.slice(7))
    if (decoded) req.user = decoded
  }
  next()
}

// Rejects the request with 401 if no valid Bearer token is present.
function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  const decoded = verifyToken(header.slice(7))
  if (!decoded) return res.status(401).json({ message: 'Invalid or expired token' })
  req.user = decoded
  next()
}

module.exports = { optionalAuth, requireAuth }

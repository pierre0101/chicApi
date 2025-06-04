// File: src/middleware/auth.js

const jwt = require('jsonwebtoken');

// Middleware to authenticate via JWT from cookie or Authorization header
const auth = (req, res, next) => {
  // 1) Try to read token from cookie
  let token = req.cookies?.token;

  // 2) Fallback: read from Bearer header
  if (!token && req.header('Authorization')?.startsWith('Bearer ')) {
    token = req.header('Authorization').replace('Bearer ', '');
  }

  // 3) If no token, unauthorized
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    // 4) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5) Attach decoded payload to req.user
    req.user = decoded;

    // 6) Proceed
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

module.exports = auth;

// File: src/middleware/auth.js
const jwt = require('jsonwebtoken');

/* ─────────── authenticate via JWT ─────────── */
const auth = (req, res, next) => {
  // 1) cookie
  let token = req.cookies?.token;

  // 2) Bearer header
  if (!token && req.header('Authorization')?.startsWith('Bearer '))
    token = req.header('Authorization').replace('Bearer ', '');

  // 3) no token
  if (!token)
    return res
      .status(401)
      .json({ message: 'Access denied. No token provided.' });

  try {
    // 4) verify + attach
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

/* ─────────── section guard (men / women / kids) ─────────── */
const checkSectionAccess = (section) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ message: 'Unauthorized.' });

  /* admins always allowed */
  if (req.user.role === 'admin') return next();

  /* treat route with no section as "all" */
  const routeRaw = (section ?? '').trim().toLowerCase() || 'all';

  /* users with no section recorded → allow */
  if (!req.user.section) return next();

  /* helper: normalise + synonyms */
  const synonyms = {
    men: 'male',
    mens: 'male',
    male: 'male',

    women: 'female',
    ladies: 'female',
    female: 'female',

    kids: 'kids',
    kid: 'kids',
    child: 'kids',
    children: 'kids',

    all: 'unisex',
    unisex: 'unisex'
  };
  const norm = (s) =>
    synonyms[(s || '').trim().toLowerCase()] ||
    (s || '').trim().toLowerCase();

  const userSection     = norm(req.user.section);
  const requiredSection = norm(routeRaw);

  /* allow if either side is "unisex" (all) */
  if (userSection === 'unisex' || requiredSection === 'unisex') return next();

  /* compare final values */
  if (userSection !== requiredSection) {
    return res
      .status(403)
      .json({ message: 'Unauthorized or mismatched user profile.' });
  }

  next();
};

/* ─────────── role guard ─────────── */
const checkRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res
      .status(403)
      .json({ message: 'Forbidden: insufficient role' });
  }
  next();
};

module.exports = { auth, checkSectionAccess, checkRole };

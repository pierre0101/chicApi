// File: src/routes/auth.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

/* ------------------------------------------------------------
 * POST /auth/signup – register new user
 * ---------------------------------------------------------- */
router.post('/signup', async (req, res) => {
  const {
    username,
    password,
    firstName,
    lastName,
    email,
    address

  } = req.body;

  if (!username || !password || !firstName || !lastName || !email) {
    return res
      .status(400)
      .json({ message: 'Username, password, first name, last name, and email are required.' });
  }

  try {
    if (await User.findOne({ username })) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      email,
      address,
      role: "user"
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ message: 'Server error.' });
  }
});

/* ------------------------------------------------------------
 * POST /auth/login – authenticate, set cookie, return JWT
 * ---------------------------------------------------------- */
router.post('/login', async (req, res) => {
  const identifier = req.body.username || req.body.identifier || req.body.email;
  const { password } = req.body;

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: 'Username / e-mail and password are required.' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role // ensure your User model includes 'role'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 60 * 60 * 1000,
    });

    res.json({ token });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ message: 'Server error.' });
  }
});

/* ------------------------------------------------------------
 * POST /auth/logout – clear cookie
 * ---------------------------------------------------------- */
router.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully.' });
});

// GET / auth / me – return current user info
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('username firstName lastName email address');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      address: user.address
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;

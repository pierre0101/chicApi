const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// PATCH route to update user password
router.post('/', async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    if (!JWT_SECRET) {
        return res.status(500).json({ message: 'JWT secret not configured.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const username = decoded.username;

        if (!username) {
            return res.status(400).json({ message: 'Invalid token payload.' });
        }

        console.log('[DEBUG] Resetting password for user:', username);

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update password (assuming your User schema pre-save hook hashes it)
        user.password = password;
        await user.save();

        return res.status(200).json({ message: 'Password reset successful.' });
    } catch (err) {
        console.error('[ERROR] Update password error:', err);
        return res.status(500).json({ message: err.message || 'Failed to reset password.' });
    }
});

module.exports = router;
